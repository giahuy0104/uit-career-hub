import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { resetDemoDatabase } from "./demo-reset.js";
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
});
