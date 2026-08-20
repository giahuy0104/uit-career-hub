import { describe, expect, it, vi } from "vitest";

import type { EmailDeliveryRepository } from "./email-delivery.repository.js";
import { EmailDeliveryService } from "./email-delivery.service.js";
import type { EmailProvider } from "./email.types.js";

const deliveries = [
  {
    id: "f15b12ab-f9de-4651-820f-1b6c6f51af10",
    recipientEmail: "admin@uit.edu.vn",
    notificationType: "APPLICATION_SUBMITTED",
    title: "Có hồ sơ mới",
    body: "Có đơn mới cần UIT xử lý.",
    deepLink: "/uit/applications/1",
    dedupeKey: "application:1:submitted:admin",
    payload: {},
  },
  {
    id: "c0cfa305-8893-4cea-a2dc-25c3a5eb9dc8",
    recipientEmail: "recruiter@example.com",
    notificationType: "APPLICATION_RECEIVED",
    title: "Có ứng viên mới",
    body: "UIT đã chuyển hồ sơ.",
    deepLink: "/company/candidates/2",
    dedupeKey: "application:2:company:recruiter",
    payload: {},
  },
];

function repositoryMock() {
  return {
    claimPending: vi.fn(async () => deliveries),
    markSent: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  };
}

describe("EmailDeliveryService", () => {
  it("does not claim deliveries when email is disabled", async () => {
    const repository = repositoryMock();
    const service = new EmailDeliveryService(
      repository as unknown as EmailDeliveryRepository,
      null,
      { appBaseUrl: "https://career.uit.example", batchSize: 25, maxAttempts: 5 },
    );

    await expect(service.dispatchPending()).resolves.toEqual({
      enabled: false,
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    expect(repository.claimPending).not.toHaveBeenCalled();
  });

  it("marks successful and failed sends independently", async () => {
    const repository = repositoryMock();
    const send = vi.fn()
      .mockResolvedValueOnce({ messageId: "email-1" })
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const service = new EmailDeliveryService(
      repository as unknown as EmailDeliveryRepository,
      { send } as EmailProvider,
      { appBaseUrl: "https://career.uit.example", batchSize: 10, maxAttempts: 3 },
    );

    await expect(service.dispatchPending("50e870cb-61b3-4fe9-96c0-1288360f78b1")).resolves.toEqual({
      enabled: true,
      claimed: 2,
      sent: 1,
      failed: 1,
    });
    expect(repository.claimPending).toHaveBeenCalledWith({
      resourceId: "50e870cb-61b3-4fe9-96c0-1288360f78b1",
      limit: 10,
      maxAttempts: 3,
    });
    expect(repository.markSent).toHaveBeenCalledWith(deliveries[0]!.id, "email-1");
    expect(repository.markFailed).toHaveBeenCalledWith(deliveries[1]!.id, "provider unavailable");
    expect(send.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      to: "admin@uit.edu.vn",
      idempotencyKey: `notification/${deliveries[0]!.id}`,
    }));
  });

  it("drains every due delivery when the queue spans multiple database batches", async () => {
    const repository = repositoryMock();
    repository.claimPending
      .mockResolvedValueOnce([deliveries[0]!])
      .mockResolvedValueOnce([deliveries[1]!])
      .mockResolvedValueOnce([]);
    const send = vi.fn(async () => ({ messageId: "email-sent" }));
    const service = new EmailDeliveryService(
      repository as unknown as EmailDeliveryRepository,
      { send } as EmailProvider,
      { appBaseUrl: "https://career.uit.example", batchSize: 1, maxAttempts: 3 },
    );

    await expect(service.dispatchPending()).resolves.toEqual({
      enabled: true,
      claimed: 2,
      sent: 2,
      failed: 0,
    });
    expect(repository.claimPending).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
