import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { evaluateDemoReadiness, type DemoReadinessRow } from "./demo-readiness.js";
import { getDatabaseDirectory } from "./migration-files.js";

describe("evaluateDemoReadiness", () => {
  it("should_report_ready_checks_when_actual_matches_expected", () => {
    const checks = evaluateDemoReadiness([
      { check_name: "demo accounts", actual: 7, expected: 7 } as DemoReadinessRow,
      { check_name: "active applications", actual: 3, expected: 3 } as DemoReadinessRow,
    ]);

    expect(checks).toEqual([
      { checkName: "demo accounts", actual: 7, expected: 7, passed: true },
      { checkName: "active applications", actual: 3, expected: 3, passed: true },
    ]);
  });

  it("should_report_a_failed_check_when_the_checkpoint_has_drifted", () => {
    const [check] = evaluateDemoReadiness([
      { check_name: "pending offer", actual: 0, expected: 1 } as DemoReadinessRow,
    ]);

    expect(check).toEqual({
      checkName: "pending offer",
      actual: 0,
      expected: 1,
      passed: false,
    });
  });

  it("should_seed_an_isolated_offer_flow_with_another_active_application", async () => {
    const sql = await readFile(`${getDatabaseDirectory("seeds")}/development.sql`, "utf8");

    expect(sql).toMatch(/00000000-0000-4000-8000-000000008004[\s\S]*?INTERVIEW_INVITED/);
    expect(sql).toMatch(/00000000-0000-4000-8000-000000008005[\s\S]*?COMPANY_REVIEWING/);
  });
});
