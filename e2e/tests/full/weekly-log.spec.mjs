import { accounts, login, logout } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";
import { getDialog, openPortalSection, waitForApi } from "../../support/ui.mjs";

async function openWeek(page, weekNumber) {
  const week = page.locator(".weekly-log-list button").filter({ hasText: `Tuần ${weekNumber}` });
  await expect(week).toBeVisible();
  await week.click();
}

test("@full nhật ký thực tập tuần qua đủ ba vai trò", async ({ page }) => {
  await test.step("UIT thấy hàng đợi quá hạn và số liệu toàn trường", async () => {
    await login(page, accounts.admin);
    await openPortalSection(page, "Quản lý thực tập", "Quản lý thực tập");
    await expect(page.locator(".weekly-global-summary")).toContainText("1 nhật ký quá hạn cần theo dõi");
    await openWeek(page, 2);
    await expect(page.locator(".weekly-log-detail")).toContainText("Quá hạn");
    await expect(page.locator(".weekly-log-detail")).not.toContainText("Xác nhận nhật ký");
  });

  await test.step("Sinh viên cập nhật và nộp nhật ký quá hạn", async () => {
    await logout(page);
    await login(page, accounts.student);
    await openPortalSection(page, "Quá trình thực tập", "Quá trình thực tập");
    await openWeek(page, 2);
    await page.getByLabel("Kết quả đạt được *").fill("Hoàn thành API, bộ kiểm thử đơn vị và tài liệu mô tả endpoint.");
    await page.getByLabel("Kế hoạch tuần tiếp theo *").fill("Tích hợp API vào luồng chính và bổ sung kiểm thử tích hợp.");

    let response = waitForApi(page, "PUT", "/weekly-logs/");
    await page.getByRole("button", { name: "Lưu nhật ký" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByText("Đã lưu nhật ký tuần 2.")).toBeVisible();

    response = waitForApi(page, "POST", "/submit");
    await page.getByRole("button", { name: "Nộp nhật ký" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator(".weekly-log-detail")).toContainText("Chờ doanh nghiệp");
  });

  await test.step("Doanh nghiệp yêu cầu chỉnh sửa", async () => {
    await logout(page);
    await login(page, accounts.company);
    await openPortalSection(page, "Sinh viên thực tập", "Sinh viên thực tập");
    await openWeek(page, 2);
    await page.getByRole("button", { name: "Yêu cầu sửa" }).click();
    const dialog = getDialog(page, "Yêu cầu chỉnh sửa nhật ký");
    await dialog.getByLabel("Nhóm lý do *").selectOption("OUTCOME_NEEDS_EVIDENCE");
    await dialog.getByLabel("Góp ý chi tiết *").fill("Vui lòng bổ sung kết quả kiểm thử và sản phẩm đã bàn giao trong tuần.");
    const response = waitForApi(page, "POST", "/request-revision");
    await dialog.getByRole("button", { name: "Gửi yêu cầu" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator(".weekly-log-detail")).toContainText("Cần chỉnh sửa");
  });

  await test.step("Sinh viên sửa và nộp lại", async () => {
    await logout(page);
    await login(page, accounts.student);
    await openPortalSection(page, "Quá trình thực tập", "Quá trình thực tập");
    await openWeek(page, 2);
    await expect(page.getByText("Vui lòng bổ sung kết quả kiểm thử và sản phẩm đã bàn giao trong tuần.")).toBeVisible();
    await page.getByLabel("Kết quả đạt được *").fill("Hoàn thành 18 ca kiểm thử; bàn giao mã nguồn, báo cáo coverage và tài liệu endpoint cho mentor.");
    let response = waitForApi(page, "PUT", "/weekly-logs/");
    await page.getByRole("button", { name: "Lưu nhật ký" }).click();
    expect((await response).status()).toBe(200);
    response = waitForApi(page, "POST", "/submit");
    await page.getByRole("button", { name: "Nộp nhật ký" }).click();
    expect((await response).status()).toBe(200);
  });

  await test.step("Doanh nghiệp xác nhận và UIT thấy lịch sử hoàn chỉnh", async () => {
    await logout(page);
    await login(page, accounts.company);
    await openPortalSection(page, "Sinh viên thực tập", "Sinh viên thực tập");
    await openWeek(page, 2);
    await page.getByRole("button", { name: "Xác nhận nhật ký" }).click();
    let dialog = getDialog(page, "Xác nhận nhật ký tuần");
    let response = waitForApi(page, "POST", "/confirm");
    await dialog.getByRole("button", { name: "Xác nhận nhật ký" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator(".weekly-log-detail")).toContainText("Đã xác nhận");

    await logout(page);
    await login(page, accounts.admin);
    await openPortalSection(page, "Quản lý thực tập", "Quản lý thực tập");
    await openWeek(page, 2);
    await expect(page.locator(".weekly-log-detail")).toContainText("Đã xác nhận");
    await expect(page.locator(".weekly-log-history li")).toHaveCount(4);
    await expect(page.locator(".weekly-global-summary")).toContainText("0 nhật ký quá hạn cần theo dõi");
  });
});
