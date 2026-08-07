import { EmailDeliveryRepository } from "./email-delivery.repository.js";
import { renderNotificationEmail } from "./email-template.js";
import type { EmailDispatchSummary, EmailProvider } from "./email.types.js";

type EmailDeliveryOptions = {
  appBaseUrl: string;
  batchSize: number;
  maxAttempts: number;
};

export class EmailDeliveryService {
  constructor(
    private readonly repository: EmailDeliveryRepository,
    private readonly provider: EmailProvider | null,
    private readonly options: EmailDeliveryOptions,
  ) {}

  async dispatchPending(resourceId?: string): Promise<EmailDispatchSummary> {
    if (!this.provider) {
      return { enabled: false, claimed: 0, sent: 0, failed: 0 };
    }

    let claimed = 0;
    let sent = 0;
    let failed = 0;

    while (true) {
      const deliveries = await this.repository.claimPending({
        resourceId,
        limit: this.options.batchSize,
        maxAttempts: this.options.maxAttempts,
      });
      claimed += deliveries.length;

      for (const delivery of deliveries) {
        try {
          const result = await this.provider.send(
            renderNotificationEmail(delivery, this.options.appBaseUrl),
          );
          await this.repository.markSent(delivery.id, result.messageId);
          sent += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Lỗi gửi email không xác định.";
          await this.repository.markFailed(delivery.id, message);
          failed += 1;
        }
      }

      if (deliveries.length < this.options.batchSize) break;
    }

    return { enabled: true, claimed, sent, failed };
  }
}
