import type { Resend } from "resend";
import { describe, expect, it, vi } from "vitest";

import { ResendEmailProvider } from "./resend-email.provider.js";

describe("ResendEmailProvider", () => {
  it("sends HTML and text with a stable idempotency key", async () => {
    const send = vi.fn(async () => ({ data: { id: "resend-email-id" }, error: null }));
    const provider = new ResendEmailProvider(
      "re_test_key",
      "UIT Career Hub <notifications@example.com>",
      { emails: { send } } as unknown as Resend,
    );

    await expect(provider.send({
      to: "admin@uit.edu.vn",
      subject: "Có hồ sơ mới",
      html: "<p>Có hồ sơ mới</p>",
      text: "Có hồ sơ mới",
      idempotencyKey: "notification/66b574d2-e399-4529-8951-7012ec24278f",
    })).resolves.toEqual({ messageId: "resend-email-id" });

    expect(send).toHaveBeenCalledWith(
      {
        from: "UIT Career Hub <notifications@example.com>",
        to: "admin@uit.edu.vn",
        subject: "Có hồ sơ mới",
        html: "<p>Có hồ sơ mới</p>",
        text: "Có hồ sơ mới",
      },
      { idempotencyKey: "notification/66b574d2-e399-4529-8951-7012ec24278f" },
    );
  });

  it("surfaces provider errors without exposing the API key", async () => {
    const send = vi.fn(async () => ({
      data: null,
      error: { name: "validation_error", message: "sender domain is not verified" },
    }));
    const provider = new ResendEmailProvider(
      "re_secret_that_must_not_appear",
      "UIT Career Hub <notifications@example.com>",
      { emails: { send } } as unknown as Resend,
    );

    await expect(provider.send({
      to: "admin@uit.edu.vn",
      subject: "Thông báo",
      html: "<p>Thông báo</p>",
      text: "Thông báo",
      idempotencyKey: "notification/test",
    })).rejects.toThrow("sender domain is not verified");
    await expect(provider.send({
      to: "admin@uit.edu.vn",
      subject: "Thông báo",
      html: "<p>Thông báo</p>",
      text: "Thông báo",
      idempotencyKey: "notification/test-2",
    })).rejects.not.toThrow("re_secret_that_must_not_appear");
  });
});
