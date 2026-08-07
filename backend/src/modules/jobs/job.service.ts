import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { AppError } from "../../shared/app-error.js";
import { JobRepository } from "./job.repository.js";
import type {
  JobDraftInput,
  JobDraftUpdateInput,
  JobStatus,
  RequestMetadata,
  ReviewDecision,
} from "./job.types.js";

type Actor = { userId: string; companyId: string | null };

function notFound() {
  return new AppError(404, "JOB_NOT_FOUND", "Không tìm thấy tin tuyển dụng.");
}

function conflict(message: string) {
  return new AppError(409, "JOB_STATE_CONFLICT", message);
}

function isExpired(deadline: string | Date) {
  const value = typeof deadline === "string" ? deadline.slice(0, 10) : deadline.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return value < today;
}

export class JobService {
  constructor(private readonly repository: JobRepository) {}

  async listCompanyJobs(companyId: string | null, input: { page: number; pageSize: number; status?: JobStatus }) {
    if (!companyId) throw notFound();
    return this.repository.listCompanyJobs(companyId, input);
  }

  async getCompanyJob(companyId: string | null, jobId: string) {
    if (!companyId) throw notFound();
    const job = await this.repository.findById(jobId);
    if (!job || job.company.id !== companyId) throw notFound();
    return job;
  }

  async listReviewQueue(input: { page: number; pageSize: number }) {
    return this.repository.listReviewQueue(input);
  }

  async createDraft(actor: Actor, input: JobDraftInput, request: RequestMetadata) {
    if (!actor.companyId) throw notFound();
    return this.repository.withTransaction(async (client) => {
      const company = await client.query<{ partner_status: string }>(
        "SELECT partner_status FROM companies WHERE id = $1 FOR SHARE",
        [actor.companyId],
      );
      if (!company.rows[0]) throw notFound();
      if (company.rows[0].partner_status !== "ACTIVE") {
        throw new AppError(403, "COMPANY_NOT_ACTIVE", "Doanh nghiệp chưa ở trạng thái đối tác hoạt động.");
      }
      await this.validateReferences(client, input);
      const result = await client.query<{ id: string }>(
        `INSERT INTO job_posts
         (company_id, created_by_user_id, title, opportunity_type, work_mode, location,
          description, requirements, benefits, positions, deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT')
         RETURNING id`,
        [
          actor.companyId,
          actor.userId,
          input.title,
          input.opportunityType,
          input.workMode,
          input.location,
          input.description,
          input.requirements,
          input.benefits,
          input.positions,
          input.deadline,
        ],
      );
      const jobId = result.rows[0]!.id;
      await this.repository.replaceReferences(client, jobId, input);
      await client.query(
        `INSERT INTO job_post_status_history
         (job_post_id, command_id, from_status, to_status, actor_type, actor_user_id)
         VALUES ($1, $2, NULL, 'DRAFT', 'COMPANY', $3)`,
        [jobId, randomUUID(), actor.userId],
      );
      await this.repository.writeAudit(client, {
        actorUserId: actor.userId,
        action: "JOB_DRAFT_CREATED",
        jobId,
        request,
      });
      return (await this.repository.findById(jobId, client))!;
    });
  }

  async updateDraft(
    actor: Actor,
    jobId: string,
    input: JobDraftUpdateInput,
    request: RequestMetadata,
  ) {
    if (!actor.companyId) throw notFound();
    return this.repository.withTransaction(async (client) => {
      const locked = await this.repository.lockJob(client, jobId);
      if (!locked || locked.companyId !== actor.companyId) throw notFound();
      if (!(["DRAFT", "REVISION_REQUIRED"] as JobStatus[]).includes(locked.status)) {
        throw conflict("Chỉ có thể sửa tin ở trạng thái Bản nháp hoặc Cần chỉnh sửa.");
      }
      if (locked.version !== input.expectedVersion) {
        throw conflict("Tin đã được cập nhật ở nơi khác. Vui lòng tải lại dữ liệu.");
      }
      await this.validateReferences(client, input);
      await client.query(
        `UPDATE job_posts SET
           title = $2, opportunity_type = $3, work_mode = $4, location = $5,
           description = $6, requirements = $7, benefits = $8, positions = $9,
           deadline = $10, version = version + 1
         WHERE id = $1`,
        [
          jobId,
          input.title,
          input.opportunityType,
          input.workMode,
          input.location,
          input.description,
          input.requirements,
          input.benefits,
          input.positions,
          input.deadline,
        ],
      );
      await this.repository.replaceReferences(client, jobId, input);
      await this.repository.writeAudit(client, {
        actorUserId: actor.userId,
        action: "JOB_DRAFT_UPDATED",
        jobId,
        metadata: { fromVersion: locked.version },
        request,
      });
      return (await this.repository.findById(jobId, client))!;
    });
  }

  async submit(actor: Actor, jobId: string, commandId: string, request: RequestMetadata) {
    if (!actor.companyId) throw notFound();
    return this.repository.withTransaction(async (client) => {
      if (await this.repository.commandExists(client, jobId, commandId)) {
        const repeated = await this.repository.findById(jobId, client);
        if (!repeated || repeated.company.id !== actor.companyId) throw notFound();
        return repeated;
      }
      const locked = await this.repository.lockJob(client, jobId);
      if (!locked || locked.companyId !== actor.companyId) throw notFound();
      if (await this.repository.commandExists(client, jobId, commandId)) {
        return (await this.repository.findById(jobId, client))!;
      }
      if (!(["DRAFT", "REVISION_REQUIRED"] as JobStatus[]).includes(locked.status)) {
        throw conflict("Tin không còn ở trạng thái có thể gửi UIT duyệt.");
      }
      if (locked.partnerStatus !== "ACTIVE") {
        throw new AppError(403, "COMPANY_NOT_ACTIVE", "Doanh nghiệp chưa ở trạng thái đối tác hoạt động.");
      }
      if (isExpired(locked.deadline)) {
        throw new AppError(400, "JOB_DEADLINE_EXPIRED", "Hạn ứng tuyển phải từ hôm nay trở đi.");
      }
      await client.query(
        `UPDATE job_posts SET status = 'PENDING_UIT_REVIEW', version = version + 1,
          submitted_at = now(), reviewed_at = NULL, reviewed_by_user_id = NULL WHERE id = $1`,
        [jobId],
      );
      await client.query(
        `INSERT INTO job_post_status_history
         (job_post_id, command_id, from_status, to_status, actor_type, actor_user_id)
         VALUES ($1, $2, $3, 'PENDING_UIT_REVIEW', 'COMPANY', $4)`,
        [jobId, commandId, locked.status, actor.userId],
      );
      const job = (await this.repository.findById(jobId, client))!;
      await this.notifyUitAdmins(client, jobId, commandId, job.title, job.company.name);
      await this.repository.writeAudit(client, {
        actorUserId: actor.userId,
        action: "JOB_SUBMITTED_FOR_UIT_REVIEW",
        jobId,
        metadata: { fromStatus: locked.status, commandId },
        request,
      });
      return job;
    });
  }

  async review(
    actorUserId: string,
    jobId: string,
    commandId: string,
    decision: ReviewDecision,
    reason: { reasonCode: string; note: string } | null,
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      if (await this.repository.commandExists(client, jobId, commandId)) {
        const repeated = await this.repository.findById(jobId, client);
        if (!repeated) throw notFound();
        return repeated;
      }
      const locked = await this.repository.lockJob(client, jobId);
      if (!locked) throw notFound();
      if (await this.repository.commandExists(client, jobId, commandId)) {
        return (await this.repository.findById(jobId, client))!;
      }
      if (locked.status !== "PENDING_UIT_REVIEW") {
        throw conflict("Tin đã được xử lý hoặc không còn chờ UIT duyệt.");
      }
      if (decision === "approve" && isExpired(locked.deadline)) {
        throw new AppError(400, "JOB_DEADLINE_EXPIRED", "Không thể duyệt tin đã hết hạn ứng tuyển.");
      }
      const nextStatus: JobStatus =
        decision === "approve" ? "RECRUITING" : decision === "request-revision" ? "REVISION_REQUIRED" : "REJECTED";
      await client.query(
        `UPDATE job_posts SET status = $2, version = version + 1,
          reviewed_by_user_id = $3, reviewed_at = now() WHERE id = $1`,
        [jobId, nextStatus, actorUserId],
      );
      await client.query(
        `INSERT INTO job_post_status_history
         (job_post_id, command_id, from_status, to_status, actor_type, actor_user_id, reason_code, note)
         VALUES ($1, $2, 'PENDING_UIT_REVIEW', $3, 'UIT_ADMIN', $4, $5, $6)`,
        [jobId, commandId, nextStatus, actorUserId, reason?.reasonCode ?? null, reason?.note ?? null],
      );
      const job = (await this.repository.findById(jobId, client))!;
      await this.notifyCompany(client, job.company.id, jobId, commandId, job.title, decision, reason?.note);
      await this.repository.writeAudit(client, {
        actorUserId,
        action: `JOB_UIT_${decision.replace("-", "_").toUpperCase()}`,
        jobId,
        metadata: { commandId, nextStatus, reasonCode: reason?.reasonCode ?? null },
        request,
      });
      return job;
    });
  }

  private async validateReferences(client: PoolClient, input: JobDraftInput) {
    const [categoriesValid, skillsValid] = await Promise.all([
      this.repository.assertReferenceIds(client, "categories", input.categoryIds),
      this.repository.assertReferenceIds(client, "skills", input.skillIds),
    ]);
    if (!categoriesValid || !skillsValid) {
      throw new AppError(400, "JOB_REFERENCE_INVALID", "Nhóm ngành hoặc kỹ năng không hợp lệ.");
    }
  }

  private async notifyUitAdmins(
    client: PoolClient,
    jobId: string,
    commandId: string,
    title: string,
    companyName: string,
  ) {
    await client.query(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
       SELECT u.id, 'JOB_PENDING_UIT_REVIEW', 'Có tin tuyển dụng mới cần duyệt',
              $3 || ' đã gửi tin "' || $4 || '".', 'JOB_POST', $1::uuid,
              '/uit/jobs/review', 'job:' || $1::text || ':submit:' || $2::text || ':' || u.id::text,
              jsonb_build_object('jobId', $1::text, 'commandId', $2::text)
       FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [jobId, commandId, companyName, title],
    );
  }

  private async notifyCompany(
    client: PoolClient,
    companyId: string,
    jobId: string,
    commandId: string,
    title: string,
    decision: ReviewDecision,
    note?: string,
  ) {
    const copy = {
      approve: ["JOB_APPROVED", "Tin tuyển dụng đã được duyệt", `Tin "${title}" đã được công khai.`],
      "request-revision": ["JOB_REVISION_REQUIRED", "Tin tuyển dụng cần chỉnh sửa", note ?? `Tin "${title}" cần chỉnh sửa.`],
      reject: ["JOB_REJECTED", "Tin tuyển dụng đã bị từ chối", note ?? `Tin "${title}" đã bị từ chối.`],
    }[decision];
    await client.query(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
       SELECT u.id, $4, $5, $6, 'JOB_POST', $1::uuid, '/company/jobs/' || $1::text,
              'job:' || $1::text || ':review:' || $2::text || ':' || u.id::text,
              jsonb_build_object('jobId', $1::text, 'commandId', $2::text, 'decision', $7::text)
       FROM company_users cu JOIN users u ON u.id = cu.user_id
       WHERE cu.company_id = $3 AND u.status = 'ACTIVE'
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [jobId, commandId, companyId, copy[0], copy[1], copy[2], decision],
    );
  }
}
