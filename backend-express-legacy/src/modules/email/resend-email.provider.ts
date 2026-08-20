import { Resend } from "resend";

import type { EmailProvider, OutboundEmail } from "./email.types.js";

export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
    resend?: Resend,
  ) {
    this.resend = resend ?? new Resend(apiKey);
  }

  async send(message: OutboundEmail) {
    const { data, error } = await this.resend.emails.send(
      {
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      { idempotencyKey: message.idempotencyKey },
    );

    if (error) {
      throw new Error(`Resend từ chối email: ${error.message}`);
    }
    if (!data?.id) {
      throw new Error("Resend không trả về mã email.");
    }

    return { messageId: data.id };
  }
}
