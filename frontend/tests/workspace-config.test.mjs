import assert from "node:assert/strict";
import test from "node:test";

import {
  findQuickNavigationTarget,
  getWorkspaceConfig,
} from "../src/shared/workspace-config.js";

test("admin navigation exposes only API-backed screens", () => {
  const keys = getWorkspaceConfig("admin").navigation.map(({ key }) => key);

  assert.deepEqual(keys, [
    "admin-dashboard",
    "admin-companies",
    "admin-taxonomy",
    "admin-reports",
    "admin-jobs",
    "admin-documents",
    "admin-applications",
    "admin-placements",
    "admin-internships",
    "admin-notifications",
  ]);
  assert.equal(keys.includes("admin-scheduler"), false);
  assert.equal(keys.includes("admin-reports"), true);
  assert.equal(keys.includes("admin-access"), false);
});

test("quick navigation resolves labels for each protected portal", () => {
  assert.equal(findQuickNavigationTarget("admin", "taxonomy")?.key, "admin-taxonomy");
  assert.equal(findQuickNavigationTarget("admin", "báo cáo")?.key, "admin-reports");
  assert.equal(findQuickNavigationTarget("admin", "doanh nghiệp")?.key, "admin-companies");
  assert.equal(findQuickNavigationTarget("company", "ứng viên")?.key, "company-candidates");
  assert.equal(findQuickNavigationTarget("student", "đơn ứng tuyển")?.key, "applications");
  assert.equal(findQuickNavigationTarget("student", "quá trình thực tập")?.key, "internships");
  assert.equal(findQuickNavigationTarget("company", "sinh viên thực tập")?.key, "company-internships");
  assert.equal(findQuickNavigationTarget("admin", "quản lý thực tập")?.key, "admin-internships");
  assert.equal(findQuickNavigationTarget("admin", "scheduler"), null);
  assert.equal(findQuickNavigationTarget("company", ""), null);
});
