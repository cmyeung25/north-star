import { Card, MultiSelect, Select, Stack, Text } from "@mantine/core";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../../../../components/MonthField";
import { YEAR_MONTH_PLACEHOLDER } from "./monthFieldConstants";
import type { PersonaFocus } from "../../../../store/scenarioStore";
import type { ScenarioDraftV3State } from "../types";

const SUPPORTED_CURRENCY_OPTIONS = [
  "HKD",
  "USD",
  "CNY",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
].map((code) => ({ value: code, label: code }));

const DEFAULT_HORIZON_MONTHS = 120;

const PERSONA_FOCUS_KEYS: PersonaFocus[] = ["family", "fertility", "education", "retirement"];

type TemplateRecommendation = {
  id: string;
  label: string;
};

const buildTemplateRecommendations = (
  personaFocuses: PersonaFocus[],
  t: ReturnType<typeof useTranslations>
): TemplateRecommendation[] => {
  if (personaFocuses.includes("retirement")) {
    return [
      { id: "retirement-spend", label: t("scenarioSetup.recommendations.nearRetirement.retirementSpend") },
      { id: "retirement-healthcare", label: t("scenarioSetup.recommendations.nearRetirement.healthcare") },
      { id: "retirement-withdrawal", label: t("scenarioSetup.recommendations.nearRetirement.withdrawal") },
    ];
  }

  if (
    personaFocuses.includes("family") ||
    personaFocuses.includes("fertility") ||
    personaFocuses.includes("education")
  ) {
    return [
      { id: "married-fertility", label: t("scenarioSetup.recommendations.married.fertility") },
      { id: "married-helper", label: t("scenarioSetup.recommendations.married.helper") },
      { id: "married-education", label: t("scenarioSetup.recommendations.married.education") },
      { id: "married-support", label: t("scenarioSetup.recommendations.married.familySupport") },
    ];
  }

  return [
    { id: "grad-marriage", label: t("scenarioSetup.recommendations.graduate.marriage") },
    { id: "grad-rent-to-buy", label: t("scenarioSetup.recommendations.graduate.rentToBuy") },
    { id: "grad-income-growth", label: t("scenarioSetup.recommendations.graduate.incomeGrowth") },
  ];
};

type Props = {
  profile: ScenarioDraftV3State["profile"];
  personaFocuses: PersonaFocus[];
  onChange: (profile: ScenarioDraftV3State["profile"]) => void;
  onPersonaFocusesChange: (focuses: PersonaFocus[]) => void;
};

export default function ScenarioSetupStep({ profile, personaFocuses, onChange, onPersonaFocusesChange }: Props) {
  const t = useTranslations("onboardingV3.steps");
  const recommendations = buildTemplateRecommendations(personaFocuses, t);

  useEffect(() => {
    if (profile.horizonMonths !== undefined) {
      return;
    }

    onChange({ ...profile, horizonMonths: DEFAULT_HORIZON_MONTHS });
  }, [onChange, profile]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("scenarioSetup.title")}</Text>
            <Text size="sm" c="dimmed">{t("scenarioSetup.description")}</Text>
          </Stack>

          <Stack gap="md">
            <Select
              searchable
              label={t("scenarioSetup.fields.baseCurrency")}
              description={t("scenarioSetup.fields.baseCurrencyHelp")}
              data={SUPPORTED_CURRENCY_OPTIONS}
              value={profile.baseCurrency ?? ""}
              onChange={(value) => onChange({ ...profile, baseCurrency: value ?? "HKD" })}
            />
            <MonthField
              label={t("scenarioSetup.fields.startMonth")}
              description={t("scenarioSetup.fields.startMonthHelp")}
              placeholder={YEAR_MONTH_PLACEHOLDER}
              value={profile.startMonth ?? ""}
              onChange={(value) => onChange({ ...profile, startMonth: value })}
            />
            <input type="hidden" name="horizonMonths" value={profile.horizonMonths ?? DEFAULT_HORIZON_MONTHS} readOnly />
            <MultiSelect
              data={PERSONA_FOCUS_KEYS.map((key) => ({ value: key, label: t(`scenarioSetup.personaFocus.${key}`) }))}
              label={t("scenarioSetup.personaFocusLabel")}
              description={t("scenarioSetup.personaFocusDescription")}
              value={personaFocuses}
              onChange={(values) => onPersonaFocusesChange(values as PersonaFocus[])}
              searchable={false}
              clearable
            />
            <Stack gap={4}>
              <Text size="sm" fw={600}>{t("scenarioSetup.recommendationTitle")}</Text>
              {recommendations.map((item) => (
                <Text key={item.id} size="sm" c="dimmed">• {item.label}</Text>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
