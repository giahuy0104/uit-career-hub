import { describe, expect, it } from "vitest";

import { evaluateDemoReadiness, type DemoReadinessRow } from "./demo-readiness.js";

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
});
