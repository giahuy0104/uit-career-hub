import { describe, expect, it } from "vitest";

import { assertSafeBackupRestoreDrill, databaseIdentity } from "./backup-restore-drill.js";

const sourceUrl = "postgresql://user:secret@127.0.0.1:5432/uit_career_hub_e2e";
const targetUrl = "postgresql://user:secret@127.0.0.1:5432/uit_career_hub_restore_drill";

describe("backup/restore drill safety", () => {
  it("returns only a credential-free database identity", () => {
    expect(databaseIdentity(sourceUrl)).toBe("127.0.0.1:5432/uit_career_hub_e2e");
  });

  it("accepts an explicit non-production source and dedicated restore target", () => {
    expect(assertSafeBackupRestoreDrill({
      sourceUrl,
      targetUrl,
      sourceLabel: "local-e2e",
      targetLabel: "local-restore-drill",
      allowRestore: true,
      protectedUrls: [],
    })).toMatchObject({ sourceUrl, targetUrl });
  });

  it("rejects conflicting or unsafe Docker tool configuration", () => {
    expect(() => assertSafeBackupRestoreDrill({
      sourceUrl,
      targetUrl,
      sourceLabel: "local-e2e",
      targetLabel: "local-restore-drill",
      allowRestore: true,
      protectedUrls: [],
      toolsDockerContainer: "postgres",
      toolsDockerImage: "postgres:17-alpine",
    })).toThrow(/Chỉ chọn một/);
    expect(() => assertSafeBackupRestoreDrill({
      sourceUrl,
      targetUrl,
      sourceLabel: "local-e2e",
      targetLabel: "local-restore-drill",
      allowRestore: true,
      protectedUrls: [],
      toolsDockerImage: "postgres:17;rm",
    })).toThrow(/DOCKER_IMAGE/);
  });

  it.each([
    ["missing opt-in", { allowRestore: false }, /ALLOW_BACKUP_RESTORE_DRILL/],
    ["unsafe source label", { sourceLabel: "production" }, /SOURCE_LABEL/],
    ["unsafe target label", { targetLabel: "copy" }, /TARGET_LABEL/],
    ["same source and target", { targetUrl: sourceUrl }, /phải khác/],
    [
      "protected target",
      { protectedUrls: [targetUrl] },
      /runtime\/direct\/test\/E2E/,
    ],
    [
      "unsafe local target name",
      { targetUrl: "postgresql://user:secret@127.0.0.1:5432/uit_career_hub_copy" },
      /Tên database restore local/,
    ],
  ])("rejects %s", (_case, overrides, expected) => {
    expect(() => assertSafeBackupRestoreDrill({
      sourceUrl,
      targetUrl,
      sourceLabel: "local-e2e",
      targetLabel: "local-restore-drill",
      allowRestore: true,
      protectedUrls: [],
      ...overrides,
    })).toThrow(expected);
  });
});
