import { expect, test } from "@playwright/test";

const locale = "en";

test.describe("plan lab snapshots", () => {
  test("save snapshot and compare", async ({ page }) => {
    page.on("pageerror", (error) => {
      throw error;
    });

    await page.goto(`/${locale}/plan-lab`);
    await expect(page.getByRole("heading", { name: "Plan Lab" })).toBeVisible();

    await page.getByRole("button", { name: /新增事件|Add event/i }).click();

    const groupSelect = page.getByLabel(/事件類別|Event group/i);
    await groupSelect.click();
    await page.getByRole("option").first().click();

    const typeSelect = page.getByLabel(/事件類型|Event type/i);
    await typeSelect.click();
    await page.getByRole("option").first().click();

    await page.getByLabel(/Event name|事件名稱/i).fill("Snapshot test event");
    await page.getByLabel(/Monthly amount|每月金額/i).fill("500");
    await page.getByLabel(/Start month|開始月份/i).fill("2024-01");

    await page.getByRole("button", { name: /套用|Apply|儲存|Save/i }).click();

    await page.getByRole("button", { name: /Save plan|儲存方案/i }).click();
    await page.getByLabel(/Plan name|方案名稱/i).fill("Snapshot A");
    await page.getByRole("button", { name: /Save plan|儲存方案/i }).last().click();

    await page.getByRole("button", { name: /Plans|方案/i }).click();
    await expect(page.getByText("Snapshot A")).toBeVisible();

    const menuButtons = page.getByLabel("Plan actions");
    await menuButtons.first().click();
    await page.getByRole("menuitem", { name: /Duplicate|複製/i }).click();

    await expect(page.getByText(/copy|複製/i)).toBeVisible();

    const updatedMenuButtons = page.getByLabel("Plan actions");
    await updatedMenuButtons.first().click();
    await page.getByRole("menuitem", { name: /Set as Plan A|設為方案 A/i }).click();

    await updatedMenuButtons.nth(1).click();
    await page.getByRole("menuitem", { name: /Set as Plan B|設為方案 B/i }).click();

    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Compare|比較/i }).click();
    await expect(
      page.getByText(/Plan comparison chart|方案比較圖/i)
    ).toBeVisible();
    await expect(page.getByText(/Diff summary|差異摘要/i)).toBeVisible();
  });
});

test("PlanLab opens template wizard from Experiment add button", async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });

  await page.goto(`/${locale}/plan-lab`);
  await expect(page.getByRole("heading", { name: "Plan Lab" })).toBeVisible();

  await page.getByRole("button", { name: /新增事件|Add event/i }).click();

  await expect(page.getByText(/選擇模板|templatePickerTitle/i)).toBeVisible();
  await expect(page.getByText(/建立計劃|createIntentPlanTitle/i)).toBeVisible();
  await expect(page.getByText(/新增項目|createIntentItemTitle/i)).toBeVisible();
});
