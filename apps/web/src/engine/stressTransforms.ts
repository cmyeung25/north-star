import type { Scenario, TimelineEvent } from "../store/scenarioStore";
import { normalizeMonth } from "../features/timeline/schema";
import { getEventSign } from "../events/eventCatalog";

export type StressPreset = "RATE_HIKE_2" | "INCOME_DROP_20" | "INFLATION_PLUS_2";

type StressPresetOptions = {
  shockMonth?: string;
};

const cloneScenario = (scenario: Scenario): Scenario =>
  JSON.parse(JSON.stringify(scenario)) as Scenario;

const clampPct = (value: number) => Math.min(Math.max(value, 0), 100);

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const getEarliestEnabledMonth = (events: TimelineEvent[]) =>
  events.reduce<string | null>((earliest, event) => {
    if (!event.enabled) {
      return earliest;
    }
    if (!earliest || event.startMonth < earliest) {
      return event.startMonth;
    }
    return earliest;
  }, null);

const resolveShockMonth = (scenario: Scenario, options: StressPresetOptions) => {
  const normalized = normalizeMonth(options.shockMonth ?? "");
  if (normalized) {
    return normalized;
  }

  const scenarioBaseMonth = normalizeMonth(scenario.assumptions.baseMonth ?? "");
  if (scenarioBaseMonth) {
    return scenarioBaseMonth;
  }

  const earliestEventMonth = getEarliestEnabledMonth(scenario.events ?? []);
  return earliestEventMonth ?? getCurrentMonth();
};

const isIncomeEvent = (event: TimelineEvent) => getEventSign(event.type) === 1;

const isExpenseEvent = (event: TimelineEvent) => getEventSign(event.type) === -1;

export const applyStressPreset = (
  baseScenario: Scenario,
  preset: StressPreset,
  options: StressPresetOptions = {}
): Scenario => {
  const scenario = cloneScenario(baseScenario);

  switch (preset) {
    case "RATE_HIKE_2": {
      // Apply +2% to mortgage rate assumptions and each home mortgageRatePct.
      if (typeof scenario.assumptions.mortgageRatePct === "number") {
        scenario.assumptions.mortgageRatePct = clampPct(
          scenario.assumptions.mortgageRatePct + 2
        );
      }

      if (scenario.positions?.home) {
        scenario.positions.home = {
          ...scenario.positions.home,
          mortgageRatePct: clampPct(
            (scenario.positions.home.mortgageRatePct ?? 0) + 2
          ),
          existing: scenario.positions.home.existing
            ? {
                ...scenario.positions.home.existing,
                annualRatePct: clampPct(
                  (scenario.positions.home.existing.annualRatePct ?? 0) + 2
                ),
              }
            : scenario.positions.home.existing,
        };
      }

      if (scenario.positions?.homes) {
        scenario.positions.homes = scenario.positions.homes.map((home) => ({
          ...home,
          mortgageRatePct: clampPct((home.mortgageRatePct ?? 0) + 2),
          existing: home.existing
            ? {
                ...home.existing,
                annualRatePct: clampPct((home.existing.annualRatePct ?? 0) + 2),
              }
            : home.existing,
        }));
      }
      break;
    }
    case "INCOME_DROP_20": {
      // Reduce income-like events by 20% starting from shockMonth.
      const shockMonth = resolveShockMonth(scenario, options);
      scenario.events = (scenario.events ?? []).map((event) => {
        if (!event.enabled || !isIncomeEvent(event)) {
          return event;
        }
        if (event.startMonth < shockMonth) {
          return event;
        }
        return {
          ...event,
          monthlyAmount: (event.monthlyAmount ?? 0) * 0.8,
        };
      });
      break;
    }
    case "INFLATION_PLUS_2": {
      // Increase inflation assumption by +2% when available; otherwise scale expenses.
      if (typeof scenario.assumptions.inflationRate === "number") {
        scenario.assumptions.inflationRate = clampPct(
          scenario.assumptions.inflationRate + 2
        );
        break;
      }

      scenario.events = (scenario.events ?? []).map((event) => {
        if (!event.enabled || !isExpenseEvent(event)) {
          return event;
        }
        return {
          ...event,
          monthlyAmount: (event.monthlyAmount ?? 0) * 1.1,
        };
      });
      break;
    }
  }

  return scenario;
};
