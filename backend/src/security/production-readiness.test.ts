import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { evaluateProductionEnvironment, verifyNeonRestoreEvidence } from "./production-readiness.js";

const now = new Date("2026-08-11T00:00:00.000Z");
const temporaryPaths: string[] = [];

function readyEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    VITE_SHOW_DEMO_ACCOUNTS: "false",
    ALLOW_DEMO_RESET: "false",
    ALLOW_E2E_RESET: "false",
    JWT_ACCESS_SECRET: "random-production-jwt-secret-abcdefghijklmnopqrstuvwxyz",
    CRON_SECRET: "random-production-cron-secret-abcdefghijklmnopqrstuvwxyz",
    PRODUCTION_SECRETS_ROTATED_AT: "2026-08-01T00:00:00.000Z",
    AUTH_COOKIE_SECURE: "true",
    CORS_ORIGIN: "https://careers.uit.example",
    PUBLIC_APP_URL: "https://careers.uit.example",
    DATABASE_URL: "postgresql://user:secret@ep-production-pooler.neon.tech/neondb?sslmode=require",
    ERROR_MONITOR_WEBHOOK_URL: "https://monitor.example/events",
    OBJECT_STORAGE_ENABLED: "true",
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "access",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "private-documents",
    EMAIL_ENABLED: "false",
  };
}

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("production readiness", () => {
  it("passes the static configuration gate for a hardened environment", () => {
    const checks = evaluateProductionEnvironment(readyEnvironment(), now);
    expect(checks.every(({ passed }) => passed)).toBe(true);
  });

  it("rejects demo UI, weak secrets, insecure origins and test database settings", () => {
    const checks = evaluateProductionEnvironment({
      ...readyEnvironment(),
      VITE_SHOW_DEMO_ACCOUNTS: "true",
      JWT_ACCESS_SECRET: "development-only-change-me-32-characters",
      CORS_ORIGIN: "http://localhost:5173",
      DATABASE_URL_TEST: "postgresql://test",
    }, now);
    const failed = checks.filter(({ passed }) => !passed).map(({ id }) => id);

    expect(failed).toEqual(expect.arrayContaining([
      "demo.frontend_hidden",
      "secret.jwt",
      "origin.cors_https",
      "database.test_urls_absent",
    ]));
  });

  it("accepts only recent successful evidence from a Neon non-production restore drill", async () => {
    const directory = join(tmpdir(), `uit-career-hub-readiness-${Date.now()}`);
    temporaryPaths.push(directory);
    await mkdir(directory, { recursive: true });
    const path = join(directory, "evidence.json");
    await writeFile(path, JSON.stringify({
      status: "PASSED",
      finishedAt: "2026-08-10T00:00:00.000Z",
      source: { identity: "ep-test.neon.tech:5432/neondb", label: "neon-test-branch" },
      target: { label: "neon-restore-drill" },
      verification: {
        sourceSchemaCurrent: true,
        migrationsMatched: true,
        tableCountsMatched: true,
      },
    }));

    await expect(verifyNeonRestoreEvidence(path, now)).resolves.toMatchObject({ passed: true });
    await expect(verifyNeonRestoreEvidence(undefined, now)).resolves.toMatchObject({ passed: false });
  });
});
