export const templateIds = [
  "monthly_salary",
  "salary_adjustment",
  "bonus_13th",
  "rental_income",
  "dividends_interest",
  "living_total",
  "living_breakdown",
  "rent_housing",
  "insurance_quick",
  "insurance_detailed",
  "childcare_monthly",
  "one_time_big_expense",
  "mortgage_home_purchase",
  "housing_fees_rates",
  "buy_car",
  "monthly_investing",
  "personal_loan",
  "car_loan",
  "credit_card_balance",
  "life_new_baby_plan",
  "life_home_purchase",
  "life_rental_plan",
  "life_marriage_plan",
] as const;

export type TemplateId = (typeof templateIds)[number];

export type TemplateCategory =
  | "popular"
  | "life_events"
  | "income"
  | "expenses"
  | "housing"
  | "loans"
  | "insurance"
  | "assets"
  | "adjustments";

export type TemplateChip =
  | "affectsCashflow"
  | "affectsNetWorth"
  | "requiresLiability";

export type TemplateDrawerType =
  | "cashflow"
  | "housing"
  | "loan"
  | "insurance"
  | "adjustment"
  | "bundle";

export type TemplateDef = {
  id: TemplateId;
  categories: TemplateCategory[];
  drawerType: TemplateDrawerType;
  chips: TemplateChip[];
  isBundle?: boolean;
};
