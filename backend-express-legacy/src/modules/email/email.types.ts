export type ClaimedEmailDelivery = {
  id: string;
  recipientEmail: string;
  notificationType: string;
  title: string;
  body: string;
  deepLink: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
};

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailProvider = {
  send(message: OutboundEmail): Promise<{ messageId: string }>;
};

export type EmailDispatchSummary = {
  enabled: boolean;
  claimed: number;
  sent: number;
  failed: number;
};
