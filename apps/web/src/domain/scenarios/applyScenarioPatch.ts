import type {
  CarPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
  Scenario,
  ScenarioPositions,
} from "../../store/scenarioStore";
import type { ScenarioEventRef } from "../events/types";

export type ScenarioPatch =
  | {
      type: "setScenario";
      patch: {
        name?: string;
        baseCurrency?: string;
        assumptions?: Partial<Scenario["assumptions"]>;
        clientComputed?: Partial<Scenario["clientComputed"]>;
        meta?: Partial<Scenario["meta"]>;
      };
    }
  | {
      type: "setPositions";
      positions: Partial<ScenarioPositions>;
    }
  | {
      type: "setEventRefs";
      eventRefs: ScenarioEventRef[];
    }
  | {
      type: "upsertEventRef";
      eventRef: ScenarioEventRef;
    }
  | {
      type: "upsertHome";
      home: HomePositionDraft;
    }
  | {
      type: "upsertCar";
      car: CarPositionDraft;
    }
  | {
      type: "upsertInvestment";
      investment: InvestmentPositionDraft;
    }
  | {
      type: "upsertLoan";
      loan: LoanPositionDraft;
    }
  | {
      type: "upsertInsurance";
      insurance: InsurancePositionDraft;
    };

type ApplyScenarioPatchInput = {
  scenario: Scenario;
  patches: ScenarioPatch[];
};

const cloneScenario = (scenario: Scenario): Scenario => {
  if (typeof structuredClone === "function") {
    return structuredClone(scenario);
  }

  return JSON.parse(JSON.stringify(scenario)) as Scenario;
};

const upsertById = <T extends { id: string }>(items: T[], next: T) => {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }

  const updated = [...items];
  updated[index] = next;
  return updated;
};

export const applyScenarioPatch = ({
  scenario,
  patches,
}: ApplyScenarioPatchInput): Scenario => {
  const nextScenario = cloneScenario(scenario);

  patches.forEach((patch) => {
    switch (patch.type) {
      case "setScenario": {
        if (patch.patch.name !== undefined) {
          nextScenario.name = patch.patch.name;
        }
        if (patch.patch.baseCurrency !== undefined) {
          nextScenario.baseCurrency = patch.patch.baseCurrency;
        }
        if (patch.patch.assumptions) {
          nextScenario.assumptions = {
            ...nextScenario.assumptions,
            ...patch.patch.assumptions,
          };
        }
        if (patch.patch.clientComputed) {
          nextScenario.clientComputed = {
            ...(nextScenario.clientComputed ?? {}),
            ...patch.patch.clientComputed,
          };
        }
        if (patch.patch.meta) {
          nextScenario.meta = {
            ...(nextScenario.meta ?? {}),
            ...patch.patch.meta,
          };
        }
        break;
      }
      case "setPositions": {
        nextScenario.positions = {
          ...(nextScenario.positions ?? {}),
          ...patch.positions,
        };
        break;
      }
      case "setEventRefs": {
        nextScenario.eventRefs = [...patch.eventRefs];
        break;
      }
      case "upsertEventRef": {
        const eventRefs = nextScenario.eventRefs ?? [];
        const existingIndex = eventRefs.findIndex(
          (ref) => ref.refId === patch.eventRef.refId
        );
        if (existingIndex === -1) {
          nextScenario.eventRefs = [...eventRefs, patch.eventRef];
        } else {
          nextScenario.eventRefs = eventRefs.map((ref, index) =>
            index === existingIndex ? patch.eventRef : ref
          );
        }
        break;
      }
      case "upsertHome": {
        const positions = nextScenario.positions ?? {};
        const homes = positions.homes ?? [];
        nextScenario.positions = {
          ...positions,
          homes: upsertById(homes, patch.home),
        };
        break;
      }
      case "upsertCar": {
        const positions = nextScenario.positions ?? {};
        const cars = positions.cars ?? [];
        nextScenario.positions = {
          ...positions,
          cars: upsertById(cars, patch.car),
        };
        break;
      }
      case "upsertInvestment": {
        const positions = nextScenario.positions ?? {};
        const investments = positions.investments ?? [];
        nextScenario.positions = {
          ...positions,
          investments: upsertById(investments, patch.investment),
        };
        break;
      }
      case "upsertLoan": {
        const positions = nextScenario.positions ?? {};
        const loans = positions.loans ?? [];
        nextScenario.positions = {
          ...positions,
          loans: upsertById(loans, patch.loan),
        };
        break;
      }
      case "upsertInsurance": {
        const positions = nextScenario.positions ?? {};
        const insurances = positions.insurances ?? [];
        nextScenario.positions = {
          ...positions,
          insurances: upsertById(insurances, patch.insurance),
        };
        break;
      }
      default: {
        const exhaustiveCheck: never = patch;
        return exhaustiveCheck;
      }
    }
  });

  nextScenario.updatedAt = Date.now();
  return nextScenario;
};
