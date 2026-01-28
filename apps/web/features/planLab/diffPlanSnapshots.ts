import type {
  PlanLabExperiment,
  PlanLabBaselinePatches,
  PlanSnapshot,
} from "../../src/domain/planLab/types";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

const buildPatchSignature = (patch: {
  isDisabled?: boolean;
  endMonth?: string;
  amount?: number | null;
}) =>
  JSON.stringify({
    isDisabled: patch.isDisabled ?? null,
    endMonth: patch.endMonth ?? null,
    amount: patch.amount ?? null,
  });

type EventPatch = NonNullable<PlanLabBaselinePatches["eventPatches"]>[string];
type RulePatch = NonNullable<PlanLabBaselinePatches["rulePatches"]>[string];
type PositionPatch = NonNullable<PlanLabBaselinePatches["positionPatches"]>[string];

const extractAmountFromEventPatch = (patch: EventPatch | undefined) => {
  if (!patch?.patch?.rule) {
    return null;
  }
  const rule = patch.patch.rule as Record<string, unknown>;
  const candidates = [
    "monthlyAmount",
    "oneTimeAmount",
    "annualAmount",
    "monthlyPayment",
  ];
  for (const key of candidates) {
    const value = rule[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return null;
};

const extractAmountFromRulePatch = (patch: RulePatch | undefined) => {
  const value = patch?.patch?.monthlyAmount;
  return typeof value === "number" ? value : null;
};

const extractAmountFromPositionPatch = (patch: PositionPatch | undefined) => {
  const candidateKeys = [
    "price",
    "balance",
    "currentValue",
    "loanBalance",
    "monthlyPayment",
    "downPayment",
  ];
  const patchValue = patch?.patch as Record<string, unknown> | undefined;
  if (!patchValue) {
    return null;
  }
  for (const key of candidateKeys) {
    const value = patchValue[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return null;
};

const countPatchDifferences = <T extends Record<string, unknown>>(
  a: Record<string, T>,
  b: Record<string, T>,
  getSignature: (patch: T | undefined) => string
) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let diffCount = 0;
  keys.forEach((key) => {
    const signatureA = getSignature(a[key]);
    const signatureB = getSignature(b[key]);
    if (signatureA !== signatureB) {
      diffCount += 1;
    }
  });
  return diffCount;
};

const buildExperimentSignature = (experiment: PlanLabExperiment) => {
  if (experiment.type === "oneOffExpense") {
    return `oneOffExpense:${experiment.month ?? ""}:${experiment.amount ?? ""}`;
  }
  if (experiment.type === "rangeExpense") {
    return `rangeExpense:${experiment.startMonth ?? ""}:${experiment.endMonth ?? ""}:${experiment.monthlyAmount ?? ""}`;
  }
  if (experiment.type === "travelAnnual") {
    return `travelAnnual:${experiment.startMonth ?? ""}:${experiment.annualAmount ?? ""}`;
  }
  if (experiment.type === "homeBuy") {
    return `homeBuy:${experiment.purchaseMonth ?? ""}:${experiment.purchasePrice ?? ""}`;
  }
  if (experiment.type === "carPlan") {
    return `carPlan:${experiment.purchaseMonth ?? ""}:${experiment.purchasePrice ?? ""}`;
  }
  if (experiment.type === "incomeAdjust") {
    return `incomeAdjust:${experiment.startMonth ?? ""}:${experiment.monthlyAmount ?? ""}`;
  }
  if (experiment.type === "smartInvestAdjust") {
    return `smartInvestAdjust:${experiment.reserveMode ?? ""}:${experiment.contributionMode ?? ""}`;
  }
  return "unknown";
};

export const diffPlanSnapshots = (
  a: PlanSnapshot,
  b: PlanSnapshot,
  translate?: TranslateFn
): string[] => {
  const t =
    translate ??
    ((_, fallback) => fallback);

  const diffs: string[] = [];
  const aBaseline = a.baselinePatches ?? {};
  const bBaseline = b.baselinePatches ?? {};

  const eventDiffs = countPatchDifferences(
    aBaseline.eventPatches ?? {},
    bBaseline.eventPatches ?? {},
    (patch) =>
      buildPatchSignature({
        isDisabled: patch?.isDisabled,
        endMonth: patch?.endMonth,
        amount: extractAmountFromEventPatch(patch),
      })
  );
  if (eventDiffs > 0) {
    diffs.push(
      t(
        "planLabDiffBaselineEvents",
        "Baseline events differ for {count} item(s).",
        { count: eventDiffs }
      )
    );
  }

  const ruleDiffs = countPatchDifferences(
    aBaseline.rulePatches ?? {},
    bBaseline.rulePatches ?? {},
    (patch) =>
      buildPatchSignature({
        isDisabled: patch?.isDisabled,
        endMonth: patch?.endMonth,
        amount: extractAmountFromRulePatch(patch),
      })
  );
  if (ruleDiffs > 0) {
    diffs.push(
      t(
        "planLabDiffBaselineRules",
        "Baseline rules differ for {count} item(s).",
        { count: ruleDiffs }
      )
    );
  }

  const positionDiffs = countPatchDifferences(
    aBaseline.positionPatches ?? {},
    bBaseline.positionPatches ?? {},
    (patch) =>
      buildPatchSignature({
        isDisabled: patch?.isDisabled,
        endMonth: undefined,
        amount: extractAmountFromPositionPatch(patch),
      })
  );
  if (positionDiffs > 0) {
    diffs.push(
      t(
        "planLabDiffBaselinePositions",
        "Baseline positions differ for {count} item(s).",
        { count: positionDiffs }
      )
    );
  }

  const aExperiments = (a.experiments ?? []).filter(
    (experiment) => experiment.isEnabled !== false
  );
  const bExperiments = (b.experiments ?? []).filter(
    (experiment) => experiment.isEnabled !== false
  );
  const aExperimentSet = new Set(
    aExperiments.map((experiment) => buildExperimentSignature(experiment))
  );
  const bExperimentSet = new Set(
    bExperiments.map((experiment) => buildExperimentSignature(experiment))
  );
  const onlyA = Array.from(aExperimentSet).filter(
    (signature) => !bExperimentSet.has(signature)
  );
  const onlyB = Array.from(bExperimentSet).filter(
    (signature) => !aExperimentSet.has(signature)
  );

  if (onlyA.length > 0) {
    diffs.push(
      t(
        "planLabDiffExperimentsOnlyA",
        "Plan A has {count} experiment(s) not in Plan B.",
        { count: onlyA.length }
      )
    );
  }
  if (onlyB.length > 0) {
    diffs.push(
      t(
        "planLabDiffExperimentsOnlyB",
        "Plan B has {count} experiment(s) not in Plan A.",
        { count: onlyB.length }
      )
    );
  }

  if (diffs.length < 3) {
    diffs.push(
      t("planLabDiffSummaryFallback", "Additional parameters are aligned.")
    );
  }

  return diffs.slice(0, 8);
};
