import { nanoid } from "nanoid";
import { create } from "zustand";
import { defaultCurrency } from "../../lib/i18n";
import type { TimelineEvent } from "../features/timeline/schema";

export type { EventType, TimelineEvent } from "../features/timeline/schema";

export type ScenarioRiskLevel = "Low" | "Medium" | "High";

export type ScenarioKpis = {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: ScenarioRiskLevel;
};

export type ScenarioAssumptions = {
  horizonMonths: number;
  initialCash: number;
  baseMonth: string | null;
  inflationRate?: number;
  salaryGrowthRate?: number;
  emergencyFundMonths?: number;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
};

export type HomeMortgage = {
  principal: number;
  annualRatePct: number;
  termMonths: number;
};

export type HomePosition = {
  purchasePrice: number;
  downPayment: number;
  purchaseMonth: string;
  annualAppreciationPct: number;
  feesOneTime?: number;
  mortgage?: HomeMortgage;
};

export type ScenarioPositions = {
  home?: HomePosition;
};

export type Scenario = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  kpis: ScenarioKpis;
  assumptions: ScenarioAssumptions;
  events?: TimelineEvent[];
  positions?: ScenarioPositions;
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
  upsertHomePosition: (id: string, home: HomePosition) => void;
  clearHomePosition: (id: string) => void;
  updateScenarioUpdatedAt: (id: string) => void;
  updateScenarioAssumptions: (
    id: string,
    patch: Partial<ScenarioAssumptions>
  ) => void;
  setScenarioHorizonMonths: (id: string, horizonMonths: number) => void;
  setScenarioInitialCash: (id: string, initialCash: number) => void;
  setScenarioBaseMonth: (id: string, baseMonth: string | null) => void;
  replaceScenario: (scenario: Scenario) => void;
  replaceAllScenarios: (scenarios: Scenario[]) => void;
};

const defaultKpis: ScenarioKpis = {
  lowestMonthlyBalance: -8000,
  runwayMonths: 14,
  netWorthYear5: 1200000,
  riskLevel: "Medium",
};

const defaultAssumptions: ScenarioAssumptions = {
  horizonMonths: 240,
  initialCash: 0,
  baseMonth: null,
};

const horizonRange = { min: 60, max: 480 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isValidBaseMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);

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
    assumptions: { ...defaultAssumptions },
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
    assumptions: { ...defaultAssumptions },
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
    assumptions: { ...defaultAssumptions },
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
      assumptions: { ...defaultAssumptions },
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
      assumptions: { ...source.assumptions },
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
  upsertHomePosition: (id, home) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: {
                ...(scenario.positions ?? {}),
                home,
              },
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  clearHomePosition: (id) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const { home, ...rest } = scenario.positions ?? {};
        void home;
        const nextPositions =
          Object.keys(rest).length > 0 ? rest : undefined;

        return {
          ...scenario,
          positions: nextPositions,
          updatedAt: now(),
        };
      }),
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
  updateScenarioAssumptions: (id, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextAssumptions = { ...scenario.assumptions };

        if (Object.prototype.hasOwnProperty.call(patch, "horizonMonths")) {
          const horizon =
            typeof patch.horizonMonths === "number"
              ? clamp(patch.horizonMonths, horizonRange.min, horizonRange.max)
              : scenario.assumptions.horizonMonths;
          nextAssumptions.horizonMonths = horizon;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "initialCash")) {
          const cash =
            typeof patch.initialCash === "number"
              ? Math.max(0, patch.initialCash)
              : scenario.assumptions.initialCash;
          nextAssumptions.initialCash = cash;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "baseMonth")) {
          const baseMonth = patch.baseMonth;
          if (baseMonth === null) {
            nextAssumptions.baseMonth = null;
          } else if (typeof baseMonth === "string" && isValidBaseMonth(baseMonth)) {
            nextAssumptions.baseMonth = baseMonth;
          }
        }

        if (Object.prototype.hasOwnProperty.call(patch, "inflationRate")) {
          nextAssumptions.inflationRate = patch.inflationRate;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "salaryGrowthRate")) {
          nextAssumptions.salaryGrowthRate = patch.salaryGrowthRate;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "emergencyFundMonths")) {
          nextAssumptions.emergencyFundMonths = patch.emergencyFundMonths;
        }

        return {
          ...scenario,
          assumptions: nextAssumptions,
          updatedAt: now(),
        };
      }),
    }));
  },
  setScenarioHorizonMonths: (id, horizonMonths) => {
    get().updateScenarioAssumptions(id, { horizonMonths });
  },
  setScenarioInitialCash: (id, initialCash) => {
    get().updateScenarioAssumptions(id, { initialCash });
  },
  setScenarioBaseMonth: (id, baseMonth) => {
    get().updateScenarioAssumptions(id, { baseMonth });
  },
  replaceScenario: (scenario) => {
    set((state) => {
      const exists = state.scenarios.some((entry) => entry.id === scenario.id);
      const scenarios = exists
        ? state.scenarios.map((entry) =>
            entry.id === scenario.id ? scenario : entry
          )
        : [scenario, ...state.scenarios];

      const nextActiveScenarioId = state.activeScenarioId
        ? state.activeScenarioId
        : scenarios[0]?.id ?? "";

      return {
        scenarios,
        activeScenarioId: nextActiveScenarioId,
      };
    });
  },
  replaceAllScenarios: (scenarios) => {
    set(() => ({
      scenarios,
      activeScenarioId: scenarios[0]?.id ?? "",
    }));
  },
}));
