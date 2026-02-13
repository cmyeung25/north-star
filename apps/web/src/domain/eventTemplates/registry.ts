import type { TemplateDef, TemplateId } from "./types";

export const templateRegistry: TemplateDef[] = [
  {
    id: "monthly_salary",
    categories: ["popular", "income"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "salary_adjustment",
    categories: ["income", "adjustments"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "bonus_13th",
    categories: ["income", "adjustments"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "rental_income",
    categories: ["income"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "dividends_interest",
    categories: ["income"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "living_total",
    categories: ["popular", "expenses"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "living_breakdown",
    categories: ["expenses"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "rent_housing",
    categories: ["housing", "expenses"],
    drawerType: "housing",
    chips: ["affectsCashflow"],
  },
  {
    id: "insurance_quick",
    categories: ["insurance", "expenses"],
    drawerType: "insurance",
    chips: ["affectsCashflow"],
  },
  {
    id: "insurance_detailed",
    categories: ["insurance", "expenses"],
    drawerType: "insurance",
    chips: ["affectsCashflow"],
  },
  {
    id: "childcare_monthly",
    categories: ["expenses"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "one_time_big_expense",
    categories: ["expenses"],
    drawerType: "cashflow",
    chips: ["affectsCashflow"],
  },
  {
    id: "mortgage_home_purchase",
    categories: ["popular", "housing", "loans"],
    drawerType: "housing",
    chips: ["affectsCashflow", "affectsNetWorth", "requiresLiability"],
  },
  {
    id: "housing_fees_rates",
    categories: ["housing", "assets"],
    drawerType: "cashflow",
    chips: ["affectsCashflow", "affectsNetWorth"],
  },
  {
    id: "buy_car",
    categories: ["assets"],
    drawerType: "cashflow",
    chips: ["affectsCashflow", "affectsNetWorth"],
  },
  {
    id: "monthly_investing",
    categories: ["assets"],
    drawerType: "cashflow",
    chips: ["affectsCashflow", "affectsNetWorth"],
  },
  {
    id: "personal_loan",
    categories: ["loans"],
    drawerType: "loan",
    chips: ["affectsCashflow", "requiresLiability"],
  },
  {
    id: "car_loan",
    categories: ["loans"],
    drawerType: "loan",
    chips: ["affectsCashflow", "requiresLiability"],
  },
  {
    id: "credit_card_balance",
    categories: ["loans"],
    drawerType: "loan",
    chips: ["affectsCashflow", "requiresLiability"],
  },
  {
    id: "life_new_baby_plan",
    categories: ["life_events"],
    drawerType: "bundle",
    chips: ["affectsCashflow"],
    isBundle: true,
  },
  {
    id: "life_home_purchase",
    categories: ["life_events", "housing", "assets"],
    drawerType: "bundle",
    chips: ["affectsCashflow", "affectsNetWorth", "requiresLiability"],
    isBundle: true,
  },
  {
    id: "life_marriage_plan",
    categories: ["life_events", "expenses"],
    drawerType: "bundle",
    chips: ["affectsCashflow"],
    isBundle: true,
  },
];

export const listTemplates = () => templateRegistry;

export const getTemplateDef = (id: TemplateId) =>
  templateRegistry.find((template) => template.id === id);
