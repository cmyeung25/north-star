export const MARKET_ENTRY_EXPERIMENT_VARIANT_NAME_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*_v[0-9]+$/;

export const MARKET_ENTRY_EXPERIMENT_SLOTS = {
  heroValueProp: {
    key: "landing.hero.value_prop",
    defaultVariant: "control_v1",
    allowedVariants: ["control_v1", "clarity_first_v1"] as const,
  },
  personaCtaSummary: {
    key: "landing.persona.cta_summary",
    defaultVariant: "control_v1",
    allowedVariants: ["control_v1", "decision_first_v1"] as const,
  },
  sampleJourneySummary: {
    key: "landing.sample_journey.summary",
    defaultVariant: "control_v1",
    allowedVariants: ["control_v1", "decision_first_v1"] as const,
  },
} as const;

export type MarketEntryExperimentSlotName = keyof typeof MARKET_ENTRY_EXPERIMENT_SLOTS;
export type MarketEntryExperimentSlotKey =
  (typeof MARKET_ENTRY_EXPERIMENT_SLOTS)[MarketEntryExperimentSlotName]["key"];

export type MarketEntryExperimentSelection = {
  [K in MarketEntryExperimentSlotKey]: string;
};

export type HeroProofKey = "cashflow" | "netWorth" | "guardrails";
export type PersonaSummaryBlockKey = "outcome" | "decision";
export type SampleJourneySummaryBlockKey = "start" | "decision" | "outputs";

const slotDefinitionsByKey = Object.values(MARKET_ENTRY_EXPERIMENT_SLOTS).reduce(
  (acc, slot) => {
    acc[slot.key] = slot;
    return acc;
  },
  {} as Record<MarketEntryExperimentSlotKey, (typeof MARKET_ENTRY_EXPERIMENT_SLOTS)[MarketEntryExperimentSlotName]>,
);

export const DEFAULT_MARKET_ENTRY_EXPERIMENT_SELECTION: MarketEntryExperimentSelection = {
  [MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.key]:
    MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.defaultVariant,
  [MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.key]:
    MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.defaultVariant,
  [MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.key]:
    MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.defaultVariant,
};

export function isMarketEntryExperimentVariantName(value: string): boolean {
  return MARKET_ENTRY_EXPERIMENT_VARIANT_NAME_PATTERN.test(value);
}

export function resolveMarketEntryExperimentSelection(
  overrides?: Partial<Record<MarketEntryExperimentSlotKey, string | null | undefined>>,
): MarketEntryExperimentSelection {
  const nextSelection = { ...DEFAULT_MARKET_ENTRY_EXPERIMENT_SELECTION };

  if (!overrides) {
    return nextSelection;
  }

  (Object.keys(nextSelection) as MarketEntryExperimentSlotKey[]).forEach((slotKey) => {
    const override = overrides[slotKey];
    if (!override || !isMarketEntryExperimentVariantName(override)) {
      return;
    }
    const slotDefinition = slotDefinitionsByKey[slotKey];
    if (slotDefinition.allowedVariants.includes(override as never)) {
      nextSelection[slotKey] = override;
    }
  });

  return nextSelection;
}

export function getHeroValuePropExperimentContent(selection: MarketEntryExperimentSelection) {
  const slotKey = MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.key;
  const variant = selection[slotKey] as (typeof MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.allowedVariants)[number];

  const proofOrderByVariant: Record<typeof variant, HeroProofKey[]> = {
    control_v1: ["cashflow", "netWorth", "guardrails"],
    clarity_first_v1: ["guardrails", "cashflow", "netWorth"],
  };

  return {
    slotKey,
    variant,
    titleKey: `hero.variants.${variant}.title`,
    subtitleKey: `hero.variants.${variant}.subtitle`,
    proofOrder: proofOrderByVariant[variant],
  };
}

export function getPersonaCtaExperimentContent(selection: MarketEntryExperimentSelection) {
  const slotKey = MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.key;
  const variant = selection[slotKey] as (typeof MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.allowedVariants)[number];

  const summaryOrderByVariant: Record<typeof variant, PersonaSummaryBlockKey[]> = {
    control_v1: ["outcome", "decision"],
    decision_first_v1: ["decision", "outcome"],
  };

  const ctaKeyByVariant: Record<typeof variant, "cta" | "ctaDecisionFirst"> = {
    control_v1: "cta",
    decision_first_v1: "ctaDecisionFirst",
  };

  return {
    slotKey,
    variant,
    summaryOrder: summaryOrderByVariant[variant],
    ctaKey: ctaKeyByVariant[variant],
  };
}

export function getSampleJourneySummaryExperimentContent(selection: MarketEntryExperimentSelection) {
  const slotKey = MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.key;
  const variant = selection[slotKey] as (typeof MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.allowedVariants)[number];

  const summaryOrderByVariant: Record<typeof variant, SampleJourneySummaryBlockKey[]> = {
    control_v1: ["start", "decision", "outputs"],
    decision_first_v1: ["decision", "start", "outputs"],
  };

  return {
    slotKey,
    variant,
    subtitleKey: `sampleJourney.variants.${variant}.subtitle`,
    summaryOrder: summaryOrderByVariant[variant],
  };
}
