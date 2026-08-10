import { AppError } from "../../shared/app-error.js";
import { PlacementRepository } from "./placement.repository.js";
import type {
  PlacementStatus,
  PlacementTransitionInput,
  RequestMetadata,
} from "./placement.types.js";

function placementNotFound() {
  return new AppError(404, "INTERNSHIP_PLACEMENT_NOT_FOUND", "Không tìm thấy kỳ thực tập.");
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export class PlacementService {
  constructor(private readonly repository: PlacementRepository) {}

  list(input: { page: number; pageSize: number; status?: PlacementStatus; query?: string }) {
    return this.repository.list(input);
  }

  async transition(
    actorUserId: string,
    placementId: string,
    commandId: string,
    action: "start" | "complete",
    input: PlacementTransitionInput,
    request: RequestMetadata,
  ) {
    const fromStatus: PlacementStatus = action === "start" ? "HIRED" : "STARTED";
    const toStatus: PlacementStatus = action === "start" ? "STARTED" : "COMPLETED";
    return this.repository.withTransaction(async (client) => {
      const placement = await this.repository.lockById(client, placementId);
      if (!placement) throw placementNotFound();

      const repeatedStatus = await this.repository.findCommand(client, placementId, commandId);
      if (repeatedStatus) {
        if (repeatedStatus !== toStatus) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency-Key đã được dùng cho một chuyển trạng thái khác.",
          );
        }
        return (await this.repository.findById(placementId, client))!;
      }
      if (placement.status !== fromStatus) {
        throw new AppError(
          409,
          "INTERNSHIP_PLACEMENT_STATE_CONFLICT",
          action === "start"
            ? "Chỉ kỳ thực tập ở trạng thái đã xác nhận mới có thể bắt đầu."
            : "Chỉ kỳ thực tập đang diễn ra mới có thể hoàn thành.",
        );
      }
      if (placement.version !== input.expectedVersion) {
        throw new AppError(
          409,
          "INTERNSHIP_PLACEMENT_VERSION_CONFLICT",
          "Dữ liệu kỳ thực tập đã thay đổi. Vui lòng tải lại trước khi thao tác.",
        );
      }
      if (input.effectiveDate > todayInVietnam()) {
        throw new AppError(
          400,
          "INTERNSHIP_PLACEMENT_DATE_IN_FUTURE",
          "Ngày hiệu lực không được nằm trong tương lai.",
        );
      }
      if (action === "complete" && placement.actual_start_date && input.effectiveDate < placement.actual_start_date) {
        throw new AppError(
          400,
          "INTERNSHIP_PLACEMENT_DATE_ORDER_INVALID",
          "Ngày hoàn thành không được trước ngày bắt đầu thực tập.",
        );
      }

      await this.repository.transition(client, {
        placementId,
        actorUserId,
        commandId,
        fromStatus,
        toStatus,
        effectiveDate: input.effectiveDate,
        note: input.note,
        request,
        applicationId: placement.application_id,
        studentUserId: placement.student_user_id,
        studentFullName: placement.student_full_name,
        jobTitle: placement.job_title,
        companyId: placement.company_id,
        companyName: placement.company_name,
      });
      return (await this.repository.findById(placementId, client))!;
    });
  }
}
