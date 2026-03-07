import { expect, test, type Page } from "@playwright/test";

const locale = "en";

const openDecisionTemplateMode = async (page: Page) => {
  await page.getByRole("button", { name: /Add experiment|新增實驗/i }).first().click();
  const drawer = page.getByRole("dialog").last();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /Choose|選擇/i }).first().click();
  await expect(drawer.getByText(/Decision templates|決策模板/i)).toBeVisible();
  return drawer;
};

test.describe("plan lab snapshots", () => {
  test("save snapshot and compare", async ({ page }) => {
    page.on("pageerror", (error) => {
      throw error;
    });

    await page.goto(`/${locale}/plan-lab`);
    await expect(page.getByRole("heading", { name: "Plan Lab" })).toBeVisible();

    await page.getByRole("button", { name: /Add experiment|新增實驗/i }).first().click();

    const groupSelect = page.getByLabel(/Event group|事件群組/i);
    await groupSelect.click();
    await page.getByRole("option").first().click();

    const typeSelect = page.getByLabel(/Event type|事件類型/i);
    await typeSelect.click();
    await page.getByRole("option").first().click();

    await page.getByLabel(/Event name|事件名稱/i).fill("Snapshot test event");
    await page.getByLabel(/Monthly amount|每月金額/i).fill("500");
    await page.getByLabel(/Start month|開始月份/i).fill("2024-01");

    await page.getByRole("button", { name: /Apply|套用|Save|儲存/i }).click();

    await page.getByRole("button", { name: /Save plan|儲存方案/i }).click();
    await page.getByLabel(/Plan name|方案名稱/i).fill("Snapshot A");
    await page.getByRole("button", { name: /Save plan|儲存方案/i }).last().click();
    await expect(page.getByRole("button", { name: /Plans \(1\)|方案 \(1\)/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /Plans \(1\)|方案 \(1\)/i })).toBeVisible();

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
    await expect(page.getByText(/Plan comparison chart|方案比較圖/i)).toBeVisible();
    await expect(page.getByText(/Diff summary|差異摘要/i)).toBeVisible();
  });
});

test("PlanLab decision template launches home purchase wizard", async ({ page }) => {
  await page.goto(`/${locale}/plan-lab`);
  await expect(page.getByRole("heading", { name: "Plan Lab" })).toBeVisible();

  const drawer = await openDecisionTemplateMode(page);
  const applyButtons = drawer.getByRole("button", { name: /Apply|套用/i });
  await expect(applyButtons.first()).toBeEnabled();
  await applyButtons.first().click();

  await expect(page.getByText(/Life-event bundle|人生事件組合/i)).toBeVisible();
});

test("PlanLab decision template launches new baby wizard", async ({ page }) => {
  await page.goto(`/${locale}/plan-lab`);
  await expect(page.getByRole("heading", { name: "Plan Lab" })).toBeVisible();

  const drawer = await openDecisionTemplateMode(page);
  const applyButtons = drawer.getByRole("button", { name: /Apply|套用/i });
  await expect(applyButtons.nth(1)).toBeEnabled();
  await applyButtons.nth(1).click();

  await expect(page.getByText(/Life-event bundle|人生事件組合/i)).toBeVisible();
});

test("PlanLab income shock template creates override experiment", async ({ page }) => {
  await page.goto(`/${locale}/plan-lab`);
  await expect(page.getByRole("heading", { name: "Plan Lab" })).toBeVisible();

  const drawer = await openDecisionTemplateMode(page);
  const applyButtons = drawer.getByRole("button", { name: /Apply|套用/i });
  await expect(applyButtons.nth(2)).toBeEnabled();
  await applyButtons.nth(2).click();

  await expect(page.getByText(/Income shock:|收入衝擊：/i)).toBeVisible();
});

