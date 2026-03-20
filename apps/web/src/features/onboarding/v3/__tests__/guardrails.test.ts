import { describe, expect, it } from "vitest";
import type { ScenarioAsset } from "../../../../store/scenarioStore";
import {
  buildOnboardingGuardrailSummary,
  ONBOARDING_GUARDRAIL_RULES,
} from "../guardrails";
import { createInitialScenarioDraftV3State, type ScenarioDraftV3State } from "../types";

const buildDraft = (): ScenarioDraftV3State => {
  const draft = createInitialScenarioDraftV3State({ defaultMemberName: "Me" });
  draft.profile.startMonth = "2026-03";
  draft.profile.baseCurrency = "HKD";
  return draft;
};

describe("buildOnboardingGuardrailSummary", () => {
  it("defines action-oriented metadata for every onboarding guardrail rule", () => {
    expect(ONBOARDING_GUARDRAIL_RULES).not.toHaveLength(0);
    for (const rule of ONBOARDING_GUARDRAIL_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.severity).toBeTruthy();
      expect(typeof rule.blocksSubmission).toBe("boolean");
      expect(rule.messageKey).toBeTruthy();
      expect(rule.actionHintKey).toBeTruthy();
      expect(rule.target.stepId).toBeTruthy();
      expect(rule.target.section).toBeTruthy();
    }
  });

  it("keeps only baseline-distorting housing/property conflicts as blocking criticals", () => {
    expect(
      ONBOARDING_GUARDRAIL_RULES.map((rule) => ({
        id: rule.id,
        severity: rule.severity,
        blocksSubmission: rule.blocksSubmission,
        category: rule.category,
        target: rule.target,
      }))
    ).toEqual([
      {
        id: "property_usage_missing",
        severity: "warning",
        blocksSubmission: false,
        category: "key_missing",
        target: { stepId: "assets", section: "property" },
      },
      {
        id: "mortgage_core_fields_missing",
        severity: "critical",
        blocksSubmission: true,
        category: "key_missing",
        target: { stepId: "assets", section: "mortgage" },
      },
      {
        id: "self_use_rental_conflict",
        severity: "critical",
        blocksSubmission: true,
        category: "obvious_conflict",
        target: { stepId: "assets", section: "housing" },
      },
      {
        id: "rental_property_income_missing",
        severity: "warning",
        blocksSubmission: false,
        category: "basic_inconsistency",
        target: { stepId: "assets", section: "property" },
      },
      {
        id: "mortgage_property_basics_missing",
        severity: "warning",
        blocksSubmission: false,
        category: "basic_inconsistency",
        target: { stepId: "assets", section: "mortgage" },
      },
      {
        id: "duplicate_current_home_housing_costs",
        severity: "warning",
        blocksSubmission: false,
        category: "potential_double_counting",
        target: { stepId: "expense", section: "fixedExpenses" },
      },
      {
        id: "duplicate_rent_expense_inputs",
        severity: "info",
        blocksSubmission: false,
        category: "potential_double_counting",
        target: { stepId: "expense", section: "housing" },
      },
    ]);
  });

  it("flags missing property usage as a key-missing warning", () => {
    const draft = buildDraft();
    draft.assets.push({
      id: "property-1",
      assetType: "property",
      kind: "home",
      label: "Flat",
      currentValue: 6_800_000,
      startMonth: "2026-03",
    });

    const summary = buildOnboardingGuardrailSummary({ draft });

    expect(summary.level).toBe("warning");
    const item = summary.items.find((candidate) => candidate.id === "property_usage_missing");
    expect(item?.severity).toBe("warning");
    expect(item?.category).toBe("key_missing");
    expect(item?.target).toEqual({ stepId: "assets", section: "property" });
  });

  it("marks missing mortgage core fields as critical", () => {
    const draft = buildDraft();
    draft.assets.push({
      id: "property-1",
      assetType: "property",
      kind: "home",
      label: "Home",
      currentValue: 7_200_000,
      startMonth: "2026-03",
      usage: "self",
      mortgagePrincipalOutstanding: 3_100_000,
    });

    const summary = buildOnboardingGuardrailSummary({ draft });

    expect(summary.level).toBe("critical");
    expect(summary.counts.critical).toBe(1);
    expect(summary.items[0]).toMatchObject({
      id: "mortgage_core_fields_missing",
      severity: "critical",
      category: "key_missing",
    });
  });

  it("catches self-use and rental-income conflicts on the same property", () => {
    const draft = buildDraft();
    draft.assets.push({
      id: "property-1",
      assetType: "property",
      kind: "home",
      label: "Current home",
      currentValue: 8_000_000,
      startMonth: "2026-03",
      usage: "self",
      rentMonthly: 18_000,
    });

    const summary = buildOnboardingGuardrailSummary({ draft });

    expect(summary.level).toBe("critical");
    const item = summary.items.find((candidate) => candidate.id === "self_use_rental_conflict");
    expect(item?.severity).toBe("critical");
    expect(item?.category).toBe("obvious_conflict");
  });

  it("warns when rental property state is missing rental income and basic property anchors", () => {
    const draft = buildDraft();
    draft.assets.push({
      id: "property-1",
      assetType: "property",
      kind: "home",
      label: "Rental flat",
      usage: "rent",
      mortgagePrincipalOutstanding: 2_200_000,
      mortgageAnnualInterestRatePct: 3.5,
      mortgageTermYears: 20,
    });

    const summary = buildOnboardingGuardrailSummary({ draft });

    expect(summary.level).toBe("warning");
    expect(summary.categories.basic_inconsistency >= 1).toBe(true);
    const ruleIds = summary.items.map((item) => item.id);
    expect(ruleIds.includes("rental_property_income_missing")).toBe(true);
    expect(ruleIds.includes("mortgage_property_basics_missing")).toBe(true);
  });

  it("detects potential duplicate housing spend without reading the engine", () => {
    const draft = buildDraft();
    draft.assets.push({
      id: "property-1",
      assetType: "property",
      kind: "home",
      label: "Current home",
      currentValue: 7_500_000,
      startMonth: "2026-03",
      usage: "self",
      mortgagePrincipalOutstanding: 3_000_000,
      mortgageAnnualInterestRatePct: 3.25,
      mortgageTermYears: 25,
    });
    draft.events.push(
      {
        id: "rent-1",
        type: "cashflow",
        kind: "expense",
        label: "Current rent",
        amount: 18_000,
        cadence: "monthly",
        startMonth: "2026-03",
        growthSource: "rentGrowth",
      },
      {
        id: "rent-2",
        type: "cashflow",
        kind: "expense",
        label: "Rent parking bundle",
        amount: 2_000,
        cadence: "monthly",
        startMonth: "2026-03",
        tags: ["onboarding:v3:expense:rent"],
      }
    );

    const summary = buildOnboardingGuardrailSummary({ draft });

    const ruleIds = summary.items.map((item) => item.id);
    expect(ruleIds.includes("duplicate_current_home_housing_costs")).toBe(true);
    expect(ruleIds.includes("duplicate_rent_expense_inputs")).toBe(true);
    expect(summary.categories.potential_double_counting).toBe(2);
    expect(summary.counts.warning >= 1).toBe(true);
    expect(summary.counts.info).toBe(1);
  });

  it("keeps info-only duplicate reminders out of the blocking summary level", () => {
    const draft = buildDraft();
    draft.events.push(
      {
        id: "rent-1",
        type: "cashflow",
        kind: "expense",
        label: "Current rent",
        amount: 18_000,
        cadence: "monthly",
        startMonth: "2026-03",
        growthSource: "rentGrowth",
      },
      {
        id: "rent-2",
        type: "cashflow",
        kind: "expense",
        label: "Second rent row",
        amount: 5_000,
        cadence: "monthly",
        startMonth: "2026-03",
        tags: ["onboarding:v3:expense:rent"],
      }
    );

    const summary = buildOnboardingGuardrailSummary({ draft });

    expect(summary.level).toBe("clear");
    expect(summary.counts.critical).toBe(0);
    expect(summary.counts.warning).toBe(0);
    expect(summary.counts.info).toBe(1);
    expect(summary.items[0]?.id).toBe("duplicate_rent_expense_inputs");
  });

  it("can evaluate active-scenario fallback signals without cross-scenario writes", () => {
    const draft = buildDraft();

    const summary = buildOnboardingGuardrailSummary({
      draft,
      scenario: {
        assets: [
          {
            id: "property-1",
            kind: "home",
            label: "Current home",
            currentValue: 7_100_000,
            startMonth: "2026-03",
            usage: "self",
          } as ScenarioAsset & { usage: "self" },
        ],
        events: [
          {
            id: "rent-1",
            type: "cashflow",
            kind: "expense",
            label: "Rent",
            amount: 16_000,
            cadence: "monthly",
            startMonth: "2026-03",
            growthSource: "rentGrowth",
          },
        ],
      },
    });

    expect(summary.items.map((item) => item.id)).toContain(
      "duplicate_current_home_housing_costs"
    );
  });
});
