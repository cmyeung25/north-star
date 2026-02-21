import type { EventDefinition } from "../events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import type { PlanLabDraft } from "./types";
import { applyPlanLabDraftToScenario } from "./applyPlanLabDraftToScenario";
import { submitScenarioDraft } from "../scenarioDraft/submitScenarioDraft";
import type { ScenarioDraft, ValidationIssue } from "../scenarioDraft/types";

export type PlanLabMaterializeResult = {
  scenario: Scenario;
  eventDefinitions: EventDefinition[];
  budgetRules?: BudgetRule[];
  addedMembers: ScenarioMember[];
  addedBudgetRules: BudgetRule[];
  warnings: ReturnType<typeof applyPlanLabDraftToScenario>["warnings"];
  errors: ReturnType<typeof applyPlanLabDraftToScenario>["errors"];
};

export type PlanLabDraftBuildResult = {
  scenarioDraft: ScenarioDraft;
  eventDefinitions: EventDefinition[];
  budgetRules?: BudgetRule[];
  addedMembers: ScenarioMember[];
  addedBudgetRules: BudgetRule[];
  warnings: ReturnType<typeof applyPlanLabDraftToScenario>["warnings"];
  errors: Array<
    ReturnType<typeof applyPlanLabDraftToScenario>["errors"][number] | ValidationIssue
  >;
};


const toPlanLabError = (
  issue:
    | ReturnType<typeof applyPlanLabDraftToScenario>["errors"][number]
    | ValidationIssue
): ReturnType<typeof applyPlanLabDraftToScenario>["errors"][number] | null => {
  if (issue.code === "invalid-month") {
    return { code: "invalid-month", field: issue.field, message: issue.message };
  }
  if (issue.code === "required") {
    return { code: "missing-month", field: issue.field, message: issue.message };
  }
  return null;
};

const normalizeOptionalMonth = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  return normalized.ok ? normalized.month : null;
};

export const buildScenarioDraftFromPlanLab = (
  baseScenario: Scenario,
  draft: PlanLabDraft,
  options: {
    scenarioId: string;
    budgetRules?: BudgetRule[];
  }
): PlanLabDraftBuildResult => {
  const result = applyPlanLabDraftToScenario(baseScenario, draft, {
    scenarioId: options.scenarioId,
    budgetRules: options.budgetRules,
  });

  const additions = draft.additions ?? {};
  const addedMembers: ScenarioMember[] = [];
  const addedBudgetRules: BudgetRule[] = [];
  const errors = [...result.errors];

  (additions.members ?? []).forEach((member) => {
    const normalizedBirthMonth = normalizeOptionalMonth(member.birthMonth);
    if (member.birthMonth && !normalizedBirthMonth) {
      errors.push({
        code: "invalid-month",
        field: `additions.members.${member.id}.birthMonth`,
        message: `additions.members.${member.id}.birthMonth has invalid month ${member.birthMonth}.`,
      });
      return;
    }
    addedMembers.push({
      ...member,
      birthMonth: normalizedBirthMonth ?? undefined,
      applyScope: { scope: "include", scenarioIds: [options.scenarioId] },
    });
  });

  (additions.budgetRules ?? []).forEach((rule) => {
    const normalizedStartMonth = normalizeOptionalMonth(rule.startMonth);
    if (rule.startMonth && !normalizedStartMonth) {
      errors.push({
        code: "invalid-month",
        field: `additions.budgetRules.${rule.id}.startMonth`,
        message: `additions.budgetRules.${rule.id}.startMonth has invalid month ${rule.startMonth}.`,
      });
      return;
    }
    const normalizedEndMonth = normalizeOptionalMonth(rule.endMonth);
    if (rule.endMonth && !normalizedEndMonth) {
      errors.push({
        code: "invalid-month",
        field: `additions.budgetRules.${rule.id}.endMonth`,
        message: `additions.budgetRules.${rule.id}.endMonth has invalid month ${rule.endMonth}.`,
      });
      return;
    }
    addedBudgetRules.push({
      ...rule,
      startMonth: normalizedStartMonth ?? undefined,
      endMonth: normalizedEndMonth ?? undefined,
      applyScope: { scope: "include", scenarioIds: [options.scenarioId] },
    });
  });

  return {
    scenarioDraft: {
      assumptions: result.scenario.assumptions,
      members: result.scenario.members,
      assets: result.scenario.assets,
      liabilities: result.scenario.liabilities,
      events: result.scenario.events,
      meta: {
        ...result.scenario.meta,
        onboarded: true,
      },
      clientComputed: {
        ...result.scenario.clientComputed,
        onboardingCompleted: true,
      },
      baseCurrency: result.scenario.baseCurrency,
    },
    eventDefinitions: result.eventDefinitions,
    budgetRules: result.budgetRules,
    warnings: result.warnings,
    addedMembers,
    addedBudgetRules,
    errors,
  };
};

export const materializePlanLabDraft = (
  baseScenario: Scenario,
  draft: PlanLabDraft,
  options: {
    scenarioId: string;
    budgetRules?: BudgetRule[];
  }
): PlanLabMaterializeResult => {
  const buildResult = buildScenarioDraftFromPlanLab(baseScenario, draft, options);
  const submitResult = submitScenarioDraft({
    source: "plan-lab",
    target: { scenarioId: options.scenarioId },
    draft: buildResult.scenarioDraft,
    context: {
      assumptionsBase: baseScenario.assumptions,
      metaBase: baseScenario.meta,
      clientComputedBase: baseScenario.clientComputed,
    },
  });

  const compiledScenarioPayload = submitResult.payload;
  return {
    scenario: {
      ...baseScenario,
      assumptions: compiledScenarioPayload.assumptions,
      members: compiledScenarioPayload.members,
      assets: compiledScenarioPayload.assets,
      liabilities: compiledScenarioPayload.liabilities,
      events: compiledScenarioPayload.events,
      meta: compiledScenarioPayload.meta,
      clientComputed: compiledScenarioPayload.clientComputed,
      baseCurrency: compiledScenarioPayload.baseCurrency,
    },
    eventDefinitions: buildResult.eventDefinitions,
    budgetRules: buildResult.budgetRules,
    addedMembers: buildResult.addedMembers,
    addedBudgetRules: buildResult.addedBudgetRules,
    warnings: buildResult.warnings,
    errors: [...buildResult.errors, ...submitResult.errors]
      .map((issue) => toPlanLabError(issue))
      .filter((issue): issue is ReturnType<typeof applyPlanLabDraftToScenario>["errors"][number] =>
        issue !== null
      ),
  };
};
