import { accounts, login, logout } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";
import { getDialog, openPortalSection, waitForApi } from "../../support/ui.mjs";

test("@full kế hoạch thực tập qua đủ ba vai trò và hai vòng chỉnh sửa", async ({ page }) => {
  await test.step("Sinh viên tạo, lưu nháp và nộp kế hoạch", async () => {
    await login(page, accounts.student);
    await openPortalSection(page, "Quá trình thực tập", "Quá trình thực tập");

    await page.getByLabel("Tên kế hoạch / vị trí thực tập").fill("Kế hoạch thực tập Platform Engineering");
    await page.getByLabel("Bộ phận thực tập").fill("Platform Engineering");
    await page.getByLabel("Người hướng dẫn tại doanh nghiệp").fill("Nguyễn Hoàng Nam");
    await page.getByLabel("Email người hướng dẫn").fill("nam@vng.example");
    await page.getByLabel("Ngày kết thúc").fill("2026-12-15");
    await page.getByLabel("Mục tiêu thực tập").fill("Hiểu quy trình phát triển và vận hành một dịch vụ nội bộ.");
    await page.getByLabel("Công việc dự kiến").fill("Phát triển REST API, viết kiểm thử và tham gia theo dõi hệ thống.");
    await page.getByLabel("Kỹ năng dự kiến phát triển").fill("Java, Spring Boot, PostgreSQL và làm việc nhóm.");

    const saveResponse = waitForApi(page, "PUT", "/student/internships/");
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(page.getByText("Đã lưu bản nháp kế hoạch thực tập.")).toBeVisible();

    const submitResponse = waitForApi(page, "POST", "/plan/submit");
    await page.getByRole("button", { name: "Nộp kế hoạch" }).click();
    expect((await submitResponse).status()).toBe(200);
    await expect(page.locator(".internship-detail-panel")).toContainText("Chờ doanh nghiệp duyệt");
  });

  await test.step("Doanh nghiệp yêu cầu chỉnh sửa", async () => {
    await logout(page);
    await login(page, accounts.company);
    await openPortalSection(page, "Sinh viên thực tập", "Sinh viên thực tập");
    await page.getByRole("button", { name: "Yêu cầu sửa" }).click();

    const dialog = getDialog(page, "Yêu cầu chỉnh sửa kế hoạch");
    await dialog.getByLabel("Nhóm lý do *").selectOption("LEARNING_OUTCOMES_NEED_DETAIL");
    await dialog.getByLabel("Góp ý chi tiết *").fill("Vui lòng bổ sung sản phẩm bàn giao dự kiến cho từng nhóm công việc.");
    const revisionResponse = waitForApi(page, "POST", "/plan/request-revision");
    await dialog.getByRole("button", { name: "Gửi yêu cầu" }).click();
    expect((await revisionResponse).status()).toBe(200);
    await expect(page.locator(".internship-detail-panel")).toContainText("Doanh nghiệp yêu cầu sửa");
  });

  await test.step("Sinh viên sửa, nộp lại và doanh nghiệp xác nhận", async () => {
    await logout(page);
    await login(page, accounts.student);
    await openPortalSection(page, "Quá trình thực tập", "Quá trình thực tập");
    await expect(page.getByText("Vui lòng bổ sung sản phẩm bàn giao dự kiến cho từng nhóm công việc.")).toBeVisible();
    await page.getByLabel("Công việc dự kiến").fill("Phát triển REST API; bàn giao mã nguồn, bộ kiểm thử và tài liệu vận hành cuối kỳ.");
    let response = waitForApi(page, "PUT", "/student/internships/");
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    expect((await response).status()).toBe(200);
    response = waitForApi(page, "POST", "/plan/submit");
    await page.getByRole("button", { name: "Nộp kế hoạch" }).click();
    expect((await response).status()).toBe(200);

    await logout(page);
    await login(page, accounts.company);
    await openPortalSection(page, "Sinh viên thực tập", "Sinh viên thực tập");
    await page.getByRole("button", { name: "Xác nhận" }).click();
    const dialog = getDialog(page, "Xác nhận kế hoạch");
    response = waitForApi(page, "POST", "/plan/confirm");
    await dialog.getByRole("button", { name: "Xác nhận kế hoạch" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator(".internship-detail-panel")).toContainText("Chờ UIT duyệt");
  });

  await test.step("UIT yêu cầu sửa, sinh viên nộp thẳng lại UIT", async () => {
    await logout(page);
    await login(page, accounts.admin);
    await openPortalSection(page, "Quản lý thực tập", "Quản lý thực tập");
    await page.getByRole("button", { name: "Yêu cầu sửa" }).click();
    let dialog = getDialog(page, "Yêu cầu chỉnh sửa kế hoạch");
    await dialog.getByLabel("Nhóm lý do *").selectOption("TIMELINE_NEEDS_ADJUSTMENT");
    await dialog.getByLabel("Góp ý chi tiết *").fill("Vui lòng diễn giải rõ hơn mục tiêu gắn với chuẩn đầu ra học phần.");
    let response = waitForApi(page, "POST", "/plan/request-revision");
    await dialog.getByRole("button", { name: "Gửi yêu cầu" }).click();
    expect((await response).status()).toBe(200);

    await logout(page);
    await login(page, accounts.student);
    await openPortalSection(page, "Quá trình thực tập", "Quá trình thực tập");
    await page.getByLabel("Mục tiêu thực tập").fill("Vận dụng kiến thức thiết kế API, kiểm thử và cơ sở dữ liệu để hoàn thành sản phẩm theo chuẩn đầu ra học phần.");
    response = waitForApi(page, "PUT", "/student/internships/");
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    expect((await response).status()).toBe(200);
    response = waitForApi(page, "POST", "/plan/submit");
    await page.getByRole("button", { name: "Nộp kế hoạch" }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator(".internship-detail-panel")).toContainText("Chờ UIT duyệt");
  });

  await test.step("UIT phê duyệt cuối và lịch sử được giữ lại", async () => {
    await logout(page);
    await login(page, accounts.admin);
    await openPortalSection(page, "Quản lý thực tập", "Quản lý thực tập");
    await page.getByRole("button", { name: "Phê duyệt" }).click();
    const dialog = getDialog(page, "Phê duyệt kế hoạch");
    const approveResponse = waitForApi(page, "POST", "/plan/approve");
    await dialog.getByRole("button", { name: "Phê duyệt kế hoạch" }).click();
    expect((await approveResponse).status()).toBe(200);
    await expect(page.locator(".internship-detail-panel")).toContainText("Đã phê duyệt");
    await expect(page.locator(".internship-history li")).toHaveCount(7);
  });
});
