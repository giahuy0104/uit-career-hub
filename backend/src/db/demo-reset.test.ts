import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { cleanupDemoOfferObjects, resetDemoDatabase } from "./demo-reset.js";
import { getDatabaseDirectory } from "./migration-files.js";

describe("resetDemoDatabase", () => {
  it("should_refuse_to_connect_when_the_explicit_safety_flag_is_off", async () => {
    await expect(
      resetDemoDatabase({
        allowReset: false,
        databaseUrl: "postgresql://invalid:invalid@127.0.0.1:1/invalid",
        log: () => undefined,
      }),
    ).rejects.toThrow(/ALLOW_DEMO_RESET/);
  });

  it("should_keep_every_delete_scoped_and_avoid_truncate_or_drop", async () => {
    const sql = await readFile(`${getDatabaseDirectory("seeds")}/demo-reset.sql`, "utf8");
    const deleteStatements = sql.match(/DELETE FROM[\s\S]*?;/gi) ?? [];

    expect(deleteStatements.length).toBeGreaterThan(10);
    for (const statement of deleteStatements) {
      expect(statement).toMatch(/\bWHERE\b/i);
    }
    expect(sql).not.toMatch(/^\s*(?:TRUNCATE|DROP)\s/im);
  });

  it("should_delete_offer_upload_records_before_demo_applications", async () => {
    const sql = await readFile(`${getDatabaseDirectory("seeds")}/demo-reset.sql`, "utf8");

    expect(sql.indexOf("DELETE FROM offer_document_uploads")).toBeGreaterThan(
      sql.indexOf("DELETE FROM recruitment_results"),
    );
    expect(sql.indexOf("DELETE FROM offer_document_uploads")).toBeLessThan(
      sql.indexOf("DELETE FROM applications"),
    );
  });

  it("should_cleanup_every_demo_offer_object_when_storage_is_enabled", async () => {
    const deleted: string[] = [];
    const logs: string[] = [];
    const objectStorage = {
      createUploadUrl: async () => "",
      createDownloadUrl: async () => "",
      headObject: async () => null,
      readObjectPrefix: async () => new Uint8Array(),
      deleteObject: async (key: string) => { deleted.push(key); },
    };

    await cleanupDemoOfferObjects(
      ["offers/demo/one.pdf", "offers/demo/two.pdf"],
      objectStorage,
      (message) => logs.push(message),
    );

    expect(deleted).toEqual(["offers/demo/one.pdf", "offers/demo/two.pdf"]);
    expect(logs).toEqual(["Đã dọn 2 object offer demo trên R2."]);
  });
});
