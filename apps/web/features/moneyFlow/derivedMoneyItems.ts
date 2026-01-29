import { compareMonthKey, isValidMonthKey } from "../../src/utils/monthKey";
import type { AssetItem } from "../assets/types";
import type { LiabilityItem } from "../liabilities/types";
import type { MoneyItem, MoneyItemUpsert } from "./types";

type AssetDerivedLabels = {
  ongoingCostLabels: Record<string, string>;
  rentalIncomeLabel: string;
};

type BuildAssetDerivedParams = {
  asset: AssetItem;
  baseCurrency: string;
  labels: AssetDerivedLabels;
};

type BuildLiabilityDerivedParams = {
  liability: LiabilityItem;
  baseCurrency: string;
  label: string;
};

const addMonths = (month: string, offset: number) => {
  if (!isValidMonthKey(month)) {
    return undefined;
  }
  const [yearStr, monthStr] = month.split("-");
  const baseYear = Number(yearStr);
  const baseMonth = Number(monthStr);
  if (!Number.isFinite(baseYear) || !Number.isFinite(baseMonth)) {
    return undefined;
  }
  const totalMonths = baseYear * 12 + (baseMonth - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
};

const resolveCandidateCategory = (item: Pick<MoneyItemUpsert, "category" | "categoryOverride">) =>
  item.categoryOverride ?? item.category;

const rangesOverlap = (
  startA: string | undefined | null,
  endA: string | undefined | null,
  startB: string | undefined | null,
  endB: string | undefined | null
) => {
  if (!startA || !startB) {
    return false;
  }
  if (!isValidMonthKey(startA) || !isValidMonthKey(startB)) {
    return false;
  }
  const resolvedEndA = endA && isValidMonthKey(endA) ? endA : null;
  const resolvedEndB = endB && isValidMonthKey(endB) ? endB : null;

  const aEndsBeforeB =
    resolvedEndA && compareMonthKey(resolvedEndA, startB) < 0;
  const bEndsBeforeA =
    resolvedEndB && compareMonthKey(resolvedEndB, startA) < 0;

  return !(aEndsBeforeB || bEndsBeforeA);
};

export const buildDerivedMoneyItemsForAsset = ({
  asset,
  baseCurrency,
  labels,
}: BuildAssetDerivedParams): MoneyItemUpsert[] => {
  if (asset.assetType !== "property" && asset.assetType !== "car") {
    return [];
  }

  const items: MoneyItemUpsert[] = [];
  const assetName = asset.name.trim();
  const buildNote = (suffix: string) =>
    assetName ? `${assetName} · ${suffix}` : suffix;

  asset.purchaseFees?.forEach((fee) => {
    if (!fee.label.trim()) {
      return;
    }
    if (!Number.isFinite(fee.amount) || fee.amount <= 0) {
      return;
    }
    if (!isValidMonthKey(fee.month)) {
      return;
    }
    items.push({
      kind: "expense",
      cadence: "oneOff",
      amount: fee.amount,
      currency: baseCurrency,
      category: "custom",
      month: fee.month,
      notes: buildNote(fee.label),
      source: "derived",
      generatedBy: {
        type: "assetCost",
        assetId: asset.id,
        subType: "purchaseFee",
        key: fee.id,
      },
      linkedAssetId: asset.id,
    });
  });

  asset.ongoingCosts?.forEach((cost) => {
    if (!cost.enabled) {
      return;
    }
    if (!Number.isFinite(cost.amount) || cost.amount <= 0) {
      return;
    }
    if (!isValidMonthKey(cost.startMonth)) {
      return;
    }
    const label = labels.ongoingCostLabels[cost.key] ?? cost.key;
    items.push({
      kind: "expense",
      cadence: "recurring",
      amount: cost.amount,
      currency: baseCurrency,
      category: "custom",
      startMonth: cost.startMonth,
      notes: buildNote(label),
      source: "derived",
      generatedBy: {
        type: "assetCost",
        assetId: asset.id,
        subType: "ongoing",
        key: cost.key,
      },
      linkedAssetId: asset.id,
    });
  });

  if (asset.assetType === "property" && asset.rental?.isRented) {
    const rental = asset.rental;
    if (rental.rentAmountMonthly > 0 && isValidMonthKey(rental.rentStartMonth)) {
      items.push({
        kind: "income",
        cadence: "recurring",
        amount: rental.rentAmountMonthly,
        currency: baseCurrency,
        category: "salary",
        startMonth: rental.rentStartMonth,
        endMonth:
          rental.rentEndMonth && isValidMonthKey(rental.rentEndMonth)
            ? rental.rentEndMonth
            : undefined,
        notes: buildNote(labels.rentalIncomeLabel),
        source: "derived",
        generatedBy: {
          type: "assetRental",
          assetId: asset.id,
        },
        linkedAssetId: asset.id,
        categoryOverride: "rent",
      });
    }
  }

  return items;
};

const resolveMonthlyPayment = (
  principal: number,
  annualRatePct: number,
  termMonths: number
) => {
  if (!Number.isFinite(principal) || principal <= 0) {
    return null;
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    return null;
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    return null;
  }
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return (principal * monthlyRate) / denominator;
};

export const buildDerivedMoneyItemsForLiability = ({
  liability,
  baseCurrency,
  label,
}: BuildLiabilityDerivedParams): MoneyItemUpsert[] => {
  if (!liability.generatePaymentExpense) {
    return [];
  }
  if (!liability.startMonth || !isValidMonthKey(liability.startMonth)) {
    return [];
  }
  const payment = resolveMonthlyPayment(
    liability.principalOutstanding,
    liability.interestRate ?? 0,
    liability.termMonths ?? 0
  );
  if (!payment || payment <= 0) {
    return [];
  }
  const endMonth = liability.termMonths
    ? addMonths(liability.startMonth, liability.termMonths - 1)
    : undefined;
  return [
    {
      kind: "expense",
      cadence: "recurring",
      amount: payment,
      currency: baseCurrency,
      category: "custom",
      startMonth: liability.startMonth,
      endMonth,
      notes: liability.name ? `${liability.name} · ${label}` : label,
      source: "derived",
      generatedBy: {
        type: "loanPayment",
        liabilityId: liability.id,
      },
      linkedLiabilityId: liability.id,
      linkedAssetId: liability.linkedAssetId,
    },
  ];
};

export const findOverlappingManualItems = (
  manualItems: MoneyItem[],
  candidates: MoneyItemUpsert[]
) =>
  manualItems.filter((item) =>
    candidates.some((candidate) => {
      const candidateCategory = resolveCandidateCategory(candidate);
      const itemCategory = resolveCandidateCategory(item);
      if (candidateCategory !== itemCategory) {
        return false;
      }
      if (item.kind !== candidate.kind || item.cadence !== candidate.cadence) {
        return false;
      }
      if (
        candidate.linkedAssetId &&
        item.linkedAssetId &&
        candidate.linkedAssetId === item.linkedAssetId
      ) {
        return true;
      }
      if (
        candidate.linkedLiabilityId &&
        item.linkedLiabilityId &&
        candidate.linkedLiabilityId === item.linkedLiabilityId
      ) {
        return true;
      }
      if (candidate.cadence === "oneOff") {
        return (
          Boolean(candidate.month) &&
          Boolean(item.month) &&
          candidate.month === item.month
        );
      }
      return rangesOverlap(
        candidate.startMonth ?? null,
        candidate.endMonth ?? null,
        item.startMonth ?? null,
        item.endMonth ?? null
      );
    })
  );

export const findDerivedMoneyItemsForAsset = (
  items: MoneyItem[],
  assetId: string
) =>
  items.filter((item) => {
    if (item.source !== "derived") {
      return false;
    }
    const generatedBy = item.generatedBy;
    if (!generatedBy) {
      return false;
    }
    if (generatedBy.type === "assetCost" || generatedBy.type === "assetRental") {
      return generatedBy.assetId === assetId;
    }
    return false;
  });

export const findDerivedMoneyItemsForLiability = (
  items: MoneyItem[],
  liabilityId: string
) =>
  items.filter((item) => {
    if (item.source !== "derived") {
      return false;
    }
    const generatedBy = item.generatedBy;
    if (!generatedBy || generatedBy.type !== "loanPayment") {
      return false;
    }
    return generatedBy.liabilityId === liabilityId;
  });
