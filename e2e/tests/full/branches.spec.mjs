import { randomUUID } from "node:crypto";

import { accounts, apiLogin, login, logout } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";
import { getDialog, openPortalSection, selectApplication, waitForApi } from "../../support/ui.mjs";

const frontendJob = "Thực tập sinh Frontend";
const backendJob = "Thực tập sinh Backend";
const dataJob = "Thực tập sinh Data Engineer";

async function selectAdminApplication(page, jobTitle) {
  const item = page.locator(".application-review-list").getByRole("button").filter({ hasText: jobTitle });
  await expect(item).toHaveCount(1);
  await item.click();
}

test("@full UIT yêu cầu sửa tin và Company nhận phản hồi", async ({ page }) => {
  const pendingJob = "Fresher Software Engineer";
  const note = "Vui lòng bổ sung rõ thời gian làm việc và quyền lợi cho ứng viên.";

  await login(page, accounts.admin);
  await openPortalSection(page, "Duyệt tin tuyển dụng", "Duyệt tin tuyển dụng");
  await page.locator(".review-list").getByRole("button").filter({ hasText: pendingJob }).click();
  await page.getByRole("button", { name: "Yêu cầu chỉnh sửa" }).click();
  const dialog = getDialog(page, "Yêu cầu doanh nghiệp chỉnh sửa");
  await dialog.getByLabel("Lý do chi tiết *").fill(note);
  const responsePromise = waitForApi(page, "POST", "/request-revision");
  await dialog.getByRole("button", { name: "Gửi yêu cầu" }).click();
  expect((await responsePromise).status()).toBe(200);

  await logout(page);
  await login(page, accounts.companyFpt);
  await openPortalSection(page, "Tin tuyển dụng", "Tin tuyển dụng");
  await page.getByRole("button", { name: "Cần chỉnh sửa", exact: true }).click();
  const row = page.locator(".live-job-table").getByRole("button").filter({ hasText: pendingJob });
  await expect(row).toContainText(note);
  await row.click();
  await expect(getDialog(page, "Chỉnh sửa tin tuyển dụng")).toContainText(note);
});

test("@full Student nộp hồ sơ bổ sung theo yêu cầu UIT", async ({ page }) => {
  const note = "Vui lòng bổ sung bảng điểm đã được UIT xác minh.";

  await login(page, accounts.admin);
  await openPortalSection(page, "Duyệt hồ sơ sinh viên", "Duyệt hồ sơ sinh viên");
  await selectAdminApplication(page, frontendJob);
  await page.getByRole("button", { name: "Yêu cầu bổ sung" }).click();
  const requestDialog = getDialog(page, "Yêu cầu sinh viên bổ sung");
  await requestDialog.getByLabel("Lý do chi tiết *").fill(note);
  const requestResponse = waitForApi(page, "POST", "/request-supplement");
  await requestDialog.getByRole("button", { name: "Gửi yêu cầu" }).click();
  expect((await requestResponse).status()).toBe(200);

  await logout(page);
  await login(page, accounts.student);
  await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
  await selectApplication(page, frontendJob);
  await expect(page.locator(".active-application .status-pill")).toHaveText("Cần bổ sung hồ sơ");
  await page.getByRole("button", { name: "Bổ sung hồ sơ", exact: true }).click();
  const supplementDialog = getDialog(page, "Bổ sung hồ sơ");
  await expect(supplementDialog.getByText("Bang_diem_20521067.pdf", { exact: true })).toBeVisible();
  const resubmitResponse = waitForApi(page, "POST", "/resubmit");
  await supplementDialog.getByRole("button", { name: "Nộp hồ sơ bổ sung" }).click();
  expect((await resubmitResponse).status()).toBe(200);
  await expect(page.locator(".active-application .status-pill")).toHaveText("UIT đang kiểm duyệt");
});

test("@full UIT từ chối hồ sơ không đủ điều kiện", async ({ page }) => {
  await login(page, accounts.admin);
  await openPortalSection(page, "Duyệt hồ sơ sinh viên", "Duyệt hồ sơ sinh viên");
  await selectAdminApplication(page, frontendJob);
  await page.getByRole("button", { name: "Từ chối", exact: true }).click();
  const dialog = getDialog(page, "Từ chối hồ sơ ứng tuyển");
  await dialog.getByLabel("Lý do chi tiết *").fill("Hồ sơ chưa đáp ứng điều kiện tham gia đợt tuyển dụng này.");
  const rejectResponse = waitForApi(page, "POST", "/reject");
  await dialog.getByRole("button", { name: "Xác nhận từ chối" }).click();
  expect((await rejectResponse).status()).toBe(200);

  await logout(page);
  await login(page, accounts.student);
  await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
  await selectApplication(page, frontendJob);
  await expect(page.locator(".active-application .status-pill")).toHaveText("UIT từ chối");
});

test("@full Company chọn ứng viên không phù hợp", async ({ page }) => {
  await login(page, accounts.companyFpt);
  await openPortalSection(page, "Ứng viên", "Ứng viên");
  await page.getByPlaceholder("Tìm ứng viên, MSSV, vị trí...").fill(dataJob);
  const card = page.locator(".candidate-board article")
    .filter({ hasText: dataJob })
    .filter({ hasText: "20521067" });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Không phù hợp" }).click();
  const dialog = getDialog(page, "Chọn Không phù hợp");
  await dialog.getByLabel("Lý do chi tiết *").fill("Kinh nghiệm hiện tại chưa phù hợp yêu cầu của vị trí.");
  const rejectResponse = waitForApi(page, "POST", "/reject");
  await dialog.getByRole("button", { name: "Xác nhận không phù hợp" }).click();
  expect((await rejectResponse).status()).toBe(200);
  await expect(page.getByText("Đã ghi nhận ứng viên không phù hợp.")).toBeVisible();
});

test("@full Student rút đơn khi Company đang xem", async ({ page }) => {
  await login(page, accounts.student);
  await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
  await selectApplication(page, dataJob);
  await page.getByRole("button", { name: "Rút đơn", exact: true }).click();
  const dialog = getDialog(page, "Rút đơn ứng tuyển?");
  await dialog.getByLabel("Lý do chi tiết *").fill("Tôi thay đổi kế hoạch học tập trong học kỳ này.");
  const withdrawResponse = waitForApi(page, "POST", "/withdraw");
  await dialog.getByRole("button", { name: "Xác nhận rút đơn" }).click();
  expect((await withdrawResponse).status()).toBe(200);
  await expect(page.locator(".active-application .status-pill")).toHaveText("Đã rút đơn");
});

test("@full Student hủy tham gia phỏng vấn", async ({ page, request }) => {
  const accessToken = await apiLogin(request, accounts.companyFpt);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const scheduleResponse = await request.post(
    "http://127.0.0.1:3100/api/v1/companies/me/applications/00000000-0000-4000-8000-000000008005/interviews",
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "Idempotency-Key": randomUUID(),
      },
      data: {
        scheduledAt: `${tomorrow}T09:30:00+07:00`,
        timeZone: "Asia/Ho_Chi_Minh",
        mode: "PHONE",
        interviewerName: "Phan Minh Anh",
      },
    },
  );
  expect(scheduleResponse.status()).toBe(201);

  await login(page, accounts.studentAuxiliary);
  await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
  await selectApplication(page, dataJob);
  await page.getByRole("button", { name: "Hủy tham gia PV", exact: true }).click();
  const dialog = getDialog(page, "Hủy tham gia phỏng vấn?");
  await dialog.getByLabel("Lý do chi tiết *").fill("Lịch phỏng vấn trùng với lịch thi bắt buộc của trường.");
  const cancelResponse = waitForApi(page, "POST", "/cancel-interview");
  await dialog.getByRole("button", { name: "Xác nhận hủy tham gia" }).click();
  expect((await cancelResponse).status()).toBe(200);
  await expect(page.locator(".active-application .status-pill")).toHaveText("Đã rút đơn");
});

test("@full Student từ chối offer", async ({ page }) => {
  await login(page, accounts.student);
  await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
  await selectApplication(page, backendJob);
  await page.getByRole("button", { name: "Từ chối", exact: true }).click();
  const dialog = getDialog(page, "Từ chối offer");
  await dialog.getByLabel("Lý do *").fill("Tôi đã chọn một cơ hội khác phù hợp hơn với định hướng cá nhân.");
  const declineResponse = waitForApi(page, "POST", "/offer/decline");
  await dialog.getByRole("button", { name: "Xác nhận từ chối" }).click();
  expect((await declineResponse).status()).toBe(200);
  await expect(page.locator(".active-application .status-pill")).toHaveText("Đã từ chối offer");
});
