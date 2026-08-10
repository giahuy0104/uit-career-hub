import { describe, expect, it } from "vitest";

import { renderNotificationEmail } from "./email-template.js";

describe("renderNotificationEmail", () => {
  it("renders safe HTML, plain text and an absolute deep link", () => {
    const email = renderNotificationEmail(
      {
        id: "66b574d2-e399-4529-8951-7012ec24278f",
        recipientEmail: "admin@uit.edu.vn",
        notificationType: "APPLICATION_SUBMITTED",
        title: "Có hồ sơ <mới>",
        body: "Sinh viên A & B vừa ứng tuyển.",
        deepLink: "/uit/applications/123",
        dedupeKey: "application:123:submitted:admin",
        payload: {},
      },
      "https://career.uit.example",
    );

    expect(email.to).toBe("admin@uit.edu.vn");
    expect(email.subject).toBe("[UIT Career Hub] Có hồ sơ <mới>");
    expect(email.text).toContain("https://career.uit.example/uit/applications/123");
    expect(email.html).toContain("Có hồ sơ &lt;mới&gt;");
    expect(email.html).toContain("Sinh viên A &amp; B vừa ứng tuyển.");
    expect(email.html).not.toContain("Có hồ sơ <mới>");
    expect(email.idempotencyKey).toBe("notification/66b574d2-e399-4529-8951-7012ec24278f");
  });
});
