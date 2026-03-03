import type { ScenarioAsset } from "../../store/scenarioStore";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import { buildMoneyMetaTagViewModel } from "./moneyMetaTagViewModel";
import type { MoneyTagItem } from "./moneyTagConfig";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

type BuildInputMetaTagsBase = {
  t: TranslateFn;
  memberLookupRecord: Record<string, string>;
};

const resolveFrequencyLabel = (
  t: TranslateFn,
  cadence: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths"
) => {
  switch (cadence) {
    case "monthly":
      return t("ledgerEventCadenceMonthly");
    case "yearly":
      return t("ledgerEventCadenceYearly");
    case "quarterly":
      return t("ledgerEventCadenceQuarterly");
    case "oneOff":
      return t("ledgerEventCadenceOneOff");
    case "everyNMonths":
      return t("ledgerEventCadenceEveryN");
    default:
      return t("ledgerEventCadenceOneOff");
  }
};

export const buildInputRuleTags = (
  id: string,
  t: TranslateFn
): MoneyTagItem[] => [
  { key: `rule-type-${id}`, kind: "expenseType", label: t("inputsRuleTagType") },
  { key: `rule-life-${id}`, kind: "attribute", label: t("inputsRuleTagLifecycle") },
];

export const buildInputAssetMetaTags = (
  asset: ScenarioAsset,
  { t, memberLookupRecord }: BuildInputMetaTagsBase
): MoneyTagItem[] =>
  buildMoneyMetaTagViewModel(asset, {
    householdLabel: t("householdLabel"),
    ownerId: asset.ownerMemberId,
    memberLookupRecord,
    resolveTypeLabel: () =>
      asset.kind === "cash"
        ? t("assetTypeCash")
        : asset.kind === "home"
          ? t("assetTypeProperty")
          : asset.kind === "investment"
            ? t("assetTypeInvestment")
            : asset.kind === "car"
              ? t("assetTypeCar")
              : asset.kind === "policy"
                ? t("assetTypePolicy")
                : t("assetTypeOther"),
    resolveFrequencyLabel: () => null,
    resolveLifecycleLabel: () => t("eventCardOpenEnded"),
  }).tags;

export const buildInputEventMetaTags = (
  event: ScenarioEvent,
  params: BuildInputMetaTagsBase & { adjustmentCount: number }
): MoneyTagItem[] =>
  buildMoneyMetaTagViewModel(event, {
    householdLabel: params.t("householdLabel"),
    ownerId: event.memberId,
    memberLookupRecord: params.memberLookupRecord,
    resolveTypeLabel: () =>
      event.type === "cashflow" && event.kind === "income"
        ? params.t("eventTypeIncome")
        : params.t("eventTypeExpense"),
    resolveFrequencyLabel: () =>
      event.type === "cashflow"
        ? resolveFrequencyLabel(params.t, event.cadence)
        : params.t("ledgerEventCadenceOneOff"),
    resolveLifecycleLabel: (meta) =>
      meta.lifecycle === "oneOff"
        ? params.t("ledgerEventCadenceOneOff")
        : meta.lifecycle === "hasEndMonth"
          ? params.t("eventLifecycleHasEndMonth")
          : params.t("eventCardOpenEnded"),
    adjustmentCount: params.adjustmentCount,
    adjustmentLabel:
      params.adjustmentCount > 0
        ? params.t("eventAdjustmentCountBadge", { count: params.adjustmentCount })
        : undefined,
  }).tags;

export const buildInputEventDescription = (
  t: TranslateFn,
  params: {
    month: string;
    amount: string;
    adjustmentCount: number;
    latestAdjustmentMonth: string;
    latestAdjustmentAmount: string;
    startMonth: string;
    endMonth: string;
  }
): string => {
  if (params.adjustmentCount <= 0) {
    return t("inputsEventMeta", {
      month: params.month,
      amount: params.amount,
    });
  }

  return t("inputsEventMetaWithAdjustments", {
    month: params.month,
    amount: params.amount,
    count: params.adjustmentCount,
    latestMonth: params.latestAdjustmentMonth,
    latestAmount: params.latestAdjustmentAmount,
    startMonth: params.startMonth,
    endMonth: params.endMonth,
  });
};
