import { addMonths } from "../members/age";
import { isValidMonthKey } from "../../utils/monthKey";
import {
  compileScenarioV2ToLedger,
  type LedgerRow,
  type ScenarioV2,
} from "../../engine/scenarioV2Compiler";
import type { ScenarioEvent } from "./events";
import type { ScenarioAsset, ScenarioLiability } from "../../store/scenarioStore";

export type EventLedgerPreview = {
  rows: LedgerRow[];
  previewMonths: string[];
  previewRows: LedgerRow[];
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  topRows: LedgerRow[];
};

export type EventDeleteImpact = {
  event: ScenarioEvent;
  impactedAssets: ScenarioAsset[];
  impactedLiabilities: ScenarioLiability[];
  referencedAssetIds: string[];
  referencedLiabilityIds: string[];
  safeToCascade: boolean;
  ledger: EventLedgerPreview;
};

export type DeleteImpactSummary = {
  impactedAssets: ScenarioAsset[];
  impactedLiabilities: ScenarioLiability[];
  ledger: EventLedgerPreview;
};

const getReferencedAssetIds = (event: ScenarioEvent) => {
  if (event.type === "housing" && event.kind === "mortgage") {
    return event.propertyAssetId ? [event.propertyAssetId] : [];
  }
  if (event.type === "insurance" && event.mode === "detailed") {
    return (event.policies ?? [])
      .map((policy) => policy.policyAssetId)
      .filter((id): id is string => Boolean(id));
  }
  return [];
};

const getReferencedLiabilityIds = (event: ScenarioEvent) => {
  if (event.type === "housing" && event.kind === "mortgage") {
    return event.mortgageLiabilityId ? [event.mortgageLiabilityId] : [];
  }
  if (event.type === "loan") {
    return event.liabilityId ? [event.liabilityId] : [];
  }
  return [];
};

const buildPreviewMonths = (baseMonth: string | null, count: number) => {
  if (!baseMonth || !isValidMonthKey(baseMonth) || count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => addMonths(baseMonth, index));
};

const summarizeLedgerRows = (
  rows: LedgerRow[],
  previewMonths: string[]
): EventLedgerPreview => {
  const previewRows =
    previewMonths.length > 0
      ? rows.filter((row) => previewMonths.includes(row.month))
      : rows;
  const totals = previewRows.reduce(
    (acc, row) => {
      if (row.amount >= 0) {
        acc.income += row.amount;
      } else {
        acc.expense += Math.abs(row.amount);
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const topRows = [...rows]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);
  return {
    rows,
    previewMonths,
    previewRows,
    totalIncome: totals.income,
    totalExpense: totals.expense,
    netAmount: totals.income - totals.expense,
    topRows,
  };
};

export const createEmptyLedgerPreview = (): EventLedgerPreview => ({
  rows: [],
  previewMonths: [],
  previewRows: [],
  totalIncome: 0,
  totalExpense: 0,
  netAmount: 0,
  topRows: [],
});

export const buildBundleDeleteImpact = (
  scenario: ScenarioV2,
  eventIds: string[],
  options?: { previewMonths?: number }
): DeleteImpactSummary => {
  const eventIdSet = new Set(eventIds);
  const impactedAssets = (scenario.assets ?? []).filter((asset) =>
    asset.createdByEventId && eventIdSet.has(asset.createdByEventId)
  );
  const impactedLiabilities = (scenario.liabilities ?? []).filter(
    (liability) =>
      liability.createdByEventId && eventIdSet.has(liability.createdByEventId)
  );
  const ledgerRows = compileScenarioV2ToLedger(scenario).filter((row) =>
    eventIdSet.has(row.sourceEventId)
  );
  const previewMonths = buildPreviewMonths(
    scenario.assumptions.baseMonth ?? null,
    options?.previewMonths ?? 12
  );
  return {
    impactedAssets,
    impactedLiabilities,
    ledger: summarizeLedgerRows(ledgerRows, previewMonths),
  };
};

export const buildEventDeleteImpact = (
  scenario: ScenarioV2,
  eventId: string,
  options?: { previewMonths?: number }
): EventDeleteImpact | null => {
  const event = (scenario.events ?? []).find((entry) => entry.id === eventId);
  if (!event) {
    return null;
  }

  const impactedAssets = (scenario.assets ?? []).filter(
    (asset) => asset.createdByEventId === eventId
  );
  const impactedLiabilities = (scenario.liabilities ?? []).filter(
    (liability) => liability.createdByEventId === eventId
  );

  const referencedAssetIds = new Set<string>();
  const referencedLiabilityIds = new Set<string>();
  (scenario.events ?? [])
    .filter((entry) => entry.id !== eventId)
    .forEach((entry) => {
      getReferencedAssetIds(entry).forEach((id) => referencedAssetIds.add(id));
      getReferencedLiabilityIds(entry).forEach((id) =>
        referencedLiabilityIds.add(id)
      );
    });

  const ledgerRows = compileScenarioV2ToLedger(scenario).filter(
    (row) => row.sourceEventId === eventId
  );
  const previewMonths = buildPreviewMonths(
    scenario.assumptions.baseMonth ?? null,
    options?.previewMonths ?? 12
  );
  const ledger = summarizeLedgerRows(ledgerRows, previewMonths);

  const referencedAssetList = impactedAssets.filter((asset) =>
    referencedAssetIds.has(asset.id)
  );
  const referencedLiabilityList = impactedLiabilities.filter((liability) =>
    referencedLiabilityIds.has(liability.id)
  );

  return {
    event,
    impactedAssets,
    impactedLiabilities,
    referencedAssetIds: referencedAssetList.map((asset) => asset.id),
    referencedLiabilityIds: referencedLiabilityList.map((liability) => liability.id),
    safeToCascade:
      referencedAssetList.length === 0 && referencedLiabilityList.length === 0,
    ledger,
  };
};
