import type { PoolClient } from "pg";

import { AppError } from "../../shared/app-error.js";
import type { RequestMetadata } from "../auth/auth.types.js";
import { TaxonomyRepository } from "./taxonomy.repository.js";
import type {
  CategoryCreateInput,
  SkillCreateInput,
  TaxonomyKind,
  TaxonomyListInput,
  TaxonomyStateInput,
  TaxonomyUpdateInput,
} from "./taxonomy.types.js";

function notFound() {
  return new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy danh mục hoặc kỹ năng.");
}

function conflict(message: string, code = "TAXONOMY_STATE_CONFLICT") {
  return new AppError(409, code, message);
}

function translateDatabaseError(error: unknown): never {
  const databaseError = error as { code?: string; constraint?: string };
  if (databaseError.code === "23505") {
    if (databaseError.constraint?.includes("name_normalized")) {
      throw conflict("Tên hiển thị đã tồn tại trong cùng loại danh mục.", "TAXONOMY_NAME_EXISTS");
    }
    throw conflict("Mã định danh đã tồn tại.", "TAXONOMY_KEY_EXISTS");
  }
  throw error;
}

export class TaxonomyService {
  constructor(private readonly repository: TaxonomyRepository) {}

  listCategories(input: TaxonomyListInput) {
    return this.repository.listCategories(input);
  }

  listSkills(input: TaxonomyListInput) {
    return this.repository.listSkills(input);
  }

  async createCategory(actorUserId: string, input: CategoryCreateInput, request: RequestMetadata) {
    return this.create("category", actorUserId, input.code, input.name, request);
  }

  async createSkill(actorUserId: string, input: SkillCreateInput, request: RequestMetadata) {
    return this.create("skill", actorUserId, input.slug, input.name, request);
  }

  async updateCategory(
    actorUserId: string,
    id: string,
    input: TaxonomyUpdateInput,
    request: RequestMetadata,
  ) {
    return this.update("category", actorUserId, id, input, request);
  }

  async updateSkill(
    actorUserId: string,
    id: string,
    input: TaxonomyUpdateInput,
    request: RequestMetadata,
  ) {
    return this.update("skill", actorUserId, id, input, request);
  }

  archiveCategory(actorUserId: string, id: string, input: TaxonomyStateInput, request: RequestMetadata) {
    return this.changeState("category", actorUserId, id, false, input, request);
  }

  reactivateCategory(actorUserId: string, id: string, input: TaxonomyStateInput, request: RequestMetadata) {
    return this.changeState("category", actorUserId, id, true, input, request);
  }

  archiveSkill(actorUserId: string, id: string, input: TaxonomyStateInput, request: RequestMetadata) {
    return this.changeState("skill", actorUserId, id, false, input, request);
  }

  reactivateSkill(actorUserId: string, id: string, input: TaxonomyStateInput, request: RequestMetadata) {
    return this.changeState("skill", actorUserId, id, true, input, request);
  }

  private async create(
    kind: TaxonomyKind,
    actorUserId: string,
    key: string,
    name: string,
    request: RequestMetadata,
  ) {
    const table = kind === "category" ? "categories" : "skills";
    const keyColumn = kind === "category" ? "code" : "slug";
    try {
      return await this.repository.withTransaction(async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO ${table} (${keyColumn}, name) VALUES ($1, $2) RETURNING id`,
          [key, name],
        );
        const id = created.rows[0]!.id;
        await this.repository.writeAudit(client, {
          actorUserId,
          action: kind === "category" ? "CATEGORY_CREATED" : "SKILL_CREATED",
          kind,
          targetId: id,
          metadata: { key, name },
          request,
        });
        return (kind === "category"
          ? this.repository.findCategoryById(id, client)
          : this.repository.findSkillById(id, client))!;
      });
    } catch (error) {
      translateDatabaseError(error);
    }
  }

  private async update(
    kind: TaxonomyKind,
    actorUserId: string,
    id: string,
    input: TaxonomyUpdateInput,
    request: RequestMetadata,
  ) {
    const table = kind === "category" ? "categories" : "skills";
    try {
      return await this.repository.withTransaction(async (client) => {
        const locked = await this.requireVersion(client, kind, id, input.expectedVersion);
        await client.query(`UPDATE ${table} SET name = $2, version = version + 1 WHERE id = $1`, [id, input.name]);
        await this.repository.writeAudit(client, {
          actorUserId,
          action: kind === "category" ? "CATEGORY_UPDATED" : "SKILL_UPDATED",
          kind,
          targetId: id,
          metadata: { key: locked.key, previousName: locked.name, name: input.name, fromVersion: locked.version },
          request,
        });
        return (kind === "category"
          ? this.repository.findCategoryById(id, client)
          : this.repository.findSkillById(id, client))!;
      });
    } catch (error) {
      translateDatabaseError(error);
    }
  }

  private async changeState(
    kind: TaxonomyKind,
    actorUserId: string,
    id: string,
    isActive: boolean,
    input: TaxonomyStateInput,
    request: RequestMetadata,
  ) {
    const table = kind === "category" ? "categories" : "skills";
    return this.repository.withTransaction(async (client) => {
      const locked = await this.requireVersion(client, kind, id, input.expectedVersion);
      if (locked.isActive === isActive) {
        throw conflict(isActive ? "Mục này đang hoạt động." : "Mục này đã ngừng hoạt động.");
      }
      if (!isActive) {
        const openJobCount = await this.repository.countOpenJobReferences(client, kind, id);
        if (openJobCount > 0) {
          throw conflict(
            `Không thể ngừng hoạt động vì còn ${openJobCount} tin chưa kết thúc đang sử dụng mục này.`,
            "TAXONOMY_IN_USE",
          );
        }
      }
      await client.query(
        `UPDATE ${table} SET is_active = $2, version = version + 1 WHERE id = $1`,
        [id, isActive],
      );
      await this.repository.writeAudit(client, {
        actorUserId,
        action: `${kind === "category" ? "CATEGORY" : "SKILL"}_${isActive ? "REACTIVATED" : "ARCHIVED"}`,
        kind,
        targetId: id,
        metadata: {
          key: locked.key,
          reason: input.reason,
          fromStatus: isActive ? "INACTIVE" : "ACTIVE",
          toStatus: isActive ? "ACTIVE" : "INACTIVE",
          fromVersion: locked.version,
        },
        request,
      });
      return (kind === "category"
        ? this.repository.findCategoryById(id, client)
        : this.repository.findSkillById(id, client))!;
    });
  }

  private async requireVersion(client: PoolClient, kind: TaxonomyKind, id: string, version: number) {
    const item = await this.repository.lock(client, kind, id);
    if (!item) throw notFound();
    if (item.version !== version) {
      throw conflict(
        "Dữ liệu vừa được cập nhật. Vui lòng tải lại trước khi tiếp tục.",
        "TAXONOMY_VERSION_CONFLICT",
      );
    }
    return item;
  }
}
