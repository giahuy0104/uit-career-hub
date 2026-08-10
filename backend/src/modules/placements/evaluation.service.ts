import { AppError } from "../../shared/app-error.js";
import { InternshipEvaluationRepository } from "./evaluation.repository.js";
import type {
  InternshipEvaluationActor,
  InternshipEvaluationInput,
  InternshipEvaluationRole,
} from "./evaluation.types.js";
import type { RequestMetadata } from "./placement.types.js";

function notFound() {
  return new AppError(404, "INTERNSHIP_PLACEMENT_NOT_FOUND", "Không tìm thấy kỳ thực tập.");
}

export class InternshipEvaluationService {
  constructor(private readonly repository: InternshipEvaluationRepository) {}

  async get(
    actor: InternshipEvaluationActor,
    applicationId: string,
    role: InternshipEvaluationRole,
  ) {
    const context = await this.repository.findContextByApplication(applicationId);
    this.assertOwnership(context, actor, role);
    return this.repository.viewFor(context!, role);
  }

  async submit(
    actor: InternshipEvaluationActor,
    applicationId: string,
    commandId: string,
    role: InternshipEvaluationRole,
    input: InternshipEvaluationInput,
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const context = await this.repository.findContextByApplication(applicationId, client, true);
      this.assertOwnership(context, actor, role);

      const repeated = await this.repository.findByCommand(context!.placement_id, commandId, client);
      if (repeated) {
        if (repeated.respondentRole !== role) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key đã được dùng cho một phiếu khác.");
        }
        return this.repository.viewFor(context!, role, client);
      }

      const current = await this.repository.viewFor(context!, role, client);
      if (!current.canSubmit) {
        if (context!.placement_status !== "COMPLETED") {
          throw new AppError(
            409,
            "INTERNSHIP_EVALUATION_NOT_AVAILABLE",
            "Chỉ có thể gửi đánh giá sau khi UIT xác nhận hoàn thành kỳ thực tập.",
          );
        }
        throw new AppError(
          409,
          "INTERNSHIP_EVALUATION_ALREADY_SUBMITTED",
          "Phiếu đánh giá đã được gửi và không thể chỉnh sửa.",
        );
      }

      await this.repository.insert(client, { actor, applicationId, commandId, role, input, request }, context!);
      return this.repository.viewFor(context!, role, client);
    });
  }

  private assertOwnership(
    context: Awaited<ReturnType<InternshipEvaluationRepository["findContextByApplication"]>>,
    actor: InternshipEvaluationActor,
    role: InternshipEvaluationRole,
  ): asserts context {
    if (!context) throw notFound();
    if (role === "STUDENT" && context.student_profile_id !== actor.studentProfileId) throw notFound();
    if (role === "COMPANY" && context.company_id !== actor.companyId) throw notFound();
  }
}
