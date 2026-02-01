import type { PlanSnapshot } from "../../src/domain/planLab/types";
import { diffSummaryFromPatches } from "../../src/domain/planLab/diffSummary";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

export const diffPlanSnapshots = (
  a: PlanSnapshot,
  b: PlanSnapshot,
  translate?: TranslateFn
): string[] => {
  return diffSummaryFromPatches(a.payload, b.payload, translate);
};
