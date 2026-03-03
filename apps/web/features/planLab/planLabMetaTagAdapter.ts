import { buildMoneyMetaTags } from "../../src/domain/events/buildMoneyMetaTags";
import { buildMoneyMetaTagViewModel } from "../../src/features/money/moneyMetaTagViewModel";
import type { MetaTag } from "../../src/domain/events/buildMoneyMetaTags";
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
    kind: row.category?.toLowerCase() === "income" ? "income" : "expense",
    type: "cashflow",
    cadence,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
    memberId: row.memberId ?? row.defaultMemberId,
  };
};

const resolveTypeLabel = (meta: MetaTag) => `${meta.domain} · ${meta.kind}`;

const resolveLifecycleLabel = (meta: MetaTag) => {
  if (meta.lifecycle === "oneOff") return "一次性";
  if (meta.lifecycle === "hasEndMonth") return "有結束月份";
  return "持續";
};

const resolveFrequencyLabel = (
  meta: MetaTag,
  frequencyLabels: Record<NonNullable<PlanLabFrequency>, string>,
  intervalMonths?: number | null
) => {
  if (meta.frequency === "none") return null;
  if (meta.frequency === "everyNMonths") {
    return intervalMonths && intervalMonths > 0
      ? `每 ${intervalMonths} 個月`
      : frequencyLabels.everyNMonths;
  }
  if (meta.frequency === "recurring") return frequencyLabels.schedule;
  return frequencyLabels[meta.frequency as NonNullable<PlanLabFrequency>] ?? null;
};

export const adaptPlanLabRowMeta = ({
  row,
  currency,
  locale,
  frequencyLabels,
  householdLabel,
  memberLookupRecord,
}: {
  row: PlanLabMetaTagAdapterInput;
  currency: string;
  locale: string;
  frequencyLabels: Record<NonNullable<PlanLabFrequency>, string>;
  householdLabel: string;
  memberLookupRecord: Record<string, string>;
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
    resolveTypeLabel,
    resolveLifecycleLabel,
    resolveFrequencyLabel: (meta) => resolveFrequencyLabel(meta, frequencyLabels, row.intervalMonths),
  });

  const moneyMetaParts: string[] = [];
  if (row.amount !== undefined) {
    moneyMetaParts.push(formatCurrency(row.amount, currency, locale));
  }
  if (row.startMonth || row.endMonth) {
    moneyMetaParts.push(row.endMonth ? `${row.startMonth ?? "—"} 至 ${row.endMonth}` : `${row.startMonth ?? "—"} 起`);
  }

  const ownershipLabel =
    ownerId && memberLookupRecord[ownerId]
      ? memberLookupRecord[ownerId]
      : row.memberName ?? householdLabel;

  const summary = [...moneyMetaParts, ownershipLabel]
    .filter(Boolean)
    .join(" • ");

  return {
    summary,
    tags: viewModel.tags,
    metaTags: viewModel.metaTags.length > 0 ? viewModel.metaTags : buildMoneyMetaTags(metaInput),
    linkState: row.linkState ?? "linked",
  };
};
