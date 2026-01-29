import type { PlanPatch, PlanSnapshot } from "../../src/domain/planLab/types";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

const buildPatchKey = (patch: PlanPatch) =>
  `${patch.entity}:${patch.id ?? "unknown"}:${patch.path ?? "root"}`;

const buildPatchSignature = (patch: PlanPatch) =>
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
  const aPatchMap = new Map(
    a.patches.map((patch) => [buildPatchKey(patch), patch])
  );
  const bPatchMap = new Map(
    b.patches.map((patch) => [buildPatchKey(patch), patch])
  );
  const allKeys = new Set([...aPatchMap.keys(), ...bPatchMap.keys()]);
  const onlyA: PlanPatch[] = [];
  const onlyB: PlanPatch[] = [];
  const differentValue: PlanPatch[] = [];

  allKeys.forEach((key) => {
    const aPatch = aPatchMap.get(key);
    const bPatch = bPatchMap.get(key);
    if (aPatch && !bPatch) {
      onlyA.push(aPatch);
      return;
    }
    if (bPatch && !aPatch) {
      onlyB.push(bPatch);
      return;
    }
    if (aPatch && bPatch) {
      if (buildPatchSignature(aPatch) !== buildPatchSignature(bPatch)) {
        differentValue.push(aPatch);
      }
    }
  });

  if (onlyA.length > 0) {
    diffs.push(
      t("planLabDiffPatchesOnlyA", "Only Plan A has {count} change(s).", {
        count: onlyA.length,
      })
    );
  }
  if (onlyB.length > 0) {
    diffs.push(
      t("planLabDiffPatchesOnlyB", "Only Plan B has {count} change(s).", {
        count: onlyB.length,
      })
    );
  }
  if (differentValue.length > 0) {
    diffs.push(
      t(
        "planLabDiffPatchesChanged",
        "{count} change(s) differ on the same path.",
        { count: differentValue.length }
      )
    );
  }

  if (diffs.length === 0) {
    diffs.push(t("planLabDiffSummaryFallback", "Additional parameters are aligned."));
  }

  return diffs.slice(0, 6);
};
