import type { EventDefinition } from "../events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";
import type { CompilerWarning } from "../warnings/types";
import { WarningCode } from "../warnings/types";
import type { PlanLabSnapshot, PlanPatch } from "./types";

type ValidatePlanPatchesInput = {
  patches: PlanPatch[];
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  budgetRules: BudgetRule[];
  members: ScenarioMember[];
};

const housingKeywords = ["home", "housing", "rent", "mortgage", "property", "flat"];

const getByPath = (value: unknown, path: string) => {
  if (!path) {
    return undefined;
  }
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, value);
};

const getScenarioPositionById = (scenario: Scenario, id?: string) => {
  if (!id) {
    return null;
  }
  const positions = scenario.positions;
  return (
    positions?.homes?.find((home) => home.id === id) ??
    positions?.cars?.find((car) => car.id === id) ??
    positions?.investments?.find((investment) => investment.id === id) ??
    positions?.insurances?.find((insurance) => insurance.id === id) ??
    positions?.loans?.find((loan) => loan.id === id) ??
    positions?.cashBuckets?.find((bucket) => bucket.id === id) ??
    null
  );
};

const buildPatchWarning = (
  code: WarningCode,
  messageKey: string,
  defaultMessage: string,
  debug?: Record<string, unknown>
): CompilerWarning => ({
  code,
  severity: "warning",
  messageKey,
  defaultMessage,
  debug,
});

const buildInvalidPatchWarning = (patch: PlanPatch, reason: string) =>
  buildPatchWarning(
    WarningCode.InvalidPlanPatch,
    "warnings.planLabInvalidPatch",
    `Invalid plan patch: ${reason}`,
    patch.id ? { patchId: patch.id } : undefined
  );

export const validatePlanPatches = ({
  patches,
  scenario,
  eventLibrary,
  budgetRules,
  members,
}: ValidatePlanPatchesInput): CompilerWarning[] => {
  const warnings: CompilerWarning[] = [];

  patches.forEach((patch) => {
    if (!patch.entity) {
      warnings.push(buildInvalidPatchWarning(patch, "Missing entity."));
      return;
    }
    if (!patch.op) {
      warnings.push(buildInvalidPatchWarning(patch, "Missing op."));
      return;
    }
    if (
      (patch.entity === "asset" || patch.entity === "liability") &&
      !patch.id
    ) {
      return;
    }

    let baseValue: unknown = null;
    if (patch.entity === "event") {
      baseValue =
        eventLibrary.find((event) => event.id === patch.id) ?? null;
    }
    if (patch.entity === "rule") {
      baseValue = budgetRules.find((rule) => rule.id === patch.id) ?? null;
    }
    if (patch.entity === "member") {
      baseValue = members.find((member) => member.id === patch.id) ?? null;
    }
    if (patch.entity === "asset" || patch.entity === "liability") {
      baseValue = getScenarioPositionById(scenario, patch.id);
    }
    if (patch.entity === "moneyItem") {
      baseValue = null;
    }

    if (patch.op !== "add" && patch.op !== "remove" && patch.op !== "set") {
      warnings.push(buildInvalidPatchWarning(patch, "Unknown op."));
      return;
    }

    if (patch.op !== "add" && !baseValue && patch.entity !== "moneyItem") {
      warnings.push(
        buildInvalidPatchWarning(patch, `${patch.entity} not found.`)
      );
      return;
    }

    if (patch.path && baseValue) {
      const existing = getByPath(baseValue, patch.path);
      if (existing === undefined) {
        warnings.push(
          buildInvalidPatchWarning(patch, `Path "${patch.path}" not found.`)
        );
      } else if (
        patch.value !== undefined &&
        existing !== null &&
        typeof existing !== typeof patch.value
      ) {
        warnings.push(
          buildInvalidPatchWarning(patch, `Type mismatch at "${patch.path}".`)
        );
      }
    }
  });

  const hasHousingEventPatch = patches.some((patch) => {
    if (patch.entity !== "event") {
      return false;
    }
    const text = `${patch.entity}:${patch.id ?? ""}:${patch.path ?? ""}:${JSON.stringify(
      patch.value ?? ""
    )}`.toLowerCase();
    return housingKeywords.some((keyword) => text.includes(keyword));
  });
  const hasHousingAssetPatch = patches.some((patch) => {
    if (patch.entity !== "asset" && patch.entity !== "liability") {
      return false;
    }
    const text = `${patch.entity}:${patch.id ?? ""}:${patch.path ?? ""}:${JSON.stringify(
      patch.value ?? ""
    )}`.toLowerCase();
    return housingKeywords.some((keyword) => text.includes(keyword));
  });

  if (hasHousingEventPatch && hasHousingAssetPatch) {
    warnings.push(
      buildPatchWarning(
        WarningCode.DoubleCountingPlanPatch,
        "warnings.doubleCountingPlanPatch",
        "Plan patches include both housing events and housing positions; double counting may occur."
      )
    );
  }

  return warnings;
};

export const buildPlanPatchesFromSnapshot = (
  snapshot: PlanLabSnapshot
): PlanPatch[] => {
  const patches: PlanPatch[] = [];
  const baseline = snapshot.baselinePatches ?? {};

  Object.entries(baseline.eventPatches ?? {}).forEach(([id, patch]) => {
    if (!patch.isDisabled && !patch.endMonth && !patch.patch) {
      return;
    }
    patches.push({
      op: "set",
      entity: "event",
      id,
      path: "baseline",
      value: patch,
    });
  });

  Object.entries(baseline.rulePatches ?? {}).forEach(([id, patch]) => {
    if (!patch.isDisabled && !patch.endMonth && !patch.patch) {
      return;
    }
    patches.push({
      op: "set",
      entity: "rule",
      id,
      path: "baseline",
      value: patch,
    });
  });

  Object.entries(baseline.positionPatches ?? {}).forEach(([key, patch]) => {
    if (!patch.isDisabled && !patch.patch) {
      return;
    }
    const [kind, rawId] = key.split(":");
    const id = rawId?.startsWith("index-") ? undefined : rawId;
    const entity = kind === "loan" ? "liability" : "asset";
    patches.push({
      op: "set",
      entity,
      id,
      path: "baseline",
      value: patch,
    });
  });

  if (baseline.smartInvestPatch) {
    patches.push({
      op: "set",
      entity: "asset",
      id: "smartInvest",
      path: "baseline",
      value: baseline.smartInvestPatch,
      note: "smartInvest",
    });
  }

  (snapshot.experiments ?? []).forEach((experiment) => {
    patches.push({
      op: "add",
      entity: "event",
      id: experiment.id,
      path: "experiment",
      value: experiment,
    });
  });

  return patches;
};
