import { expect, test } from "@playwright/test";

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

test.describe("onboarding v2", () => {
  test("Toggle Torture Test", async ({ page }) => {
    page.on("pageerror", (error) => {
      throw error;
    });

    await startOnboarding(page);
    const baseMonth = await resolveBaseMonth(page);

    await page.getByRole("button", { name: "Living spend" }).click();
    const categoryToggle = page.getByRole("checkbox", {
      name: "Enable category breakdown",
    });
    await categoryToggle.click();
    await page.getByLabel("Food").fill("500");
    await page.getByLabel("Transport").fill("200");
    await categoryToggle.click();

    const annualButtons = page.getByRole("button", { name: "Annual" });
    await annualButtons.nth(0).click();
    await page.getByLabel("Annual travel total").fill("1200");
    await page.getByLabel("Travel months").click();
    await page.getByRole("option", { name: baseMonth }).click();
    await page.getByRole("button", { name: "Monthly" }).first().click();

    await annualButtons.nth(1).click();
    await page.getByLabel("Annual tax total").fill("800");
    await page.getByLabel("Tax months").click();
    await page.getByRole("option", { name: baseMonth }).click();
    await page.getByRole("button", { name: "Monthly" }).nth(1).click();

    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByRole("button", { name: "Remove" }).last().click();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Onboarding draft" })).toBeVisible();

    await page.getByRole("button", { name: "Housing" }).click();
    await page.getByRole("button", { name: "Mortgage / Own" }).click();
    await page.getByRole("button", { name: "Down payment ($)" }).click();
    await page.getByRole("button", { name: "Down payment (%)" }).click();
    const mortgageToggle = page.getByRole("checkbox", { name: "I have a mortgage" });
    await mortgageToggle.click();
    await mortgageToggle.click();
    const rentalToggle = page.getByRole("checkbox", { name: "Enable rental income" });
    await rentalToggle.click();
    await rentalToggle.click();
    await page.getByRole("button", { name: "Rent" }).click();

    await page.getByRole("button", { name: "Assets" }).click();
    const breakdownToggle = page.getByRole("checkbox", {
      name: "Split investments by asset type",
    });
    await breakdownToggle.click();
    await breakdownToggle.click();
    await page.getByRole("button", { name: "Add contribution" }).click();
    await page.getByRole("button", { name: "Remove" }).last().click();
    const carToggle = page.getByRole("checkbox", { name: "I own a car asset" });
    await carToggle.click();
    await carToggle.click();

    await page.getByRole("button", { name: "Debts" }).click();
    await page.getByRole("button", { name: "Add debt" }).click();
    await page.getByLabel("Debt type").click();
    await page.getByRole("option", { name: "Car loan" }).click();
    await page.getByRole("button", { name: "Down payment amount" }).click();
    await page.getByRole("button", { name: "Down payment (%)" }).click();
    await page.getByRole("button", { name: "Remove" }).last().click();

    await page.getByRole("button", { name: "Insurance" }).click();
    await page.getByRole("button", { name: "Detailed policies" }).click();
    await page.getByRole("button", { name: "Add policy" }).click();
    await page.getByRole("button", { name: "Savings" }).click();
    const cashValueUnknown = page.getByRole("checkbox", {
      name: "Cash value unknown",
    });
    await cashValueUnknown.click();
    await cashValueUnknown.click();
    await page.getByRole("button", { name: "Quick total" }).click();

    await page.getByRole("button", { name: "Review" }).click();
    await expect(
      page.getByRole("heading", { name: "Something went wrong" })
    ).toHaveCount(0);
  });

  test("Happy Path Full Flow", async ({ page }) => {
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

    await page.getByLabel("Income name").fill("Salary");
    await page.getByLabel("Income amount").fill("5000");
    await page.getByLabel("Start month").fill(baseMonth);
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

    await page.getByRole("tab", { name: "Income" }).click();
    await page.getByRole("button", { name: "Edit" }).first().click();
    const amountField = page.getByLabel("Amount (USD)");
    await amountField.fill("5500");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("USD 5,500")).toBeVisible();
  });
});
