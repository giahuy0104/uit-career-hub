import { accounts, login } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";
import { getDialog, openPortalSection, waitForApi } from "../../support/ui.mjs";

test("@full UIT quản trị vòng đời nhóm ngành và tạo kỹ năng thật", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const categoryCode = `AI_ENGINEERING_${suffix}`;
  const categoryName = `Kỹ thuật AI ${suffix}`;
  const renamedCategory = `Kỹ thuật AI ứng dụng ${suffix}`;
  const skillSlug = `prompt-engineering-${suffix}`;
  const skillName = `Prompt Engineering ${suffix}`;

  await login(page, accounts.admin);
  await openPortalSection(page, "Danh mục & kỹ năng", "Danh mục ngành nghề & kỹ năng");
  await expect(page.getByTestId("taxonomy-categories-table")).toBeVisible();

  await page.getByRole("button", { name: "Thêm mới" }).click();
  const createCategory = getDialog(page, "Thêm nhóm ngành");
  await createCategory.getByLabel(/^Mã nhóm ngành/).fill(categoryCode);
  await createCategory.getByLabel(/^Tên hiển thị/).fill(categoryName);
  const createCategoryResponse = waitForApi(page, "POST", "/uit/taxonomy/categories");
  await createCategory.getByRole("button", { name: "Tạo mới" }).click();
  expect((await createCategoryResponse).status()).toBe(201);
  const categoryRow = page.locator(".taxonomy-row").filter({ hasText: categoryCode });
  await expect(categoryRow).toContainText(categoryName);
  await expect(categoryRow).toContainText("Đang hoạt động");

  await categoryRow.getByRole("button", { name: `Đổi tên ${categoryName}` }).click();
  const editCategory = getDialog(page, "Đổi tên nhóm ngành");
  await editCategory.getByLabel(/^Tên hiển thị/).fill(renamedCategory);
  const updateCategoryResponse = waitForApi(page, "PATCH", `/uit/taxonomy/categories/`);
  await editCategory.getByRole("button", { name: "Lưu thay đổi" }).click();
  expect((await updateCategoryResponse).status()).toBe(200);
  await expect(categoryRow).toContainText(renamedCategory);

  await categoryRow.getByRole("button", { name: `Ngừng hoạt động ${renamedCategory}` }).click();
  const archiveCategory = getDialog(page, `Ngừng hoạt động “${renamedCategory}”?`);
  const archiveCategoryResponse = waitForApi(page, "POST", "/archive");
  await archiveCategory.getByRole("button", { name: "Ngừng hoạt động" }).click();
  expect((await archiveCategoryResponse).status()).toBe(200);
  await expect(categoryRow).toContainText("Ngừng hoạt động");

  await categoryRow.getByRole("button", { name: `Kích hoạt lại ${renamedCategory}` }).click();
  const reactivateCategory = getDialog(page, `Kích hoạt lại “${renamedCategory}”?`);
  const reactivateCategoryResponse = waitForApi(page, "POST", "/reactivate");
  await reactivateCategory.getByRole("button", { name: "Kích hoạt lại" }).click();
  expect((await reactivateCategoryResponse).status()).toBe(200);
  await expect(categoryRow).toContainText("Đang hoạt động");

  await page.getByRole("tab", { name: "Kỹ năng" }).click();
  await expect(page.getByTestId("taxonomy-skills-table")).toBeVisible();
  await page.getByRole("button", { name: "Thêm mới" }).click();
  const createSkill = getDialog(page, "Thêm kỹ năng");
  await createSkill.getByLabel(/^Slug kỹ năng/).fill(skillSlug);
  await createSkill.getByLabel(/^Tên hiển thị/).fill(skillName);
  const createSkillResponse = waitForApi(page, "POST", "/uit/taxonomy/skills");
  await createSkill.getByRole("button", { name: "Tạo mới" }).click();
  expect((await createSkillResponse).status()).toBe(201);
  await expect(page.locator(".taxonomy-row").filter({ hasText: skillSlug })).toContainText(skillName);
});
