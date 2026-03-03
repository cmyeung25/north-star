import {
  buildMoneyMetaTags,
  type MoneyMetaInput,
  type MetaTag,
} from "../../domain/events/buildMoneyMetaTags";
import type { MoneyTagItem } from "./moneyTagConfig";

export type BuildMoneyMetaTagViewModelOptions = {
  memberLookupRecord?: Record<string, string>;
  ownerId?: string;
  householdLabel: string;
  resolveTypeLabel: (meta: MetaTag) => string;
  resolveFrequencyLabel: (meta: MetaTag) => string | null;
  resolveLifecycleLabel: (meta: MetaTag) => string;
  categoryLabel?: string | null;
  growthLabel?: string | null;
  adjustmentCount?: number;
  adjustmentLabel?: string;
  projectionLabel?: string | null;
  sourceLabel?: string | null;
  attributeLabel?: string | null;
};

export const buildMoneyMetaTagViewModel = (
  input: MoneyMetaInput,
  options: BuildMoneyMetaTagViewModelOptions
): { metaTags: MetaTag[]; tags: MoneyTagItem[] } => {
  const metaTags = buildMoneyMetaTags(input);
  const [meta] = metaTags;
  const tags: MoneyTagItem[] = [
    {
      key: `type-${(input as { id: string }).id}`,
      label: options.resolveTypeLabel(meta),
      kind:
        meta.domain === "asset"
          ? "assetType"
          : meta.domain === "liability"
            ? "liabilityType"
            : meta.domain === "income"
              ? "incomeType"
              : "expenseType",
    },
    {
      key: `lifecycle-${(input as { id: string }).id}`,
      label: options.resolveLifecycleLabel(meta),
      kind: "attribute",
    },
  ];

  const frequencyLabel = options.resolveFrequencyLabel(meta);
  if (frequencyLabel) {
    tags.push({
      key: `frequency-${(input as { id: string }).id}`,
      label: frequencyLabel,
      kind: "cadence",
    });
  }

  if (meta.belongsTo === "member") {
    const memberLookup = options.memberLookupRecord ?? {};
    const ownerId = options.ownerId;
    tags.push({
      key: `belongsTo-${(input as { id: string }).id}`,
      label: (ownerId && memberLookup[ownerId]) || options.householdLabel,
      kind: "member",
    });
  }

  if (options.categoryLabel) {
    tags.push({ key: `category-${(input as { id: string }).id}`, label: options.categoryLabel, kind: "category" });
  }
  if (options.growthLabel) {
    tags.push({ key: `growth-${(input as { id: string }).id}`, label: options.growthLabel, kind: "growth" });
  }
  if (options.adjustmentCount && options.adjustmentCount > 0 && options.adjustmentLabel) {
    tags.push({ key: `adjustment-${(input as { id: string }).id}`, label: options.adjustmentLabel, kind: "adjustment" });
  }
  if (options.projectionLabel) {
    tags.push({ key: `projection-${(input as { id: string }).id}`, label: options.projectionLabel, kind: "projection" });
  }
  if (options.sourceLabel) {
    tags.push({ key: `source-${(input as { id: string }).id}`, label: options.sourceLabel, kind: "source" });
  }
  if (options.attributeLabel) {
    tags.push({ key: `attribute-extra-${(input as { id: string }).id}`, label: options.attributeLabel, kind: "attribute" });
  }

  return { metaTags, tags };
};
