import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

const locale = "en";

const startOnboarding = async (page: import("@playwright/test").Page) => {
  await page.goto(`/${locale}/scenarios`);
  const createButton = page.getByRole("button", { name: "Create new plan" });
  if (await createButton.isVisible()) {
    await createButton.click();
  } else {
    await page.goto(`/${locale}/onboarding`);
  }
  await expect(page.getByRole("heading", { name: "Onboarding draft" })).toBeVisible();
};

const resolveBaseMonth = async (
  page: import("@playwright/test").Page
): Promise<string> => {
  const header = page.getByText(/Base month:/);
  const text = (await header.textContent()) ?? "";
  const match = text.match(/\d{4}-\d{2}/);
  return match?.[0] ?? "2024-01";
};

test.describe("money v2 ledger", () => {
  test("edit, duplicate, delete, and adjust cashflow events", async ({ page }) => {
    page.on("pageerror", (error) => {
      throw error;
    });

    await startOnboarding(page);
    const baseMonth = await resolveBaseMonth(page);

    await page.getByLabel("Your birth month").fill("1990-01");
    const baseCurrencySelect = page.getByLabel("Base currency");
    await baseCurrencySelect.click();
    await page.getByRole("option", { name: "USD" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Monthly fixed living spend").fill("2500");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Rent" }).click();
    await page.getByLabel("Monthly rent").fill("1800");
    const rentStartMonth = page.getByLabel("Start month");
    await rentStartMonth.fill(baseMonth);
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Cash amount").fill("50000");
    await page.getByLabel("As of month").fill(baseMonth);
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("heading", { name: "Review & finish" }).waitFor();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/\/money/);

    await page.goto(`/${locale}/dashboard`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("menuitem", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error("Failed to resolve export download path.");
    }
    const projectionPayload = JSON.parse(
      await fs.readFile(downloadPath, "utf-8")
    );
    const cashBalance: number[] = projectionPayload.projection.cashBalance ?? [];
    expect(new Set(cashBalance).size).toBeGreaterThan(1);

    await page.goto(`/${locale}/money`);
    await page.getByRole("button", { name: "Add event" }).click();
    await page.getByLabel("Label").fill("Salary");
    await page.getByLabel(/Amount/).fill("1000");
    await page.getByLabel("Start month").fill(baseMonth);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Salary")).toBeVisible();

    await page.getByRole("button", { name: "View ledger impact" }).first().click();
    await expect(page.getByText(baseMonth)).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel(/Amount/).fill("1200");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/1,200/)).toBeVisible();

    await page.getByRole("button", { name: "Duplicate" }).first().click();
    await expect(page.getByText("Salary (Copy)")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).last().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Salary (Copy)")).toHaveCount(0);

    await page.getByRole("button", { name: "Adjust" }).first().click();
    await page.getByLabel("Adjustment amount").fill("50");
    await page.getByRole("button", { name: "Create adjustment" }).click();
    await expect(page.getByText("Adjustment")).toBeVisible();
  });
});
