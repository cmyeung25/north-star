import { Card, Select, Stack, Text } from "@mantine/core";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../../../../components/MonthField";
import { YEAR_MONTH_PLACEHOLDER } from "./monthFieldConstants";
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

type Props = {
  profile: ScenarioDraftV3State["profile"];
  onChange: (profile: ScenarioDraftV3State["profile"]) => void;
};

export default function ScenarioSetupStep({ profile, onChange }: Props) {
  const t = useTranslations("onboardingV3.steps");

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
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
