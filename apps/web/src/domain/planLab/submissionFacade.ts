import type { Scenario, BudgetRule, ScenarioMember } from "../../store/scenarioStore";
import type { EventDefinition } from "../events/types";
import type { SubmitScenarioDraftPayload } from "../scenarioDraft/submitScenarioDraft";

export type PlanLabSubmissionFacade = {
  createScenario: (name: string, options?: { onboardingCompleted?: boolean }) => Scenario;
  replaceScenario: (scenario: Scenario) => void;
  setActiveScenario: (id: string) => void;
  upsertEventDefinition: (definition: EventDefinition) => void;
  updateBudgetRule: (id: string, patch: Partial<BudgetRule>) => void;
  createMember: (member: ScenarioMember) => void;
  createBudgetRule: (rule: BudgetRule) => void;
};

type SubmitPlanLabScenarioDraftArgs = {
  baselineScenario: Scenario;
  scenarioName: string;
  payload: SubmitScenarioDraftPayload;
  eventDefinitions: EventDefinition[];
  budgetRules?: BudgetRule[];
  addedMembers: ScenarioMember[];
  addedBudgetRules: BudgetRule[];
  facade: PlanLabSubmissionFacade;
};

export const submitPlanLabScenarioDraft = ({
  baselineScenario,
  scenarioName,
  payload,
  eventDefinitions,
  budgetRules,
  addedMembers,
  addedBudgetRules,
  facade,
}: SubmitPlanLabScenarioDraftArgs): Scenario => {
  const created = facade.createScenario(scenarioName, { onboardingCompleted: true });

  eventDefinitions.forEach((definition) => {
    facade.upsertEventDefinition(definition);
  });
  budgetRules?.forEach((rule) => {
    facade.updateBudgetRule(rule.id, rule);
  });
  addedMembers.forEach((member) => {
    facade.createMember(member);
  });
  addedBudgetRules.forEach((rule) => {
    facade.createBudgetRule(rule);
  });

  const nextScenario: Scenario = {
    ...baselineScenario,
    id: created.id,
    name: created.name,
    updatedAt: created.updatedAt,
    snapshots: [],
    plans: [],
    assumptions: payload.assumptions,
    members: payload.members,
    assets: payload.assets,
    liabilities: payload.liabilities,
    events: payload.events,
    meta: {
      ...payload.meta,
      onboarded: true,
    },
    clientComputed: {
      ...payload.clientComputed,
      onboardingCompleted: true,
    },
    baseCurrency: payload.baseCurrency,
  };

  facade.replaceScenario(nextScenario);
  facade.setActiveScenario(nextScenario.id);
  return nextScenario;
};
