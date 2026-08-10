import type { PoolClient } from "pg";

import { AppError } from "../../shared/app-error.js";
import type { RequestMetadata } from "../auth/auth.types.js";
import { TokenService } from "../auth/token.service.js";
import { CompanyRepository } from "./company.repository.js";
import type {
  CompanyCreateInput,
  CompanyProfileUpdateInput,
  CompanyUpdateInput,
  PartnerDirectoryDto,
  PartnerStatus,
  RecruiterCreateInput,
} from "./company.types.js";

const activationTtlMilliseconds = 72 * 60 * 60 * 1_000;

function notFound() {
  return new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy doanh nghiệp hoặc tài khoản phụ trách.");
}
function conflict(message: string, code = "COMPANY_STATE_CONFLICT") {
  return new AppError(409, code, message);
}

function toPartnerDirectory(company: {
  id: string;
  code: string;
  name: string;
  industry: string | null;
  companySize: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
  verifiedAt: string | null;
  recruitingJobCount: number;
}): PartnerDirectoryDto {
  return {
    id: company.id,
    code: company.code,
    name: company.name,
    industry: company.industry,
    companySize: company.companySize,
    description: company.description,
    website: company.website,
    address: company.address,
    verifiedAt: company.verifiedAt,
    recruitingJobCount: company.recruitingJobCount,
  };
}

function translateDatabaseError(error: unknown): never {
  const databaseError = error as { code?: string; constraint?: string };
  if (databaseError.code === "23505") {
    if (databaseError.constraint === "uq_users_email_normalized") {
      throw conflict("Email tài khoản đã tồn tại trong hệ thống.", "COMPANY_RECRUITER_EMAIL_EXISTS");
    }
    if (databaseError.constraint === "companies_code_key") {
      throw conflict("Mã doanh nghiệp đã tồn tại.", "COMPANY_CODE_EXISTS");
    }
    if (databaseError.constraint === "uq_companies_tax_code_normalized") {
      throw conflict("Mã số thuế đã được sử dụng.", "COMPANY_TAX_CODE_EXISTS");
    }
  }
  throw error;
}

export class CompanyService {
  constructor(
    private readonly repository: CompanyRepository,
    private readonly tokens = new TokenService(),
  ) {}

  list(input: { page: number; pageSize: number; query?: string; status?: PartnerStatus }) {
    return this.repository.list(input);
  }

  async listPartnerDirectory(input: {
    page: number;
    pageSize: number;
    query?: string;
    industry?: string;
    hasRecruitingJobs?: boolean;
  }) {
    const result = await this.repository.listActiveDirectory(input);
    return { items: result.items.map(toPartnerDirectory), total: result.total };
  }

  async getPartnerDirectory(companyId: string) {
    const company = await this.repository.findActiveDirectoryById(companyId);
    if (!company) throw notFound();
    return toPartnerDirectory(company);
  }

  async get(companyId: string) {
    const company = await this.repository.findById(companyId);
    if (!company) throw notFound();
    return company;
  }

  async getMyProfile(userId: string) {
    const company = await this.repository.findByUserId(userId);
    if (!company) throw notFound();
    return company;
  }

  async create(actorUserId: string, input: CompanyCreateInput, request: RequestMetadata) {
    const rawToken = this.tokens.createRefreshToken();
    const expiresAt = new Date(Date.now() + activationTtlMilliseconds);
    try {
      const company = await this.repository.withTransaction(async (client) => {
        const companyResult = await client.query<{ id: string }>(
          `INSERT INTO companies
           (code, name, legal_name, tax_code, industry, company_size, description, website, address,
            partner_status, verified_at, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', now(), $10)
           RETURNING id`,
          [
            input.code,
            input.name,
            input.legalName,
            input.taxCode,
            input.industry,
            input.companySize,
            input.description,
            input.website,
            input.address,
            actorUserId,
          ],
        );
        const companyId = companyResult.rows[0]!.id;
        const userResult = await client.query<{ id: string }>(
          `INSERT INTO users (email, role, status)
           VALUES ($1, 'COMPANY', 'PENDING_ACTIVATION') RETURNING id`,
          [input.primaryRecruiter.email],
        );
        const userId = userResult.rows[0]!.id;
        await client.query(
          `INSERT INTO company_users (user_id, company_id, full_name, title, is_primary)
           VALUES ($1, $2, $3, $4, true)`,
          [userId, companyId, input.primaryRecruiter.fullName, input.primaryRecruiter.title],
        );
        await this.insertActivationToken(client, userId, actorUserId, rawToken, expiresAt);
        await this.repository.writeAudit(client, {
          actorUserId,
          action: "COMPANY_PARTNER_CREATED",
          targetType: "COMPANY",
          targetId: companyId,
          metadata: { primaryRecruiterUserId: userId },
          request,
        });
        return (await this.repository.findById(companyId, client))!;
      });
      return { company, activation: { token: rawToken, expiresAt: expiresAt.toISOString() } };
    } catch (error) {
      translateDatabaseError(error);
    }
  }

  async update(actorUserId: string, companyId: string, input: CompanyUpdateInput, request: RequestMetadata) {
    try {
      return await this.repository.withTransaction(async (client) => {
        const locked = await this.requireCompanyVersion(client, companyId, input.expectedVersion);
        await client.query(
          `UPDATE companies SET code = $2, name = $3, legal_name = $4, tax_code = $5,
             industry = $6, company_size = $7, description = $8, website = $9, address = $10,
             version = version + 1 WHERE id = $1`,
          [companyId, input.code, input.name, input.legalName, input.taxCode, input.industry,
            input.companySize, input.description, input.website, input.address],
        );
        await this.repository.writeAudit(client, {
          actorUserId,
          action: "COMPANY_PARTNER_UPDATED",
          targetType: "COMPANY",
          targetId: companyId,
          metadata: { fromVersion: locked.version },
          request,
        });
        return (await this.repository.findById(companyId, client))!;
      });
    } catch (error) {
      translateDatabaseError(error);
    }
  }

  async updateMyProfile(
    actorUserId: string,
    companyId: string,
    input: CompanyProfileUpdateInput,
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const locked = await this.requireCompanyVersion(client, companyId, input.expectedVersion);
      if (locked.partnerStatus !== "ACTIVE") {
        throw conflict("Doanh nghiệp đang bị tạm ngưng nên chưa thể cập nhật hồ sơ.");
      }
      await client.query(
        `UPDATE companies SET name = $2, industry = $3, company_size = $4, description = $5,
           website = $6, address = $7, version = version + 1 WHERE id = $1`,
        [companyId, input.name, input.industry, input.companySize, input.description, input.website, input.address],
      );
      await this.repository.writeAudit(client, {
        actorUserId,
        action: "COMPANY_PROFILE_UPDATED",
        targetType: "COMPANY",
        targetId: companyId,
        metadata: { fromVersion: locked.version },
        request,
      });
      return (await this.repository.findById(companyId, client))!;
    });
  }

  async suspend(
    actorUserId: string,
    companyId: string,
    expectedVersion: number,
    reason: string,
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const locked = await this.requireCompanyVersion(client, companyId, expectedVersion);
      if (locked.partnerStatus !== "ACTIVE") throw conflict("Chỉ doanh nghiệp đang hoạt động mới có thể tạm ngưng.");
      await client.query(
        "UPDATE companies SET partner_status = 'SUSPENDED', version = version + 1 WHERE id = $1",
        [companyId],
      );
      await client.query(
        `UPDATE users SET status = 'SUSPENDED', suspension_reason = 'COMPANY_SUSPENDED'
         WHERE id IN (SELECT user_id FROM company_users WHERE company_id = $1)
           AND status IN ('ACTIVE', 'PENDING_ACTIVATION')`,
        [companyId],
      );
      await this.revokeCompanySessions(client, companyId);
      await this.repository.writeAudit(client, {
        actorUserId,
        action: "COMPANY_PARTNER_SUSPENDED",
        targetType: "COMPANY",
        targetId: companyId,
        metadata: { reason },
        request,
      });
      return (await this.repository.findById(companyId, client))!;
    });
  }

  async reactivate(
    actorUserId: string,
    companyId: string,
    expectedVersion: number,
    reason: string,
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const locked = await this.requireCompanyVersion(client, companyId, expectedVersion);
      if (locked.partnerStatus !== "SUSPENDED") throw conflict("Chỉ doanh nghiệp đang tạm ngưng mới có thể kích hoạt lại.");
      await client.query(
        `UPDATE companies SET partner_status = 'ACTIVE', verified_at = COALESCE(verified_at, now()),
         version = version + 1 WHERE id = $1`,
        [companyId],
      );
      await client.query(
        `UPDATE users SET status = CASE WHEN password_hash IS NULL THEN 'PENDING_ACTIVATION' ELSE 'ACTIVE' END,
             suspension_reason = NULL
         WHERE id IN (SELECT user_id FROM company_users WHERE company_id = $1)
           AND status = 'SUSPENDED' AND suspension_reason = 'COMPANY_SUSPENDED'`,
        [companyId],
      );
      await this.repository.writeAudit(client, {
        actorUserId,
        action: "COMPANY_PARTNER_REACTIVATED",
        targetType: "COMPANY",
        targetId: companyId,
        metadata: { reason },
        request,
      });
      return (await this.repository.findById(companyId, client))!;
    });
  }

  async addRecruiter(
    actorUserId: string,
    companyId: string,
    input: RecruiterCreateInput,
    request: RequestMetadata,
  ) {
    const rawToken = this.tokens.createRefreshToken();
    const expiresAt = new Date(Date.now() + activationTtlMilliseconds);
    try {
      const result = await this.repository.withTransaction(async (client) => {
        const company = await this.repository.lockCompany(client, companyId);
        if (!company) throw notFound();
        if (company.partnerStatus !== "ACTIVE") throw conflict("Doanh nghiệp phải hoạt động trước khi thêm tài khoản.");
        const user = await client.query<{ id: string }>(
          "INSERT INTO users (email, role, status) VALUES ($1, 'COMPANY', 'PENDING_ACTIVATION') RETURNING id",
          [input.email],
        );
        const userId = user.rows[0]!.id;
        await client.query(
          `INSERT INTO company_users (user_id, company_id, full_name, title, is_primary)
           VALUES ($1, $2, $3, $4, false)`,
          [userId, companyId, input.fullName, input.title],
        );
        await this.insertActivationToken(client, userId, actorUserId, rawToken, expiresAt);
        await this.repository.writeAudit(client, {
          actorUserId,
          action: "COMPANY_RECRUITER_CREATED",
          targetType: "USER",
          targetId: userId,
          metadata: { companyId },
          request,
        });
        return { userId, company: (await this.repository.findById(companyId, client))! };
      });
      return { ...result, activation: { token: rawToken, expiresAt: expiresAt.toISOString() } };
    } catch (error) {
      translateDatabaseError(error);
    }
  }

  async suspendRecruiter(
    actorUserId: string,
    companyId: string,
    userId: string,
    reason: string,
    request: RequestMetadata,
  ) {
    return this.changeRecruiterState(actorUserId, companyId, userId, "suspend", reason, request);
  }

  async reactivateRecruiter(
    actorUserId: string,
    companyId: string,
    userId: string,
    reason: string,
    request: RequestMetadata,
  ) {
    return this.changeRecruiterState(actorUserId, companyId, userId, "reactivate", reason, request);
  }

  async regenerateActivation(
    actorUserId: string,
    companyId: string,
    userId: string,
    request: RequestMetadata,
  ) {
    const rawToken = this.tokens.createRefreshToken();
    const expiresAt = new Date(Date.now() + activationTtlMilliseconds);
    const company = await this.repository.withTransaction(async (client) => {
      const lockedCompany = await this.repository.lockCompany(client, companyId);
      const recruiter = await this.repository.lockRecruiter(client, companyId, userId);
      if (!lockedCompany || !recruiter) throw notFound();
      if (lockedCompany.partnerStatus !== "ACTIVE") throw conflict("Doanh nghiệp đang bị tạm ngưng.");
      if (recruiter.status !== "PENDING_ACTIVATION" || recruiter.passwordHash) {
        throw conflict("Chỉ tài khoản chưa kích hoạt mới có thể tạo lại liên kết.", "COMPANY_ACTIVATION_NOT_ALLOWED");
      }
      await client.query(
        `UPDATE account_activation_tokens SET used_at = now()
         WHERE user_id = $1 AND token_type = 'COMPANY_ACTIVATION' AND used_at IS NULL`,
        [userId],
      );
      await this.insertActivationToken(client, userId, actorUserId, rawToken, expiresAt);
      await this.repository.writeAudit(client, {
        actorUserId,
        action: "COMPANY_ACTIVATION_LINK_REGENERATED",
        targetType: "USER",
        targetId: userId,
        metadata: { companyId },
        request,
      });
      return (await this.repository.findById(companyId, client))!;
    });
    return { company, activation: { token: rawToken, expiresAt: expiresAt.toISOString() } };
  }

  private async changeRecruiterState(
    actorUserId: string,
    companyId: string,
    userId: string,
    action: "suspend" | "reactivate",
    reason: string,
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const company = await this.repository.lockCompany(client, companyId);
      const recruiter = await this.repository.lockRecruiter(client, companyId, userId);
      if (!company || !recruiter) throw notFound();
      if (action === "suspend") {
        if (!(recruiter.status === "ACTIVE" || recruiter.status === "PENDING_ACTIVATION")) {
          throw conflict("Tài khoản không ở trạng thái có thể tạm ngưng.");
        }
        await client.query(
          "UPDATE users SET status = 'SUSPENDED', suspension_reason = 'ADMIN_SUSPENDED' WHERE id = $1",
          [userId],
        );
        await client.query(
          "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1",
          [userId],
        );
      } else {
        if (company.partnerStatus !== "ACTIVE") throw conflict("Doanh nghiệp đang bị tạm ngưng.");
        if (recruiter.status !== "SUSPENDED" || recruiter.suspensionReason !== "ADMIN_SUSPENDED") {
          throw conflict("Tài khoản không do UIT tạm ngưng nên không thể kích hoạt theo thao tác này.");
        }
        await client.query(
          `UPDATE users SET status = CASE WHEN password_hash IS NULL THEN 'PENDING_ACTIVATION' ELSE 'ACTIVE' END,
             suspension_reason = NULL WHERE id = $1`,
          [userId],
        );
      }
      await this.repository.writeAudit(client, {
        actorUserId,
        action: action === "suspend" ? "COMPANY_RECRUITER_SUSPENDED" : "COMPANY_RECRUITER_REACTIVATED",
        targetType: "USER",
        targetId: userId,
        metadata: { companyId, reason },
        request,
      });
      return (await this.repository.findById(companyId, client))!;
    });
  }

  private async requireCompanyVersion(client: PoolClient, companyId: string, expectedVersion: number) {
    const company = await this.repository.lockCompany(client, companyId);
    if (!company) throw notFound();
    if (company.version !== expectedVersion) {
      throw conflict("Dữ liệu doanh nghiệp vừa được cập nhật. Vui lòng tải lại trước khi tiếp tục.", "COMPANY_VERSION_CONFLICT");
    }
    return company;
  }

  private async insertActivationToken(
    client: PoolClient,
    userId: string,
    actorUserId: string,
    rawToken: string,
    expiresAt: Date,
  ) {
    await client.query(
      `INSERT INTO account_activation_tokens
       (user_id, token_type, token_hash, expires_at, created_by_user_id)
       VALUES ($1, 'COMPANY_ACTIVATION', $2, $3, $4)`,
      [userId, this.tokens.hashOpaqueToken(rawToken), expiresAt, actorUserId],
    );
  }

  private async revokeCompanySessions(client: PoolClient, companyId: string) {
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id IN (SELECT user_id FROM company_users WHERE company_id = $1)`,
      [companyId],
    );
  }
}
