import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./env.js";

describe("parseEnvironment", () => {
  it("should_use_safe_defaults_when_optional_values_are_missing", () => {
    const result = parseEnvironment({ NODE_ENV: "test" });

    expect(result.backendPort).toBe(3000);
    expect(result.corsOrigin).toBe("http://localhost:5173");
    expect(result.databaseUrl).toContain("localhost");
    expect(result.databaseUrlDirect).toBeUndefined();
    expect(result.databaseUrlE2e).toBeUndefined();
    expect(result.databasePoolMax).toBe(10);
    expect(result.allowDemoReset).toBe(false);
    expect(result.allowE2eReset).toBe(false);
    expect(result.cronSecret).toBeUndefined();
    expect(result.emailEnabled).toBe(false);
    expect(result.resendApiKey).toBeUndefined();
    expect(result.emailBatchSize).toBe(10);
    expect(result.emailMaxAttempts).toBe(5);
    expect(result.publicAppUrl).toBe("http://localhost:5173");
    expect(result.objectStorageEnabled).toBe(false);
    expect(result.objectUploadUrlTtlSeconds).toBe(600);
    expect(result.objectDownloadUrlTtlSeconds).toBe(300);
    expect(result.errorMonitorWebhookUrl).toBeUndefined();
    expect(result.errorMonitorTimeoutMs).toBe(1_500);
  });

  it("should_accept_a_small_serverless_database_pool", () => {
    const result = parseEnvironment({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a-production-secret-with-at-least-32-characters",
      DATABASE_POOL_MAX: "2",
    });

    expect(result.databasePoolMax).toBe(2);
  });

  it("should_only_enable_demo_reset_when_explicitly_requested", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      ALLOW_DEMO_RESET: "true",
    });

    expect(result.allowDemoReset).toBe(true);
  });

  it("should_only_enable_e2e_reset_when_explicitly_requested", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      DATABASE_URL_E2E: "postgresql://user:password@127.0.0.1:5432/uit_career_hub_e2e",
      ALLOW_E2E_RESET: "true",
    });

    expect(result.databaseUrlE2e).toContain("uit_career_hub_e2e");
    expect(result.allowE2eReset).toBe(true);
  });

  it("should_accept_a_cron_secret_with_at_least_32_characters", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      CRON_SECRET: "daily-cron-secret-with-at-least-32-characters",
    });

    expect(result.cronSecret).toBe("daily-cron-secret-with-at-least-32-characters");
  });

  it("should_reject_a_short_cron_secret", () => {
    expect(() => parseEnvironment({ NODE_ENV: "test", CRON_SECRET: "too-short" })).toThrow();
  });

  it("should_require_resend_configuration_when_email_is_enabled", () => {
    expect(() => parseEnvironment({ NODE_ENV: "test", EMAIL_ENABLED: "true" })).toThrow(
      /RESEND_API_KEY và EMAIL_FROM/,
    );

    const result = parseEnvironment({
      NODE_ENV: "test",
      EMAIL_ENABLED: "true",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "UIT Career Hub <notifications@example.com>",
      PUBLIC_APP_URL: "https://career.example.com",
      EMAIL_BATCH_SIZE: "10",
      EMAIL_MAX_ATTEMPTS: "3",
    });

    expect(result.emailEnabled).toBe(true);
    expect(result.emailFrom).toContain("notifications@example.com");
    expect(result.publicAppUrl).toBe("https://career.example.com");
    expect(result.emailBatchSize).toBe(10);
    expect(result.emailMaxAttempts).toBe(3);
  });

  it("should_require_complete_r2_configuration_when_object_storage_is_enabled", () => {
    expect(() => parseEnvironment({ NODE_ENV: "test", OBJECT_STORAGE_ENABLED: "true" })).toThrow(
      /R2_ACCOUNT_ID/,
    );

    const result = parseEnvironment({
      NODE_ENV: "test",
      OBJECT_STORAGE_ENABLED: "true",
      R2_ACCOUNT_ID: "cloudflare-account-id",
      R2_ACCESS_KEY_ID: "r2-access-key",
      R2_SECRET_ACCESS_KEY: "r2-secret-key",
      R2_BUCKET: "uit-career-hub-documents",
      OBJECT_UPLOAD_URL_TTL_SECONDS: "300",
      OBJECT_DOWNLOAD_URL_TTL_SECONDS: "120",
    });

    expect(result.objectStorageEnabled).toBe(true);
    expect(result.r2Bucket).toBe("uit-career-hub-documents");
    expect(result.objectUploadUrlTtlSeconds).toBe(300);
    expect(result.objectDownloadUrlTtlSeconds).toBe(120);
  });

  it("should_accept_neon_urls_when_ssl_is_required", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://user:password@ep-demo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      DATABASE_URL_DIRECT:
        "postgresql://user:password@ep-demo.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    });

    expect(result.databaseUrl).toContain("-pooler");
    expect(result.databaseUrlDirect).not.toContain("-pooler");
  });

  it("should_reject_neon_urls_without_ssl_mode", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:password@ep-demo-pooler.neon.tech/neondb",
      }),
    ).toThrow(/sslmode/);
  });

  it("should_require_an_https_error_monitor_webhook_in_production", () => {
    expect(() => parseEnvironment({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a-production-secret-with-at-least-32-characters",
      ERROR_MONITOR_WEBHOOK_URL: "http://monitor.example.test/events",
    })).toThrow(/HTTPS/);

    const result = parseEnvironment({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a-production-secret-with-at-least-32-characters",
      ERROR_MONITOR_WEBHOOK_URL: "https://monitor.example.test/events",
      ERROR_MONITOR_TIMEOUT_MS: "750",
    });
    expect(result.errorMonitorWebhookUrl).toBe("https://monitor.example.test/events");
    expect(result.errorMonitorTimeoutMs).toBe(750);
  });
});
