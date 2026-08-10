import { expect } from "@playwright/test";

export function waitForApi(page, method, pathSuffix) {
  return page.waitForResponse((response) => {
    const path = new URL(response.url()).pathname;
    return response.request().method() === method
      && (path.includes(`/api/v1${pathSuffix}`) || path.endsWith(pathSuffix));
  });
}

export function getDialog(page, heading) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: heading }),
  });
}

export async function openPortalSection(page, navigationName, heading) {
  await page.getByRole("navigation").getByRole("button", { name: navigationName, exact: true }).click();
  await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
}

export async function selectApplication(page, jobTitle) {
  await page.getByLabel("Tìm đơn ứng tuyển").fill(jobTitle);
  const row = page.locator(".application-row").filter({ hasText: jobTitle });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page.locator(".active-application .application-title").getByRole("heading", { name: jobTitle })).toBeVisible();
}

export async function selectCompanyCandidate(page, jobTitle) {
  await page.getByPlaceholder("Tìm ứng viên, MSSV, vị trí...").fill(jobTitle);
  const card = page.locator(".candidate-board article").filter({ hasText: jobTitle });
  await expect(card).toHaveCount(1);
  return card;
}
