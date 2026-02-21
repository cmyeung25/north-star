import type { HousingEvent, ScenarioEvent } from "../scenarioV2/events";
import { WarningCode, type CompilerWarning } from "./types";

const MORTGAGE_LABEL_PATTERN = /(mortgage|loan\s*payment|home\s*loan|按揭|貸款還款)/i;
const RENTAL_INCOME_LABEL_PATTERN = /(rental\s*income|rent\s*income|rental|租金|出租)/i;

const buildWarning = (
  code: WarningCode,
  eventIds: string[],
  defaultMessage: string,
  debug: Record<string, unknown>
): CompilerWarning => ({
  code,
  severity: "warning",
  messageKey: `warnings.${code}`,
  defaultMessage,
  refs: {
    eventId: eventIds[0],
  },
  debug,
});

export const detectDuplicateScenarioEventWarnings = (
  events: ScenarioEvent[] | undefined
): CompilerWarning[] => {
  const scenarioEvents = events ?? [];
  const mortgageEvents = scenarioEvents.filter(
    (event): event is HousingEvent => event.type === "housing" && event.kind === "mortgage"
  );

  if (mortgageEvents.length === 0) {
    return [];
  }

  const cashflowExpenseEvents = scenarioEvents.filter(
    (event) =>
      event.type === "cashflow" &&
      event.kind === "expense" &&
      MORTGAGE_LABEL_PATTERN.test((event.label ?? "").trim())
  );
  const cashflowRentalIncomeEvents = scenarioEvents.filter(
    (event) =>
      event.type === "cashflow" &&
      event.kind === "income" &&
      RENTAL_INCOME_LABEL_PATTERN.test((event.label ?? "").trim())
  );

  const warnings: CompilerWarning[] = [];

  if (cashflowExpenseEvents.length > 0) {
    warnings.push(
      buildWarning(
        WarningCode.DuplicateMortgageCashflow,
        [...mortgageEvents, ...cashflowExpenseEvents].map((event) => event.id),
        "Mortgage payment may be double-counted with manual cashflow expense.",
        {
          mortgageEventIds: mortgageEvents.map((event) => event.id),
          duplicateCashflowEventIds: cashflowExpenseEvents.map((event) => event.id),
        }
      )
    );
  }

  const rentalEnabledMortgageEvents = mortgageEvents.filter(
    (event) => event.rental?.enabled === true && (event.rental.rentMonthly ?? 0) > 0
  );

  if (rentalEnabledMortgageEvents.length > 0 && cashflowRentalIncomeEvents.length > 0) {
    warnings.push(
      buildWarning(
        WarningCode.RentalIncomeDuplicated,
        [...rentalEnabledMortgageEvents, ...cashflowRentalIncomeEvents].map((event) => event.id),
        "Rental income may be duplicated between mortgage rental settings and manual income cashflow.",
        {
          mortgageEventIds: rentalEnabledMortgageEvents.map((event) => event.id),
          duplicateCashflowEventIds: cashflowRentalIncomeEvents.map((event) => event.id),
        }
      )
    );
  }

  return warnings;
};
