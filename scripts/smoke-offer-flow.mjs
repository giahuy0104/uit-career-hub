import { randomUUID } from "node:crypto";

const apiBaseUrl = (process.env.E2E_API_BASE_URL || "http://localhost:3000/api/v1").replace(/\/$/, "");
const primaryApplicationId = "00000000-0000-4000-8000-000000008004";
const secondaryApplicationId = "00000000-0000-4000-8000-000000008005";

function assertMutationIsAllowed() {
  if (process.env.E2E_CONFIRM_DEMO_MUTATION !== "true") {
    throw new Error(
      "Smoke test sẽ thay đổi checkpoint demo. Đặt E2E_CONFIRM_DEMO_MUTATION=true sau khi đã kiểm tra đúng database.",
    );
  }
  const target = new URL(apiBaseUrl);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
  if (!isLocal && process.env.E2E_ALLOW_REMOTE !== "true") {
    throw new Error(
      `Từ chối chạy trên host ${target.hostname}. Chỉ đặt E2E_ALLOW_REMOTE=true với môi trường demo riêng, không dùng production.`,
    );
  }
}

async function apiRequest(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(method === "POST" && !path.includes("/auth/") ? { "idempotency-key": randomUUID() } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} trả ${response.status}: ${payload?.error?.message || response.statusText}`);
  }
  return payload?.data;
}

async function login(email, password) {
  const session = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  if (!session?.accessToken) throw new Error(`Không nhận được access token cho ${email}.`);
  return session.accessToken;
}

function createPdf() {
  const stream = "BT /F1 20 Tf 72 720 Td (UIT Career Hub offer smoke test) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

async function verifyPrivatePdf(downloadUrl, actorLabel) {
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`${actorLabel} không tải được PDF từ URL ký trước (${response.status}).`);
  const prefix = Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString("ascii");
  if (prefix !== "%PDF-") throw new Error(`${actorLabel} nhận object không phải PDF.`);
}

function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  assertMutationIsAllowed();
  const pdf = createPdf();
  const startDate = futureDate(30);
  const passwords = {
    company: process.env.E2E_COMPANY_PASSWORD || "Company@12345",
    student: process.env.E2E_STUDENT_PASSWORD || "Student@12345",
    admin: process.env.E2E_ADMIN_PASSWORD || "Admin@12345",
  };

  console.log(`Smoke target: ${apiBaseUrl}`);
  const companyToken = await login("recruiter@vng.example", passwords.company);
  const candidates = await apiRequest("/companies/me/candidates?page=1&pageSize=100", { token: companyToken });
  const candidate = candidates.find((item) => item.id === primaryApplicationId);
  if (candidate?.status !== "INTERVIEW_INVITED") {
    throw new Error("Checkpoint offer không ở INTERVIEW_INVITED. Hãy chạy db:demo:reset và db:demo:check.");
  }
  console.log("PASS 1/8 · Doanh nghiệp nhìn thấy ứng viên chờ kết quả phỏng vấn.");

  const intent = await apiRequest(
    `/companies/me/applications/${primaryApplicationId}/offer-document/uploads`,
    {
      token: companyToken,
      method: "POST",
      body: {
        fileName: "offer-smoke-uit-career-hub.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: pdf.length,
      },
    },
  );
  const upload = await fetch(intent.uploadUrl, {
    method: intent.method,
    headers: intent.headers,
    body: pdf,
  });
  if (!upload.ok) throw new Error(`R2 PUT trả ${upload.status}: ${upload.statusText}`);
  await apiRequest(
    `/companies/me/applications/${primaryApplicationId}/offer-document/uploads/${intent.uploadId}/complete`,
    { token: companyToken, method: "POST" },
  );
  console.log("PASS 2/8 · PDF đã upload và được backend xác minh trên R2.");

  const offered = await apiRequest(`/companies/me/applications/${primaryApplicationId}/results`, {
    token: companyToken,
    method: "POST",
    body: { outcome: "PASS", startDate, offerUploadId: intent.uploadId },
  });
  if (offered.status !== "OFFER_PENDING_STUDENT" || !offered.recruitmentResult?.offerDocument) {
    throw new Error("Kết quả PASS không tạo offerDocument hoặc sai trạng thái.");
  }
  const companyDownload = await apiRequest(
    `/companies/me/applications/${primaryApplicationId}/offer-document/download`,
    { token: companyToken, method: "POST" },
  );
  await verifyPrivatePdf(companyDownload.downloadUrl, "Doanh nghiệp");
  console.log("PASS 3/8 · Doanh nghiệp mở lại đúng PDF offer.");

  const studentToken = await login("21520881@student.uit.edu.vn", passwords.student);
  const applications = await apiRequest("/applications?page=1&pageSize=100", { token: studentToken });
  const studentOffer = applications.find((item) => item.id === primaryApplicationId);
  if (!studentOffer?.recruitmentResult?.offerDocument) throw new Error("Sinh viên không nhìn thấy PDF offer.");
  const studentDownload = await apiRequest(`/applications/${primaryApplicationId}/offer-document/download`, {
    token: studentToken,
    method: "POST",
  });
  await verifyPrivatePdf(studentDownload.downloadUrl, "Sinh viên");
  console.log("PASS 4/8 · Sinh viên mở được PDF offer.");

  const accepted = await apiRequest(`/applications/${primaryApplicationId}/offer/accept`, {
    token: studentToken,
    method: "POST",
  });
  if (accepted.status !== "ACCEPTED_PENDING_UIT_CONFIRMATION") {
    throw new Error(`Nhận offer tạo trạng thái không hợp lệ: ${accepted.status}`);
  }
  console.log("PASS 5/8 · Sinh viên nhận offer và chuyển sang chờ UIT xác nhận.");

  const adminToken = await login("admin.career@uit.edu.vn", passwords.admin);
  const placementQueue = await apiRequest("/uit/applications/placement-queue?page=1&pageSize=100", {
    token: adminToken,
  });
  const placement = placementQueue.find((item) => item.id === primaryApplicationId);
  if (!placement?.recruitmentResult?.offerDocument) throw new Error("UIT không nhìn thấy PDF trong hàng đợi placement.");
  const adminDownload = await apiRequest(`/uit/applications/${primaryApplicationId}/offer-document/download`, {
    token: adminToken,
    method: "POST",
  });
  await verifyPrivatePdf(adminDownload.downloadUrl, "UIT");
  console.log("PASS 6/8 · UIT mở được PDF trước khi xác nhận placement.");

  const confirmed = await apiRequest(`/uit/applications/${primaryApplicationId}/confirm-placement`, {
    token: adminToken,
    method: "POST",
    body: { startDate, note: "Smoke test E2E đã đối chiếu PDF offer." },
  });
  if (confirmed.selectedApplication?.status !== "HIRED") throw new Error("UIT xác nhận nhưng đơn chưa chuyển HIRED.");
  if (!confirmed.autoWithdrawnApplicationIds?.includes(secondaryApplicationId)) {
    throw new Error("Đơn đang hoạt động còn lại chưa được tự đóng.");
  }
  console.log("PASS 7/8 · UIT xác nhận và hệ thống tự đóng đơn còn lại.");

  const withdrawn = await apiRequest(`/applications/${secondaryApplicationId}`, { token: studentToken });
  if (withdrawn.status !== "WITHDRAWN" || withdrawn.timeline.at(-1)?.reasonCode !== "ACCEPTED_OTHER_JOB") {
    throw new Error("Đơn phụ không lưu đúng trạng thái/lý do tự rút.");
  }
  console.log("PASS 8/8 · Sinh viên thấy đơn phụ WITHDRAWN cùng lịch sử ACCEPTED_OTHER_JOB.");
  console.log("Smoke test offer E2E hoàn tất. Chạy lại db:demo:reset để khôi phục checkpoint.");
}

main().catch((error) => {
  console.error(`FAIL · ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
