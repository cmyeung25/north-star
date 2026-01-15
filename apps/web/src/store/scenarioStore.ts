// Shape note: Scenario positions.homes entries originally held price/downPayment/purchaseMonth/annualAppreciationPct/mortgage info (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent for UI storage).
// Back-compat: missing holding cost fields default to 0 in adapters/engine.
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
  rentMonthly?: number;
  rentAnnualGrowthPct?: number;
  investmentReturnAssumptions?: Partial<Record<InvestmentAssetClass, number>>;
};

export type HomeUsage = "primary" | "investment";
export type HomeMode = "new_purchase" | "existing";

export type InvestmentAssetClass = "equity" | "bond" | "fund" | "crypto";

export type InsuranceType = "life" | "savings" | "accident" | "medical";

export type InsurancePremiumMode = "monthly" | "annual";

export type ScenarioMemberKind = "person" | "pet";

export type ScenarioMember = {
  id: string;
  name: string;
  kind: ScenarioMemberKind;
};

export type ExistingHomeDetails = {
  asOfMonth: string;
  marketValue: number;
  mortgageBalance: number;
  remainingTermMonths: number;
  annualRatePct: number;
};

export type RentalDetails = {
  rentMonthly: number;
  rentStartMonth: string;
  rentEndMonth?: string | null;
  rentAnnualGrowthPct?: number;
  vacancyRatePct?: number;
};

export type HomePosition = {
  usage?: HomeUsage;
  mode?: HomeMode;
  purchasePrice?: number;
  downPayment?: number;
  purchaseMonth?: string;
  annualAppreciationPct: number;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
  feesOneTime?: number;
  holdingCostMonthly?: number;
  holdingCostAnnualGrowthPct?: number;
  existing?: ExistingHomeDetails;
  rental?: RentalDetails;
};

export type HomePositionDraft = HomePosition & {
  id: string;
};

export type InvestmentPosition = {
  assetClass: InvestmentAssetClass;
  marketValue: number;
  expectedAnnualReturnPct?: number;
  monthlyContribution?: number;
};

export type InsurancePosition = {
  insuranceType: InsuranceType;
  premiumMode: InsurancePremiumMode;
  premiumAmount: number;
  hasCashValue?: boolean;
  cashValueAsOf?: number;
  cashValueAnnualGrowthPct?: number;
  coverageMeta?: Record<string, unknown>;
};

export type ScenarioPositions = {
  home?: HomePosition;
  homes?: HomePositionDraft[];
  investments?: InvestmentPosition[];
  insurances?: InsurancePosition[];
};

export type ScenarioMeta = {
  onboardingVersion?: number;
};

export type Scenario = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  kpis: ScenarioKpis;
  assumptions: ScenarioAssumptions;
  members?: ScenarioMember[];
  events?: TimelineEvent[];
  positions?: ScenarioPositions;
  meta?: ScenarioMeta;
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
  addHomePosition: (id: string, home: HomePositionDraft) => void;
  updateHomePosition: (id: string, home: HomePositionDraft) => void;
  removeHomePosition: (id: string, homeId: string) => void;
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
export const createHomePositionId = () => `home-${nanoid(8)}`;
export const createMemberId = () => `member-${nanoid(8)}`;

const DEFAULT_MEMBER_NAME = "本人";

const normalizeMembers = (members?: ScenarioMember[]): ScenarioMember[] => {
  if (members && members.length > 0) {
    return members.map((member) => ({ ...member }));
  }

  return [
    {
      id: createMemberId(),
      name: DEFAULT_MEMBER_NAME,
      kind: "person",
    },
  ];
};

const cloneEvents = (events?: TimelineEvent[]) =>
  events?.map((event) => ({
    ...event,
  }));

const cloneMembers = (members?: ScenarioMember[]) =>
  members?.map((member) => ({
    ...member,
  }));

const clonePositions = (positions?: ScenarioPositions): ScenarioPositions | undefined => {
  if (!positions) {
    return positions;
  }

  return {
    home: positions.home ? { ...positions.home } : undefined,
    homes: positions.homes ? positions.homes.map((home) => ({ ...home })) : undefined,
    investments: positions.investments
      ? positions.investments.map((investment) => ({ ...investment }))
      : undefined,
    insurances: positions.insurances
      ? positions.insurances.map((insurance) => ({ ...insurance }))
      : undefined,
  };
};

const initialScenarios: Scenario[] = [
  {
    id: "scenario-plan-a",
    name: "Plan A",
    baseCurrency: defaultCurrency,
    updatedAt: 1716806400000,
    kpis: {
      lowestMonthlyBalance: -12000,
      runwayMonths: 18,
      netWorthYear5: 1650000,
      riskLevel: "Medium",
    },
    assumptions: { ...defaultAssumptions },
    members: normalizeMembers(),
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
];

const ensureHomePositionId = (home: HomePosition | HomePositionDraft): HomePositionDraft => ({
  id: "id" in home ? home.id : createHomePositionId(),
  usage: home.usage ?? "primary",
  mode: home.mode ?? "new_purchase",
  purchasePrice: home.purchasePrice,
  downPayment: home.downPayment,
  purchaseMonth: home.purchaseMonth,
  annualAppreciationPct: home.annualAppreciationPct,
  mortgageRatePct: home.mortgageRatePct,
  mortgageTermYears: home.mortgageTermYears,
  feesOneTime: home.feesOneTime,
  holdingCostMonthly: home.holdingCostMonthly,
  holdingCostAnnualGrowthPct: home.holdingCostAnnualGrowthPct,
  existing: home.existing ? { ...home.existing } : undefined,
  rental: home.rental ? { ...home.rental } : undefined,
});

const normalizeScenarioPositions = (
  positions?: ScenarioPositions
): ScenarioPositions | undefined => {
  if (!positions) {
    return positions;
  }

  if (positions.homes) {
    return {
      ...positions,
      homes: positions.homes.map(ensureHomePositionId),
    };
  }

  if (positions.home) {
    return {
      ...positions,
      homes: [ensureHomePositionId(positions.home)],
    };
  }

  return positions;
};

export const normalizeScenario = (scenario: Scenario): Scenario => {
  const normalizedPositions = normalizeScenarioPositions(scenario.positions);
  const normalizedMembers = normalizeMembers(scenario.members);

  if (!normalizedPositions) {
    return {
      ...scenario,
      members: normalizedMembers,
    };
  }

  return {
    ...scenario,
    positions: normalizedPositions,
    members: normalizedMembers,
  };
};

export const normalizeScenarioList = (scenarios: Scenario[]) =>
  scenarios.map((scenario) => normalizeScenario(scenario));

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
  scenarios: normalizeScenarioList(initialScenarios),
  activeScenarioId: initialScenarios[0]?.id ?? "",
  createScenario: (name, options) => {
    const newScenario: Scenario = {
      id: createScenarioId(),
      name,
      baseCurrency: options?.baseCurrency ?? defaultCurrency,
      updatedAt: now(),
      kpis: { ...defaultKpis },
      assumptions: { ...defaultAssumptions },
      members: normalizeMembers(),
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
      name: `${source.name} (Copy)`,
      updatedAt: now(),
      kpis: { ...source.kpis },
      assumptions: { ...source.assumptions },
      members: cloneMembers(source.members) ?? normalizeMembers(),
      events: cloneEvents(source.events),
      positions: clonePositions(source.positions),
      meta: source.meta ? { ...source.meta } : undefined,
    };

    set((state) => ({
      scenarios: [copy, ...state.scenarios],
      activeScenarioId: copy.id,
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
  addHomePosition: (id, home) => {
    const nextHome = ensureHomePositionId(home);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                homes: [...(scenario.positions?.homes ?? []), nextHome],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateHomePosition: (id, home) => {
    const nextHome = ensureHomePositionId(home);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingHomes = scenario.positions?.homes ?? [];
        const hasMatch = existingHomes.some((entry) => entry.id === nextHome.id);
        const nextHomes = hasMatch
          ? existingHomes.map((entry) =>
              entry.id === nextHome.id ? nextHome : entry
            )
          : [...existingHomes, nextHome];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            homes: nextHomes,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeHomePosition: (id, homeId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextHomes = (scenario.positions?.homes ?? []).filter(
          (home) => home.id !== homeId
        );
        const { home: legacyHome, ...otherPositions } = scenario.positions ?? {};
        void legacyHome;
        const nextPositions: ScenarioPositions | undefined = scenario.positions
          ? {
              ...otherPositions,
              homes: nextHomes,
            }
          : undefined;
        const nextEvents =
          nextHomes.length === 0
            ? (scenario.events ?? []).filter((event) => event.type !== "buy_home")
            : scenario.events;

        return {
          ...scenario,
          events: nextEvents,
          positions: normalizeScenarioPositions(nextPositions),
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
    const normalizedScenario = normalizeScenario(scenario);
    set((state) => {
      const exists = state.scenarios.some((entry) => entry.id === normalizedScenario.id);
      const scenarios = exists
        ? state.scenarios.map((entry) =>
            entry.id === normalizedScenario.id ? normalizedScenario : entry
          )
        : [normalizedScenario, ...state.scenarios];

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
    const normalizedScenarios = normalizeScenarioList(scenarios);
    set(() => ({
      scenarios: normalizedScenarios,
      activeScenarioId: normalizedScenarios[0]?.id ?? "",
    }));
  },
}));
