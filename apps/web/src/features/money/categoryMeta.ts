import type { ScenarioEvent } from "../../domain/scenarioV2/events";

export const resolveEventCategoryKey = (event: ScenarioEvent): string | null => {
  if (event.type !== "cashflow") {
    return null;
  }
  if (event.kind === "income") {
    return event.category ?? "other";
  }
  return event.expenseCategory ?? "other";
};
