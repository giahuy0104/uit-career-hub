import { stat } from "node:fs/promises";

import { accounts, login } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";
import { waitForApi } from "../../support/ui.mjs";

test("@full UIT lọc báo cáo và tải CSV/Excel thật", async ({ page }) => {
  await login(page, accounts.admin);

  const initialReport = waitForApi(page, "GET", "/uit/reports/applications");
  await page.getByRole("navigation").getByRole("button", { name: "Báo cáo tuyển dụng", exact: true }).click();
  expect((await initialReport).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Báo cáo tuyển dụng", level: 1 })).toBeVisible();
  await expect(page.getByTestId("report-applications-table")).toBeVisible();
  await expect(page.locator(".report-row")).toHaveCount(5);

  await page.getByLabel("Khoa", { exact: true }).selectOption({ label: "Công nghệ phần mềm" });
  const filteredReport = waitForApi(page, "GET", "/uit/reports/applications");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  expect((await filteredReport).status()).toBe(200);
  await expect(page.locator(".report-row")).toHaveCount(3);
  await expect(page.locator(".report-row").first()).toContainText("Nguyễn Minh Khoa");

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Xuất CSV" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^uit-application-report-\d{8}-\d{6}\.csv$/);
  expect((await stat(await csvDownload.path())).size).toBeGreaterThan(100);
  await expect(page.getByRole("status")).toContainText("Đã xuất 3 hồ sơ sang CSV");

  const [xlsxDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Xuất Excel" }).click(),
  ]);
  expect(xlsxDownload.suggestedFilename()).toMatch(/^uit-application-report-\d{8}-\d{6}\.xlsx$/);
  expect((await stat(await xlsxDownload.path())).size).toBeGreaterThan(1_000);
  await expect(page.getByRole("status")).toContainText("Đã xuất 3 hồ sơ sang XLSX");
});
