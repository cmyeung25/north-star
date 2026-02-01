import type { ScenarioV2 } from "../../engine/scenarioV2Compiler";
import type { PlanLabSnapshotPayload } from "./types";
import { applyPatchToScenario } from "./snapshotPayload";

export const detectDoubleCountingWarnings = (
  baselineScenario: ScenarioV2,
  payload: PlanLabSnapshotPayload
): string[] => {
  const scenario = applyPatchToScenario(baselineScenario, payload);
  const warnings: string[] = [];

  const housingMortgages = (scenario.events ?? []).filter(
    (event) => event.type === "housing" && event.kind === "mortgage"
  );
  if (housingMortgages.length > 1) {
    warnings.push("Multiple mortgage housing events detected; double counting may occur.");
  }

  const cashflowExpenses = (scenario.events ?? []).filter(
    (event) => event.type === "cashflow" && event.kind === "expense"
  );
  const expenseLabelMap = new Map<string, number>();
  cashflowExpenses.forEach((event) => {
    const label = (event.label ?? "").trim().toLowerCase();
    if (!label) {
      return;
    }
    expenseLabelMap.set(label, (expenseLabelMap.get(label) ?? 0) + 1);
  });
  const duplicateExpenseLabels = Array.from(expenseLabelMap.entries()).filter(
    ([, count]) => count > 1
  );
  if (duplicateExpenseLabels.length > 0) {
    warnings.push(
      `Duplicate expense labels detected (${duplicateExpenseLabels
        .map(([label]) => label)
        .join(", ")}); double counting may occur.`
    );
  }

  return warnings;
};
