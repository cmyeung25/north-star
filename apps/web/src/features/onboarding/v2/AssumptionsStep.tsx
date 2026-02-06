import {
  Accordion,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { OnboardingV2DraftAssumptions } from "../../../domain/onboarding/v2/assumptions";

interface AssumptionsStepProps {
  assumptions: OnboardingV2DraftAssumptions;
  errors: Partial<Record<keyof OnboardingV2DraftAssumptions, string>>;
  onChange: (patch: Partial<OnboardingV2DraftAssumptions>) => void;
  t: (key: string) => string;
}

const normalizeInput = (value: string | number) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeRequiredInput = (value: string | number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export default function AssumptionsStep({
  assumptions,
  errors,
  onChange,
  t,
}: AssumptionsStepProps) {
  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Title order={4}>{t("assumptionsTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("assumptionsHint")}
          </Text>
          <Group grow align="flex-start">
            <NumberInput
              label={t("assumptionInflation")}
              value={assumptions.inflationPct ?? ""}
              min={-10}
              max={100}
              step={0.1}
              suffix="%"
              error={errors.inflationPct}
              onChange={(value) =>
                onChange({ inflationPct: normalizeInput(value) })
              }
            />
            <NumberInput
              label={t("assumptionIncomeGrowth")}
              value={assumptions.incomeGrowthPct ?? ""}
              min={-10}
              max={100}
              step={0.1}
              suffix="%"
              error={errors.incomeGrowthPct}
              onChange={(value) =>
                onChange({ incomeGrowthPct: normalizeInput(value) })
              }
            />
          </Group>
          <NumberInput
            label={t("assumptionInvestmentReturn")}
            value={assumptions.investmentReturnPct ?? ""}
            min={-50}
            max={100}
            step={0.1}
            suffix="%"
            error={errors.investmentReturnPct}
            onChange={(value) =>
              onChange({ investmentReturnPct: normalizeInput(value) })
            }
          />
        </Stack>
      </Card>

      <Accordion defaultValue="advanced">
        <Accordion.Item value="advanced">
          <Accordion.Control>{t("assumptionsAdvancedTitle")}</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md" mt="sm">
              <Text size="sm" c="dimmed">
                {t("assumptionsAdvancedHint")}
              </Text>
              <Group grow align="flex-start">
                <NumberInput
                  label={t("assumptionRentGrowth")}
                  description={t("assumptionRentGrowthImpact")}
                  value={assumptions.rentGrowthPct ?? ""}
                  min={-10}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) =>
                    onChange({
                      rentGrowthPct: normalizeRequiredInput(
                        value,
                        assumptions.rentGrowthPct ?? 0
                      ),
                    })
                  }
                />
                <NumberInput
                  label={t("assumptionPropertyAppreciation")}
                  description={t("assumptionPropertyAppreciationImpact")}
                  value={assumptions.propertyAppreciationPct ?? ""}
                  min={-50}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) =>
                    onChange({
                      propertyAppreciationPct: normalizeRequiredInput(
                        value,
                        assumptions.propertyAppreciationPct ?? 0
                      ),
                    })
                  }
                />
              </Group>
              <Group grow align="flex-start">
                <NumberInput
                  label={t("assumptionCarDepreciation")}
                  description={t("assumptionCarDepreciationImpact")}
                  value={assumptions.carDepreciationPct ?? ""}
                  min={-100}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) =>
                    onChange({
                      carDepreciationPct: normalizeRequiredInput(
                        value,
                        assumptions.carDepreciationPct ?? 0
                      ),
                    })
                  }
                />
                <NumberInput
                  label={t("assumptionCashYield")}
                  description={t("assumptionCashYieldImpact")}
                  value={assumptions.cashYieldPct ?? ""}
                  min={-10}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) =>
                    onChange({
                      cashYieldPct: normalizeRequiredInput(
                        value,
                        assumptions.cashYieldPct ?? 0
                      ),
                    })
                  }
                />
              </Group>
              <Select
                label={t("assumptionTaxInputMode")}
                placeholder={t("assumptionTaxInputPlaceholder")}
                data={[
                  { value: "gross", label: t("assumptionTaxModeGross") },
                  { value: "net", label: t("assumptionTaxModeNet") },
                ]}
                value={assumptions.taxInputMode ?? undefined}
                onChange={(value) =>
                  onChange({
                    taxInputMode: value ? (value as "gross" | "net") : null,
                  })
                }
                clearable
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
