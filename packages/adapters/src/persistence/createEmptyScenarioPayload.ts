import type { ScenarioPayload } from "./types";

type CreateEmptyScenarioPayloadInput = {
  currency?: string;
  caseId?: string;
  scenarioId?: string;
  createdFrom?: string;
};

export const createEmptyScenarioPayload = (
  input: CreateEmptyScenarioPayloadInput = {},
): ScenarioPayload => ({
  schemaVersion: 1,
  scenarios: [],
  eventLibrary: [],
  activeScenarioId: "",
  members: [],
  budgetRules: [],
  appSettings: {
    globalBaseMonth: null,
    globalHorizonMonths: 360,
    annualInflationPct: 2.5,
    viewMode: "nominal",
  },
  meta: {
    caseId: input.caseId,
    scenarioId: input.scenarioId,
    currency: input.currency,
    onboarded: false,
    createdFrom: input.createdFrom ?? "member-create-case",
  },
  revision: 0,
});

