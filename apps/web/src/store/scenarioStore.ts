import { nanoid } from "nanoid";
import { create } from "zustand";
import { defaultCurrency } from "../../lib/i18n";

export type ScenarioRiskLevel = "Low" | "Medium" | "High";

export type ScenarioKpis = {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: ScenarioRiskLevel;
};

export type ScenarioAssumptions = {
  horizonMonths?: number;
  initialCash?: number;
};

export type EventType =
  | "rent"
  | "buy_home"
  | "baby"
  | "car"
  | "travel"
  | "insurance"
  | "helper"
  | "custom";

export type TimelineEvent = {
  id: string;
  type: EventType;
  name: string;
  startMonth: string;
  endMonth?: string | null;
  enabled: boolean;
  monthlyAmount?: number;
  oneTimeAmount?: number;
  annualGrowthPct?: number;
  currency: string;
};

export type Scenario = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  kpis: ScenarioKpis;
  assumptions?: ScenarioAssumptions;
  events?: TimelineEvent[];
};

type ScenarioStoreState = {
  scenarios: Scenario[];
  activeScenarioId: string;
  createScenario: (name: string, options?: { baseCurrency?: string }) => Scenario;
  renameScenario: (id: string, name: string) => void;
  duplicateScenario: (id: string) => Scenario | null;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string) => void;
  updateScenarioKpis: (id: string, kpis: ScenarioKpis) => void;
  upsertScenarioEvents: (id: string, events: TimelineEvent[]) => void;
  updateScenarioUpdatedAt: (id: string) => void;
};

const defaultKpis: ScenarioKpis = {
  lowestMonthlyBalance: -8000,
  runwayMonths: 14,
  netWorthYear5: 1200000,
  riskLevel: "Medium",
};

const now = () => Date.now();

const createScenarioId = () => `scenario-${nanoid(8)}`;
const createEventId = () => `event-${nanoid(10)}`;

const duplicateEvents = (events?: TimelineEvent[]) =>
  events?.map((event) => ({
    ...event,
    id: createEventId(),
  }));

const initialScenarios: Scenario[] = [
  {
    id: "scenario-plan-a",
    name: "Plan A · Rent + Baby",
    baseCurrency: defaultCurrency,
    updatedAt: 1716806400000,
    kpis: {
      lowestMonthlyBalance: -12000,
      runwayMonths: 18,
      netWorthYear5: 1650000,
      riskLevel: "Medium",
    },
    events: [
      {
        id: "event-plan-a-rent",
        type: "rent",
        name: "City Center Lease",
        startMonth: "2024-09",
        endMonth: null,
        enabled: true,
        monthlyAmount: 1800,
        oneTimeAmount: 0,
        annualGrowthPct: 3,
        currency: defaultCurrency,
      },
      {
        id: "event-plan-a-baby",
        type: "baby",
        name: "Newborn Expenses",
        startMonth: "2025-06",
        endMonth: "2026-06",
        enabled: true,
        monthlyAmount: 950,
        oneTimeAmount: 5000,
        annualGrowthPct: 2,
        currency: defaultCurrency,
      },
    ],
  },
  {
    id: "scenario-plan-b",
    name: "Plan B · Buy Home",
    baseCurrency: defaultCurrency,
    updatedAt: 1714387200000,
    kpis: {
      lowestMonthlyBalance: -32000,
      runwayMonths: 10,
      netWorthYear5: 2100000,
      riskLevel: "High",
    },
  },
  {
    id: "scenario-plan-c",
    name: "Plan C · Delay Car",
    baseCurrency: defaultCurrency,
    updatedAt: 1711708800000,
    kpis: {
      lowestMonthlyBalance: 8000,
      runwayMonths: 24,
      netWorthYear5: 1350000,
      riskLevel: "Low",
    },
  },
];

export const getScenarioById = (scenarios: Scenario[], id: string | null) =>
  scenarios.find((scenario) => scenario.id === id) ?? null;

export const getActiveScenario = (
  scenarios: Scenario[],
  activeScenarioId: string | null
) =>
  scenarios.find((scenario) => scenario.id === activeScenarioId) ??
  scenarios[0] ??
  null;

export const resolveScenarioIdFromQuery = (
  scenarioId: string | null,
  activeScenarioId: string | null,
  scenarios: Scenario[]
) => {
  if (scenarioId && scenarios.some((scenario) => scenario.id === scenarioId)) {
    return scenarioId;
  }

  if (activeScenarioId && scenarios.some((scenario) => scenario.id === activeScenarioId)) {
    return activeScenarioId;
  }

  return scenarios[0]?.id ?? "";
};

export const useScenarioStore = create<ScenarioStoreState>((set, get) => ({
  scenarios: initialScenarios,
  activeScenarioId: initialScenarios[0]?.id ?? "",
  createScenario: (name, options) => {
    const newScenario: Scenario = {
      id: createScenarioId(),
      name,
      baseCurrency: options?.baseCurrency ?? defaultCurrency,
      updatedAt: now(),
      kpis: { ...defaultKpis },
      events: [],
    };

    set((state) => ({
      scenarios: [newScenario, ...state.scenarios],
    }));

    return newScenario;
  },
  renameScenario: (id, name) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              name,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  duplicateScenario: (id) => {
    const source = get().scenarios.find((scenario) => scenario.id === id);
    if (!source) {
      return null;
    }

    const copy: Scenario = {
      ...source,
      id: createScenarioId(),
      name: `Copy of ${source.name}`,
      updatedAt: now(),
      events: duplicateEvents(source.events),
    };

    set((state) => ({
      scenarios: [copy, ...state.scenarios],
    }));

    return copy;
  },
  deleteScenario: (id) => {
    set((state) => {
      if (state.scenarios.length <= 1) {
        return state;
      }

      const remaining = state.scenarios.filter((scenario) => scenario.id !== id);
      const nextActiveId =
        state.activeScenarioId === id
          ? remaining[0]?.id ?? ""
          : state.activeScenarioId;

      return {
        scenarios: remaining.map((scenario) =>
          scenario.id === nextActiveId
            ? { ...scenario, updatedAt: now() }
            : scenario
        ),
        activeScenarioId: nextActiveId,
      };
    });
  },
  setActiveScenario: (id) => {
    set((state) => {
      if (!state.scenarios.some((scenario) => scenario.id === id)) {
        return state;
      }

      return {
        activeScenarioId: id,
        scenarios: state.scenarios.map((scenario) =>
          scenario.id === id ? { ...scenario, updatedAt: now() } : scenario
        ),
      };
    });
  },
  updateScenarioKpis: (id, kpis) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              kpis,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  upsertScenarioEvents: (id, events) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              events,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateScenarioUpdatedAt: (id) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
}));
