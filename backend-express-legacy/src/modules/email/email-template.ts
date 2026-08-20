import type { ClaimedEmailDelivery, OutboundEmail } from "./email.types.js";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteDeepLink(appBaseUrl: string, deepLink: string) {
  return new URL(deepLink, appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`).toString();
}

export function renderNotificationEmail(
  delivery: ClaimedEmailDelivery,
  appBaseUrl: string,
): OutboundEmail {
  const actionUrl = absoluteDeepLink(appBaseUrl, delivery.deepLink);
  const title = escapeHtml(delivery.title);
  const body = escapeHtml(delivery.body);
  const safeActionUrl = escapeHtml(actionUrl);

  return {
    to: delivery.recipientEmail,
    subject: `[UIT Career Hub] ${delivery.title}`,
    text: `${delivery.title}\n\n${delivery.body}\n\nXem chi tiết: ${actionUrl}`,
    html: `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #dfe6f1;border-radius:12px;padding:28px">
        <div style="font-size:13px;font-weight:700;color:#0b57d0;margin-bottom:16px">UIT CAREER HUB</div>
        <h1 style="font-size:22px;line-height:1.35;margin:0 0 12px">${title}</h1>
        <p style="font-size:15px;line-height:1.7;margin:0 0 24px">${body}</p>
        <a href="${safeActionUrl}" style="display:inline-block;background:#0b57d0;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Xem chi tiết</a>
        <p style="font-size:12px;line-height:1.6;color:#667085;margin:28px 0 0">Email tự động từ hệ thống UIT Career Hub. Vui lòng không gửi hồ sơ hoặc thông tin nhạy cảm bằng cách trả lời email này.</p>
      </div>
    </div>
  </body>
</html>`,
    idempotencyKey: `notification/${delivery.id}`,
  };
}
