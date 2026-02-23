import { describe, expect, it } from "vitest";
import { SCENARIO_ASSUMPTION_OVERRIDE_KEYS } from "../../../components/ScenarioAssumptionsOverrideForm";
import { ENV_ASSUMPTION_LABELS } from "../../../features/planLab/assumptionLabels";
import {
  ASSUMPTION_IMPACT_KEYS,
  type AssumptionImpactKey,
} from "../assumptions/impactAnalyzer";
import { assertMoneyCategoryUiContract, UI_EXPENSE_CATEGORY_KEYS, UI_INCOME_CATEGORY_KEYS } from "../../features/money/categoryMeta";

const NON_IMPACT_ASSUMPTION_KEYS = ["emergencyFundMonths"] as const;

describe("taxonomy contract", () => {
  it("keeps assumption keys aligned across override form, impact analyzer, and labels", () => {
    const allKnownAssumptionKeys = [
      ...ASSUMPTION_IMPACT_KEYS,
      ...NON_IMPACT_ASSUMPTION_KEYS,
    ].sort();

    expect([...SCENARIO_ASSUMPTION_OVERRIDE_KEYS].sort()).toEqual(allKnownAssumptionKeys);

    const labelKeys = Object.keys(ENV_ASSUMPTION_LABELS).sort();
    expect(labelKeys).toEqual([...SCENARIO_ASSUMPTION_OVERRIDE_KEYS].sort());

    const impactKeySet = new Set<string>(ASSUMPTION_IMPACT_KEYS);
    expect(
      [...ASSUMPTION_IMPACT_KEYS].every((key) =>
        SCENARIO_ASSUMPTION_OVERRIDE_KEYS.includes(key as keyof typeof ENV_ASSUMPTION_LABELS)
      )
    ).toBe(true);

    const nonImpactKeys = SCENARIO_ASSUMPTION_OVERRIDE_KEYS.filter((key) => !impactKeySet.has(key));
    expect(nonImpactKeys.sort()).toEqual([...NON_IMPACT_ASSUMPTION_KEYS].sort());
  });

  it("keeps category taxonomy aligned with money UI mapping", () => {
    assertMoneyCategoryUiContract();
    expect(UI_INCOME_CATEGORY_KEYS.includes("other")).toBe(true);
    expect(UI_EXPENSE_CATEGORY_KEYS.includes("other")).toBe(true);
  });

  it("locks analyzer impact key contract", () => {
    const expected: AssumptionImpactKey[] = [
      "inflationRate",
      "salaryGrowthRate",
      "rentAnnualGrowthPct",
      "propertyAppreciationPct",
      "cashYieldPct",
      "carDepreciationRatePct",
    ];
    expect(ASSUMPTION_IMPACT_KEYS).toEqual(expected);
  });
});
