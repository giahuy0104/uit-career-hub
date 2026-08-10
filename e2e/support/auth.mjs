import { expect } from "@playwright/test";

export const accounts = {
  student: {
    demoLabel: "Sinh viên",
    email: "20521067@student.uit.edu.vn",
    password: "Student@12345",
  },
  studentAuxiliary: {
    email: "21520881@student.uit.edu.vn",
    password: "Student@12345",
  },
  admin: {
    demoLabel: "UIT Admin",
    email: "admin.career@uit.edu.vn",
    password: "Admin@12345",
  },
  company: {
    demoLabel: "Doanh nghiệp",
    email: "recruiter@vng.example",
    password: "Company@12345",
  },
  companyFpt: {
    email: "recruiter@fpt.example",
    password: "Company@12345",
  },
};

export async function login(page, account, { useDemoButton = false, dashboardPath = null } = {}) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chào mừng bạn trở lại" })).toBeVisible();

  if (useDemoButton && account.demoLabel) {
    await page.getByRole("button", { name: new RegExp(`^${account.demoLabel}\\b`) }).click();
  } else {
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Mật khẩu").fill(account.password);
  }

  const loginResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST",
  );
  const dashboardResponse = dashboardPath
    ? page.waitForResponse((response) =>
        response.url().includes(`/api/v1${dashboardPath}`) && response.request().method() === "GET",
      )
    : null;
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  return dashboardResponse ? await dashboardResponse : null;
}

export async function logout(page) {
  const logoutResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/auth/logout") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).first().click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByRole("heading", { name: "Chào mừng bạn trở lại" })).toBeVisible();
}

export async function apiLogin(request, account) {
  const response = await request.post("http://127.0.0.1:3100/api/v1/auth/login", {
    data: { email: account.email, password: account.password },
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  return payload.data.accessToken;
}
