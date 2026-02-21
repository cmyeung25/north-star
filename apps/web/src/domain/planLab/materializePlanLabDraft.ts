import type { EventDefinition } from "../events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import type { PlanLabDraft } from "./types";
import { applyPlanLabDraftToScenario } from "./applyPlanLabDraftToScenario";
import { compileScenarioCreatePayload } from "../scenarioDraft/compile";
import type { ScenarioDraft } from "../scenarioDraft/types";

export type PlanLabMaterializeResult = {
  scenario: Scenario;
  eventDefinitions: EventDefinition[];
  budgetRules?: BudgetRule[];
  addedMembers: ScenarioMember[];
  addedBudgetRules: BudgetRule[];
  warnings: ReturnType<typeof applyPlanLabDraftToScenario>["warnings"];
  errors: ReturnType<typeof applyPlanLabDraftToScenario>["errors"];
};

const normalizeOptionalMonth = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  return normalized.ok ? normalized.month : null;
};

export const materializePlanLabDraft = (
  baseScenario: Scenario,
  draft: PlanLabDraft,
  options: {
    scenarioId: string;
    budgetRules?: BudgetRule[];
  }
): PlanLabMaterializeResult => {
  const result = applyPlanLabDraftToScenario(baseScenario, draft, {
    scenarioId: options.scenarioId,
    budgetRules: options.budgetRules,
  });

  const additions = draft.additions ?? {};
  const compiledScenarioPayload = compileScenarioCreatePayload(
    {
      assumptions: result.scenario.assumptions,
      members: result.scenario.members,
      assets: result.scenario.assets,
      liabilities: result.scenario.liabilities,
      events: result.scenario.events,
      meta: result.scenario.meta,
      clientComputed: result.scenario.clientComputed,
      baseCurrency: result.scenario.baseCurrency,
    } satisfies ScenarioDraft,
    {
      assumptionsBase: baseScenario.assumptions,
      metaBase: baseScenario.meta,
      clientComputedBase: baseScenario.clientComputed,
    }
  );
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
    ...result,
    scenario: {
      ...result.scenario,
      assumptions: compiledScenarioPayload.assumptions,
      members: compiledScenarioPayload.members,
      assets: compiledScenarioPayload.assets,
      liabilities: compiledScenarioPayload.liabilities,
      events: compiledScenarioPayload.events,
      meta: compiledScenarioPayload.meta,
      clientComputed: compiledScenarioPayload.clientComputed,
      baseCurrency: compiledScenarioPayload.baseCurrency,
    },
    addedMembers,
    addedBudgetRules,
    errors: [
      ...errors,
      ...compiledScenarioPayload.validationIssues
        .filter((issue) => issue.code === "invalid-month" || issue.code === "required")
        .map((issue) => ({
          code: issue.code === "required" ? "missing-month" as const : "invalid-month" as const,
          field: issue.field,
          message: issue.message,
        })),
    ],
  };
};
