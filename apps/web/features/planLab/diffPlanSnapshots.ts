import type { PlanPatch, PlanSnapshot } from "../../src/domain/planLab/types";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

const patchKey = (patch: PlanPatch) =>
  `${patch.entity}:${patch.id ?? "none"}:${patch.path ?? "root"}`;

const patchSignature = (patch: PlanPatch) =>
  JSON.stringify({
    op: patch.op,
    entity: patch.entity,
    id: patch.id ?? null,
    path: patch.path ?? null,
    value: patch.value ?? null,
  });

export const diffPlanSnapshots = (
  a: PlanSnapshot,
  b: PlanSnapshot,
  translate?: TranslateFn
): string[] => {
  const t =
    translate ??
    ((_, fallback) => fallback);

  const diffs: string[] = [];
  const aMap = new Map(a.patches.map((patch) => [patchKey(patch), patch]));
  const bMap = new Map(b.patches.map((patch) => [patchKey(patch), patch]));
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);

  let onlyA = 0;
  let onlyB = 0;
  let changed = 0;

  allKeys.forEach((key) => {
    const patchA = aMap.get(key);
    const patchB = bMap.get(key);
    if (patchA && !patchB) {
      onlyA += 1;
      return;
    }
    if (!patchA && patchB) {
      onlyB += 1;
      return;
    }
    if (patchA && patchB && patchSignature(patchA) !== patchSignature(patchB)) {
      changed += 1;
    }
  });

  if (onlyA > 0) {
    diffs.push(
      t("planLabDiffOnlyA", "Plan A only: {count} change(s).", { count: onlyA })
    );
  }
  if (onlyB > 0) {
    diffs.push(
      t("planLabDiffOnlyB", "Plan B only: {count} change(s).", { count: onlyB })
    );
  }
  if (changed > 0) {
    diffs.push(
      t(
        "planLabDiffChanged",
        "Same path, different values: {count} change(s).",
        { count: changed }
      )
    );
  }

  if (diffs.length === 0) {
    diffs.push(t("planLabDiffSummaryFallback", "Additional parameters are aligned."));
  }

  return diffs.slice(0, 6);
};
