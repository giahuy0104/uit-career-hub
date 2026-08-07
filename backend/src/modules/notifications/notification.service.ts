import { AppError } from "../../shared/app-error.js";
import { NotificationRepository } from "./notification.repository.js";
import type { NotificationListQuery } from "./notification.types.js";

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  list(recipientUserId: string, query: NotificationListQuery) {
    return this.repository.list(recipientUserId, query);
  }

  async unreadCount(recipientUserId: string) {
    return { count: await this.repository.unreadCount(recipientUserId) };
  }

  async markRead(recipientUserId: string, notificationId: string) {
    if (!await this.repository.markRead(recipientUserId, notificationId)) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.");
    }
  }

  markAllRead(recipientUserId: string) {
    return this.repository.markAllRead(recipientUserId);
  }
}
