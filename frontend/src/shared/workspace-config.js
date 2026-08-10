import { companyPortalConfig } from "../company/portal-config.js";
import { studentPortalConfig } from "../student/portal-config.js";
import { adminPortalConfig } from "../uit/portal-config.js";

const workspaceConfigs = {
  admin: adminPortalConfig,
  company: companyPortalConfig,
  student: studentPortalConfig,
};

export function getWorkspaceConfig(role) {
  return workspaceConfigs[role] || studentPortalConfig;
}

export function findQuickNavigationTarget(role, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  if (!normalizedQuery) return null;

  return getWorkspaceConfig(role).navigation.find(({ key, label }) => (
    key.toLocaleLowerCase("vi-VN").includes(normalizedQuery)
      || label.toLocaleLowerCase("vi-VN").includes(normalizedQuery)
  )) || null;
}
