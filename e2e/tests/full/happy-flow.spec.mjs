import { accounts, login, logout } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";
import {
  openPortalSection,
  getDialog,
  selectApplication,
  selectCompanyCandidate,
  waitForApi,
} from "../../support/ui.mjs";

const jobTitle = "E2E Thực tập sinh Fullstack";

test("@full happy flow ba vai trò đến placement", async ({ page }) => {
  await test.step("Company tạo và gửi tin", async () => {
    await login(page, accounts.company);
    await expect(page.getByRole("heading", { name: "Tổng quan tuyển dụng", level: 1 })).toBeVisible();
    await openPortalSection(page, "Tin tuyển dụng", "Tin tuyển dụng");
    await page.getByRole("button", { name: "Tạo tin tuyển dụng", exact: true }).click();

    const dialog = getDialog(page, "Tạo tin tuyển dụng");
    await dialog.getByLabel("Tên vị trí *").fill(jobTitle);
    await dialog.getByLabel("Địa điểm *").fill("TP. Hồ Chí Minh");
    await dialog.getByLabel("Mô tả công việc *").fill("Phát triển và kiểm thử tính năng web trong nhóm sản phẩm UIT Career Hub.");
    await dialog.getByLabel("Yêu cầu ứng viên *").fill("Nắm vững JavaScript, React và nền tảng API REST.");
    await dialog.getByLabel("Quyền lợi").fill("Được mentor kỹ thuật và tham gia quy trình phát triển sản phẩm thực tế.");

    const submitResponse = waitForApi(page, "POST", "/companies/me/jobs/");
    await dialog.getByRole("button", { name: "Lưu & gửi UIT duyệt" }).click();
    const response = await submitResponse;
    expect(response.url()).toMatch(/\/submit$/);
    expect(response.status()).toBe(200);
    await expect(page.locator(".live-job-table").getByText(jobTitle, { exact: true })).toBeVisible();
  });

  await test.step("UIT duyệt tin", async () => {
    await logout(page);
    await login(page, accounts.admin);
    await expect(page.getByRole("heading", { name: "Tổng quan vận hành", level: 1 })).toBeVisible();
    await openPortalSection(page, "Duyệt tin tuyển dụng", "Duyệt tin tuyển dụng");

    await page.locator(".review-list").getByRole("button").filter({ hasText: jobTitle }).click();
    page.once("dialog", (dialog) => dialog.accept());
    const approveResponse = waitForApi(page, "POST", "/approve");
    await page.getByRole("button", { name: "Phê duyệt & công khai" }).click();
    expect((await approveResponse).status()).toBe(200);
    await expect(page.getByText("Tin đã được phê duyệt và công khai.")).toBeVisible();
  });

  await test.step("Student ứng tuyển hai bước", async () => {
    await logout(page);
    await login(page, accounts.student);
    await expect(page.getByRole("heading", { name: "Tổng quan", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Việc làm", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Cơ hội dành cho bạn" })).toBeVisible();
    await page.getByLabel("Tìm việc làm").fill(jobTitle);
    await page.locator(".job-row").filter({ hasText: jobTitle }).click();
    await page.getByRole("button", { name: "Ứng tuyển", exact: true }).click();

    await expect(page.getByRole("heading", { name: `Ứng tuyển ${jobTitle}` })).toBeVisible();
    await page.locator("label.consent input[type=checkbox]").check();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    const applyResponse = waitForApi(page, "POST", "/applications");
    await page.getByRole("button", { name: "Gửi đơn ứng tuyển" }).click();
    expect((await applyResponse).status()).toBe(201);
    await expect(page.getByRole("heading", { name: "Đơn ứng tuyển của tôi" })).toBeVisible();
    await selectApplication(page, jobTitle);
    await expect(page.locator(".active-application .status-pill")).toHaveText("UIT đang kiểm duyệt");
  });

  await test.step("UIT chuyển hồ sơ", async () => {
    await logout(page);
    await login(page, accounts.admin);
    await openPortalSection(page, "Duyệt hồ sơ sinh viên", "Duyệt hồ sơ sinh viên");
    await page.locator(".application-review-list").getByRole("button").filter({ hasText: jobTitle }).click();
    await page.getByRole("button", { name: "Duyệt & chuyển doanh nghiệp" }).click();
    const dialog = getDialog(page, "Chuyển hồ sơ đến doanh nghiệp?");
    const forwardResponse = waitForApi(page, "POST", "/forward");
    await dialog.getByRole("button", { name: "Xác nhận chuyển" }).click();
    expect((await forwardResponse).status()).toBe(200);
    await expect(page.getByText("Hồ sơ đã được chuyển đến đúng doanh nghiệp.")).toBeVisible();
  });

  await test.step("Company sàng lọc, đặt lịch và gửi offer", async () => {
    await logout(page);
    await login(page, accounts.company);
    await openPortalSection(page, "Ứng viên", "Ứng viên");
    let candidate = await selectCompanyCandidate(page, jobTitle);

    const startReviewResponse = waitForApi(page, "POST", "/start-review");
    await candidate.getByRole("button", { name: "Bắt đầu xem" }).click();
    expect((await startReviewResponse).status()).toBe(200);

    candidate = await selectCompanyCandidate(page, jobTitle);
    await candidate.getByRole("button", { name: "Mời PV" }).click();
    const interviewDialog = getDialog(page, "Mời ứng viên phỏng vấn");
    await interviewDialog.getByLabel("Đường dẫn tham gia *").fill("https://meet.google.com/e2e-uit-career-hub");
    const interviewResponse = waitForApi(page, "POST", "/interviews");
    await interviewDialog.getByRole("button", { name: "Gửi lời mời" }).click();
    expect((await interviewResponse).status()).toBe(201);

    candidate = await selectCompanyCandidate(page, jobTitle);
    await candidate.getByRole("button", { name: "Đạt & offer" }).click();
    const offerDialog = getDialog(page, "Gửi offer cho ứng viên");
    const offerResponse = waitForApi(page, "POST", "/results");
    await offerDialog.getByRole("button", { name: "Gửi offer", exact: true }).click();
    expect((await offerResponse).status()).toBe(200);
    await expect(page.getByText("Đã gửi offer và chờ sinh viên phản hồi.")).toBeVisible();
  });

  await test.step("Student nhận offer", async () => {
    await logout(page);
    await login(page, accounts.student);
    await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
    await selectApplication(page, jobTitle);
    await page.getByRole("button", { name: "Nhận offer", exact: true }).click();
    const dialog = getDialog(page, "Xác nhận nhận offer");
    const acceptResponse = waitForApi(page, "POST", "/offer/accept");
    await dialog.getByRole("button", { name: "Xác nhận nhận offer" }).click();
    expect((await acceptResponse).status()).toBe(200);
    await expect(page.getByText("Bạn đã nhận offer. UIT sẽ xác nhận nơi thực tập ở bước tiếp theo.")).toBeVisible();
    await expect(page.locator(".active-application .status-pill")).toHaveText("Chờ UIT xác nhận");
  });

  await test.step("UIT xác nhận placement", async () => {
    await logout(page);
    await login(page, accounts.admin);
    await openPortalSection(page, "Theo dõi kết quả", "Theo dõi kết quả tuyển dụng");
    await page.locator(".application-review-list").getByRole("button").filter({ hasText: jobTitle }).click();
    await page.getByRole("button", { name: "Xác nhận nơi thực tập", exact: true }).click();
    const dialog = getDialog(page, "Xác nhận nơi thực tập");
    const placementResponse = waitForApi(page, "POST", "/confirm-placement");
    await dialog.getByRole("button", { name: "Xác nhận & đóng đơn khác" }).click();
    expect((await placementResponse).status()).toBe(200);
    await expect(page.locator(".toast").filter({ hasText: /Đã xác nhận .* nhận việc/ })).toBeVisible();
  });

  await test.step("UIT theo dõi kỳ thực tập đến hoàn thành", async () => {
    await expect(page.getByRole("heading", { name: "Vòng đời thực tập", level: 2 })).toBeVisible();
    const placementRow = page.locator(".placement-lifecycle-list").getByRole("button").filter({ hasText: jobTitle });
    await expect(placementRow).toBeVisible();
    await placementRow.click();

    await page.getByRole("button", { name: "Ghi nhận bắt đầu", exact: true }).click();
    let dialog = getDialog(page, "Ghi nhận bắt đầu thực tập");
    const startResponse = waitForApi(page, "POST", "/uit/placements/");
    await dialog.getByRole("button", { name: "Xác nhận bắt đầu" }).click();
    expect((await startResponse).url()).toMatch(/\/start$/);
    await expect(page.getByTestId("placement-lifecycle-detail")).toContainText("Đang thực tập");

    await page.getByRole("button", { name: "Ghi nhận hoàn thành", exact: true }).click();
    dialog = getDialog(page, "Xác nhận hoàn thành thực tập");
    const completeResponse = waitForApi(page, "POST", "/uit/placements/");
    await dialog.getByRole("button", { name: "Xác nhận hoàn thành" }).click();
    expect((await completeResponse).url()).toMatch(/\/complete$/);
    await expect(page.getByTestId("placement-lifecycle-detail")).toContainText("Đã hoàn thành");
    await expect(page.getByText("Kỳ thực tập đã hoàn tất")).toBeVisible();
  });

  await test.step("Student thấy trạng thái đã nhận việc", async () => {
    await logout(page);
    await login(page, accounts.student);
    await page.getByRole("button", { name: "Đơn ứng tuyển", exact: true }).first().click();
    await selectApplication(page, jobTitle);
    await expect(page.locator(".active-application .status-pill")).toHaveText("Đã nhận việc");
  });
});
