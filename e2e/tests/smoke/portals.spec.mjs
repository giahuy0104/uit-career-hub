import { accounts, login } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";

const portals = [
  {
    name: "Student",
    account: accounts.student,
    dashboardPath: "/students/me/dashboard",
    heading: "Tổng quan",
  },
  {
    name: "UIT",
    account: accounts.admin,
    dashboardPath: "/uit/dashboard",
    heading: "Tổng quan vận hành",
  },
  {
    name: "Company",
    account: accounts.company,
    dashboardPath: "/companies/me/dashboard",
    heading: "Tổng quan tuyển dụng",
  },
];

for (const portal of portals) {
  test(`@smoke đăng nhập ${portal.name} và tải dashboard từ API`, async ({ page }) => {
    const response = await login(page, portal.account, {
      useDemoButton: true,
      dashboardPath: portal.dashboardPath,
    });
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.data).toBeTruthy();
    await expect(page.getByRole("heading", { name: portal.heading, level: 1 })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(portal.heading);
  });
}
