import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKET_ENTRY_EXPERIMENT_SELECTION,
  getHeroValuePropExperimentContent,
  getPersonaCtaExperimentContent,
  getSampleJourneySummaryExperimentContent,
  isMarketEntryExperimentVariantName,
  MARKET_ENTRY_EXPERIMENT_SLOTS,
  resolveMarketEntryExperimentSelection,
} from "../marketEntryExperiments";

describe("marketEntryExperiments", () => {
  it("defines stable slot keys with explicit default variants", () => {
    expect(MARKET_ENTRY_EXPERIMENT_SLOTS).toEqual({
      heroValueProp: {
        key: "landing.hero.value_prop",
        defaultVariant: "control_v1",
        allowedVariants: ["control_v1", "clarity_first_v1"],
      },
      personaCtaSummary: {
        key: "landing.persona.cta_summary",
        defaultVariant: "control_v1",
        allowedVariants: ["control_v1", "decision_first_v1"],
      },
      sampleJourneySummary: {
        key: "landing.sample_journey.summary",
        defaultVariant: "control_v1",
        allowedVariants: ["control_v1", "decision_first_v1"],
      },
    });
  });

  it("enforces the vendor-agnostic variant naming rule", () => {
    expect(isMarketEntryExperimentVariantName("control_v1")).toBe(true);
    expect(isMarketEntryExperimentVariantName("decision_first_v1")).toBe(true);
    expect(isMarketEntryExperimentVariantName("ControlV1")).toBe(false);
    expect(isMarketEntryExperimentVariantName("decision-first")).toBe(false);
  });

  it("falls back to default variants for invalid or unsupported overrides", () => {
    expect(
      resolveMarketEntryExperimentSelection({
        [MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.key]: "clarity_first_v1",
        [MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.key]: "not_supported_v1",
        [MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.key]: "DecisionFirstV1",
      }),
    ).toEqual({
      ...DEFAULT_MARKET_ENTRY_EXPERIMENT_SELECTION,
      [MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.key]: "clarity_first_v1",
    });
  });

  it("only changes copy keys and ordering metadata for the hero slot", () => {
    const content = getHeroValuePropExperimentContent(
      resolveMarketEntryExperimentSelection({
        [MARKET_ENTRY_EXPERIMENT_SLOTS.heroValueProp.key]: "clarity_first_v1",
      }),
    );

    expect(content).toEqual({
      slotKey: "landing.hero.value_prop",
      variant: "clarity_first_v1",
      titleKey: "hero.variants.clarity_first_v1.title",
      subtitleKey: "hero.variants.clarity_first_v1.subtitle",
      proofOrder: ["guardrails", "cashflow", "netWorth"],
    });
  });

  it("only changes CTA copy key and summary order for the persona slot", () => {
    const content = getPersonaCtaExperimentContent(
      resolveMarketEntryExperimentSelection({
        [MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.key]: "decision_first_v1",
      }),
    );

    expect(content).toEqual({
      slotKey: "landing.persona.cta_summary",
      variant: "decision_first_v1",
      summaryOrder: ["decision", "outcome"],
      ctaKey: "ctaDecisionFirst",
    });
  });

  it("only changes subtitle key and summary order for the sample journey slot", () => {
    const content = getSampleJourneySummaryExperimentContent(
      resolveMarketEntryExperimentSelection({
        [MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.key]: "decision_first_v1",
      }),
    );

    expect(content).toEqual({
      slotKey: "landing.sample_journey.summary",
      variant: "decision_first_v1",
      subtitleKey: "sampleJourney.variants.decision_first_v1.subtitle",
      summaryOrder: ["decision", "start", "outputs"],
    });
  });
});
