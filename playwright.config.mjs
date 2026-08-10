import { defineConfig, devices } from "@playwright/test";
import { config as loadEnvironment } from "dotenv";
import { resolve } from "node:path";

loadEnvironment({ path: resolve(".env"), override: false, quiet: true });

const webOrigin = "http://127.0.0.1:5174";
const apiOrigin = "http://127.0.0.1:3100";
const databaseUrlE2e = process.env.DATABASE_URL_E2E;

if (!databaseUrlE2e) {
  throw new Error("Thiếu DATABASE_URL_E2E. Playwright không được phép fallback sang database runtime.");
}
if (process.env.ALLOW_E2E_RESET !== "true") {
  throw new Error("Đặt ALLOW_E2E_RESET=true sau khi xác nhận DATABASE_URL_E2E là database chuyên dụng.");
}

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./test-results",
  globalSetup: "./e2e/global-setup.mjs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: webOrigin,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --dir backend dev",
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "test",
        BACKEND_PORT: "3100",
        CORS_ORIGIN: webOrigin,
        DATABASE_URL: databaseUrlE2e,
        DATABASE_URL_DIRECT: "",
        DATABASE_URL_TEST: "",
        JWT_ACCESS_SECRET: "e2e-only-access-secret-at-least-32-characters",
        AUTH_COOKIE_SECURE: "false",
        ALLOW_DEMO_RESET: "false",
        EMAIL_ENABLED: "false",
        OBJECT_STORAGE_ENABLED: "false",
      },
    },
    {
      command: "pnpm --dir frontend dev --host 127.0.0.1 --port 5174 --strictPort",
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        VITE_API_BASE_URL: `${apiOrigin}/api/v1`,
        VITE_SHOW_DEMO_ACCOUNTS: "true",
      },
    },
  ],
});
