import { buildMoneyMetaTags } from "../../src/domain/events/buildMoneyMetaTags";
import type { MetaTag } from "../../src/domain/events/buildMoneyMetaTags";
import { buildMoneyMetaTagViewModel } from "../../src/features/money/moneyMetaTagViewModel";
import type { SharedViewSource } from "../../src/domain/events/eventTaxonomy";
import type { MoneyTagItem } from "../../src/features/money/moneyTagConfig";
import { formatCurrency } from "../../lib/i18n";

type PlanLabFrequency =
  | "monthly"
  | "quarterly"
  | "yearly"
  | "oneOff"
  | "everyNMonths"
  | "schedule";

export type PlanLabMetaTagAdapterInput = {
  id: string;
  kind: "event" | "rule" | "position";
  category: string;
  title: string;
  memberId?: string;
  defaultMemberId?: string;
  memberName?: string;
  startMonth?: string;
  endMonth?: string;
  amount?: number;
  frequency?: PlanLabFrequency;
  intervalMonths?: number | null;
  eventId?: string;
  assetId?: string;
  liabilityId?: string;
  positionKind?: "asset" | "liability" | string;
  position?: {
    ownerMemberId?: string;
    currentValue?: number;
    principalOutstanding?: number;
    annualInterestRatePct?: number;
    startMonth?: string;
  };
  linkState?: "linked" | "orphaned";
  source?: SharedViewSource;
};

const resolveMetaInput = (row: PlanLabMetaTagAdapterInput) => {
  const cadence: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths" | "recurring" | undefined =
    row.frequency === "schedule" ? "recurring" : row.frequency;
  if (row.positionKind === "asset" && row.assetId) {
    return {
      id: row.assetId,
      kind: row.category,
      ownerMemberId: row.position?.ownerMemberId ?? row.memberId ?? row.defaultMemberId,
      currentValue: row.position?.currentValue ?? row.amount ?? 0,
    };
  }
  if (row.positionKind === "liability" && row.liabilityId) {
    return {
      id: row.liabilityId,
      kind: row.category,
      ownerMemberId: row.position?.ownerMemberId ?? row.memberId ?? row.defaultMemberId,
      principalOutstanding: row.position?.principalOutstanding ?? row.amount ?? 0,
    };
  }

  return {
    id: row.eventId ?? row.id,
    kind: eventTypeLabelByCategory(row.category),
    type: "cashflow",
    cadence,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
    memberId: row.memberId ?? row.defaultMemberId,
  };
};

const eventTypeLabelByCategory = (category: string): "income" | "expense" =>
  category?.toLowerCase() === "income" ? "income" : "expense";

const resolveTypeLabel = (
  category: string,
  typeLabels: { income: string; expense: string; asset: string; liability: string },
  isPositionAsset: boolean,
  isPositionLiability: boolean
) => {
  if (isPositionAsset) return typeLabels.asset;
  if (isPositionLiability) return typeLabels.liability;
  return eventTypeLabelByCategory(category) === "income" ? typeLabels.income : typeLabels.expense;
};

const resolveFrequencyLabel = (
  frequency: PlanLabFrequency | undefined,
  frequencyLabels: Record<NonNullable<PlanLabFrequency>, string>,
  intervalMonthsLabel: (intervalMonths: number) => string,
  intervalMonths?: number | null
) => {
  if (!frequency) return null;
  if (frequency === "everyNMonths") {
    return intervalMonths && intervalMonths > 0
      ? intervalMonthsLabel(intervalMonths)
      : frequencyLabels.everyNMonths;
  }
  return frequencyLabels[frequency] ?? null;
};

export const adaptPlanLabRowMeta = ({
  row,
  currency,
  locale,
  frequencyLabels,
  lifecycleLabels,
  householdLabel,
  orphanedLabel,
  memberLookupRecord,
  typeLabels,
  intervalMonthsLabel,
}: {
  row: PlanLabMetaTagAdapterInput;
  currency: string;
  locale: string;
  frequencyLabels: Record<NonNullable<PlanLabFrequency>, string>;
  lifecycleLabels: Record<"oneOff" | "hasEndMonth" | "ongoing", string>;
  householdLabel: string;
  orphanedLabel: string;
  memberLookupRecord: Record<string, string>;
  typeLabels: { income: string; expense: string; asset: string; liability: string };
  intervalMonthsLabel: (intervalMonths: number) => string;
}): {
  summary: string;
  tags: MoneyTagItem[];
  metaTags: MetaTag[];
  linkState: "linked" | "orphaned";
} => {
  const metaInput = resolveMetaInput(row);
  const ownerId = row.position?.ownerMemberId ?? row.memberId ?? row.defaultMemberId;
  const viewModel = buildMoneyMetaTagViewModel(metaInput, {
    householdLabel,
    ownerId,
    memberLookupRecord,
    resolveTypeLabel: () =>
      resolveTypeLabel(
        row.category,
        typeLabels,
        row.positionKind === "asset",
        row.positionKind === "liability"
      ),
    resolveLifecycleLabel: (meta) =>
      lifecycleLabels[
        meta.lifecycle === "oneOff"
          ? "oneOff"
          : meta.lifecycle === "hasEndMonth"
            ? "hasEndMonth"
            : "ongoing"
      ],
    resolveFrequencyLabel: () =>
      resolveFrequencyLabel(row.frequency, frequencyLabels, intervalMonthsLabel, row.intervalMonths),
    source: row.source,
    linkState: row.linkState,
  });

  const moneyMetaParts: string[] = [];
  if (row.amount !== undefined) {
    moneyMetaParts.push(formatCurrency(row.amount, currency, locale));
  }
  if (row.startMonth || row.endMonth) {
    moneyMetaParts.push(
      row.endMonth
        ? `${row.startMonth ?? "—"} → ${row.endMonth}`
        : `${row.startMonth ?? "—"} → ${lifecycleLabels.ongoing}`
    );
  }

  const ownershipLabel =
    ownerId && memberLookupRecord[ownerId]
      ? memberLookupRecord[ownerId]
      : row.memberName ?? householdLabel;

  const summary = [...moneyMetaParts, ownershipLabel]
    .filter(Boolean)
    .join(" • ");

  if (row.linkState === "orphaned" && !viewModel.tags.some((tag) => tag.key === `link-state-${row.id}`)) {
    viewModel.tags.push({
      key: `link-state-${row.id}`,
      label: orphanedLabel,
      kind: "source",
    });
  }

  return {
    summary,
    tags: viewModel.tags,
    metaTags: viewModel.metaTags.length > 0 ? viewModel.metaTags : buildMoneyMetaTags(metaInput),
    linkState: row.linkState ?? "linked",
  };
};
