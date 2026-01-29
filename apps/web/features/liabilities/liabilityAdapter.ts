import {
  createLoanPositionId,
  type LoanPositionDraft,
  type Scenario,
  type ScenarioPositions,
} from "../../src/store/scenarioStore";
import { createLoanPositionFromTemplate } from "../../components/timeline/utils";
import type { LiabilityItem, LiabilityItemUpsert } from "./types";

export type LiabilityItemChange =
  | { type: "upsert"; item: LiabilityItemUpsert }
  | { type: "remove"; item: LiabilityItem };

const ensureLoanDraft = (loan: LoanPositionDraft): LoanPositionDraft => ({
  ...loan,
  id: loan.id ?? createLoanPositionId(),
});

export const createLiabilityItemId = () => createLoanPositionId();

export const toLiabilityItems = (scenario: Scenario): LiabilityItem[] => {
  const baseCurrency = scenario.baseCurrency;
  const loans = scenario.positions?.loans ?? [];

  return loans.map((loan) => ({
    id: loan.id ?? createLoanPositionId(),
    liabilityType: loan.loanType ?? "loan",
    name: loan.name ?? "Loan",
    principalOutstanding: loan.principal ?? 0,
    currency: baseCurrency,
    interestRate: loan.annualInterestRatePct ?? 0,
    startMonth: loan.startMonth ?? "",
    termMonths: loan.termYears ? Math.round(loan.termYears * 12) : undefined,
    notes: loan.notes,
    purchasePrice: loan.purchasePrice,
    downPaymentPercent: loan.downPaymentPercent,
    generatePaymentExpense: loan.generatePaymentExpense,
    linkedAssetId: loan.linkedAssetId,
    source: loan.source ?? ("manual" as const),
    generatedByEventId: loan.generatedByEventId,
  }));
};

export const applyLiabilityItemChange = (
  scenario: Scenario,
  change: LiabilityItemChange
): ScenarioPositions => {
  const baseMonth = scenario.assumptions.baseMonth ?? null;
  const positions = scenario.positions ?? {};
  const loans = (positions.loans ?? []).map((loan) => ensureLoanDraft(loan));

  if (change.type === "remove") {
    return {
      ...positions,
      loans: loans.filter((loan) => loan.id !== change.item.id),
    };
  }

  const { item } = change;
  const existing = loans.find((loan) => loan.id === item.id);
  const base = existing ?? createLoanPositionFromTemplate({ baseMonth });
  const resolvedTermMonths = item.termMonths ?? (base.termYears ?? 1) * 12;
  const next: LoanPositionDraft = {
    ...base,
    id: item.id ?? base.id,
    name: item.name ?? base.name,
    loanType: item.liabilityType ?? base.loanType,
    principal: item.principalOutstanding ?? base.principal,
    annualInterestRatePct: item.interestRate ?? base.annualInterestRatePct,
    startMonth: item.startMonth ?? base.startMonth,
    termYears: Math.max(1, Math.round(resolvedTermMonths / 12)),
    notes: item.notes ?? base.notes,
    purchasePrice: item.purchasePrice ?? base.purchasePrice,
    downPaymentPercent: item.downPaymentPercent ?? base.downPaymentPercent,
    generatePaymentExpense:
      item.generatePaymentExpense ?? base.generatePaymentExpense,
    linkedAssetId: item.linkedAssetId ?? base.linkedAssetId,
    source: item.source ?? base.source,
    generatedByEventId: item.generatedByEventId ?? base.generatedByEventId,
  };
  const nextLoans = existing
    ? loans.map((entry) => (entry.id === next.id ? next : entry))
    : [...loans, next];

  return { ...positions, loans: nextLoans };
};
