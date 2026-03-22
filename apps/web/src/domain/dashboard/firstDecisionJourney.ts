import type { PlanLabDecisionTemplateId } from "../planLab/types";
import type { Scenario } from "../../store/scenarioStore";

export type OverviewFirstDecisionJourneySignal =
  | "retirement"
  | "childbirth"
  | "parenting"
  | "rent_to_buy"
  | "income_resilience"
  | "rental_setup";

export type OverviewFirstDecisionJourney = {
  templateId: PlanLabDecisionTemplateId;
  signal: OverviewFirstDecisionJourneySignal;
};

export const recommendOverviewFirstDecisionJourney = (
  scenario: Pick<Scenario, "events" | "positions" | "meta">
): OverviewFirstDecisionJourney => {
  const personaFocuses = new Set(scenario.meta?.personaFocuses ?? []);
  const events = scenario.events ?? [];
  const hasRentHousing = events.some(
    (event) => event.type === "housing" && event.kind === "rent"
  );
  const hasMortgageHousing = events.some(
    (event) => event.type === "housing" && event.kind === "mortgage"
  );
  const hasOwnedHome = (scenario.positions?.homes?.length ?? 0) > 0;

  if (personaFocuses.has("retirement")) {
    return { templateId: "retirement", signal: "retirement" };
  }

  if (personaFocuses.has("education")) {
    return { templateId: "parenting", signal: "parenting" };
  }

  if (personaFocuses.has("family") || personaFocuses.has("fertility")) {
    return { templateId: "childbirth", signal: "childbirth" };
  }

  if (hasRentHousing || !hasOwnedHome) {
    return { templateId: "home_purchase", signal: "rent_to_buy" };
  }

  if (hasMortgageHousing) {
    return { templateId: "income_shock", signal: "income_resilience" };
  }

  return { templateId: "rental_plan", signal: "rental_setup" };
};
