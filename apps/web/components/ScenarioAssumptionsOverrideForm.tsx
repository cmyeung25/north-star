import {
  Alert,
  Anchor,
  Button,
  Group,
  NumberInput,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import { getAssumptionGuardrailWarnings } from "../src/domain/assumptions/guardrails";
import { scenarioAssumptionConstraints } from "../src/domain/scenarioAssumptions";
import type { ScenarioAssumptions } from "../src/store/scenarioStore";

export type ScenarioAssumptionsOverride = Partial<
  Pick<
    ScenarioAssumptions,
    | "inflationRate"
    | "salaryGrowthRate"
    | "emergencyFundMonths"
    | "rentAnnualGrowthPct"
    | "propertyAppreciationPct"
    | "cashYieldPct"
    | "carDepreciationRatePct"
  >
>;

export const SCENARIO_ASSUMPTION_OVERRIDE_KEYS: Array<keyof ScenarioAssumptionsOverride> = [
  "inflationRate",
  "salaryGrowthRate",
  "emergencyFundMonths",
  "rentAnnualGrowthPct",
  "propertyAppreciationPct",
  "cashYieldPct",
  "carDepreciationRatePct",
];

type Labels = {
  inflationRate: string;
  salaryGrowthRate: string;
  emergencyFundMonths: string;
  emergencyFundValue: (months: number) => string;
  rentAnnualGrowthPct: string;
  propertyAppreciationPct: string;
  cashYieldPct: string;
  carDepreciationRatePct: string;
  baselinePrefix: string;
  impactCount?: (count: number) => string;
  impactView?: string;
  guardrailWarningTitle: string;
  guardrailImpactText: string;
  guardrailInflationOutOfComfortRange: (inflationRate: number) => string;
  guardrailSalaryInflationGapTooWide: (gap: number) => string;
  guardrailApplySuggestion: string;
  guardrailSuggestedInflation: (value: number) => string;
  guardrailSuggestedSalaryGrowth: (value: number) => string;
};

type Props = {
  values: ScenarioAssumptionsOverride;
  baseline: ScenarioAssumptionsOverride;
  labels: Labels;
  emergencyFundRange?: { min: number; max: number; step?: number };
  impactCountByKey?: Partial<Record<keyof ScenarioAssumptionsOverride, number>>;
  onViewAffectedEvents?: (key: keyof ScenarioAssumptionsOverride) => void;
  onChange: (patch: ScenarioAssumptionsOverride) => void;
};

const formatBaselineValue = (value: number | undefined, suffix = "%") =>
  typeof value === "number" ? `${value}${suffix}` : "—";

const baselineLabel = (prefix: string, value: number | undefined, suffix?: string) =>
  `${prefix}${formatBaselineValue(value, suffix)}`;

export default function ScenarioAssumptionsOverrideForm({
  values,
  baseline,
  labels,
  emergencyFundRange,
  impactCountByKey,
  onViewAffectedEvents,
  onChange,
}: Props) {
  const emergencyMin =
    emergencyFundRange?.min ?? scenarioAssumptionConstraints.emergencyFundMonths.min;
  const emergencyMax =
    emergencyFundRange?.max ?? scenarioAssumptionConstraints.emergencyFundMonths.max;
  const emergencyStep =
    emergencyFundRange?.step ?? scenarioAssumptionConstraints.emergencyFundMonths.step;

  const guardrailWarnings = getAssumptionGuardrailWarnings({
    inflationRate: values.inflationRate,
    salaryGrowthRate: values.salaryGrowthRate,
  });

  const renderImpact = (key: keyof ScenarioAssumptionsOverride) => {
    if (!labels.impactCount) {
      return null;
    }
    const count = impactCountByKey?.[key] ?? 0;

    return (
      <Group gap={8} mt={6}>
        <Text size="xs" c="dimmed">
          {labels.impactCount(count)}
        </Text>
        {onViewAffectedEvents ? (
          <Anchor
            size="xs"
            component="button"
            type="button"
            onClick={() => onViewAffectedEvents(key)}
          >
            {labels.impactView ?? "View"}
          </Anchor>
        ) : null}
      </Group>
    );
  };

  return (
    <Stack gap="md">
      {guardrailWarnings.map((warning) => (
        <Alert
          key={warning.code}
          color="yellow"
          variant="light"
          title={labels.guardrailWarningTitle}
        >
          <Stack gap={8}>
            <Text size="sm">
              {warning.code === "inflationOutOfComfortRange"
                ? labels.guardrailInflationOutOfComfortRange(warning.context.inflationRate)
                : labels.guardrailSalaryInflationGapTooWide(warning.context.gap ?? 0)}
            </Text>
            <Text size="sm">{labels.guardrailImpactText}</Text>
            <Group gap={8}>
              <Text size="xs" c="dimmed">
                {labels.guardrailApplySuggestion}
              </Text>
              {typeof warning.suggestion.inflationRate === "number" ? (
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => onChange({ inflationRate: warning.suggestion.inflationRate })}
                >
                  {labels.guardrailSuggestedInflation(warning.suggestion.inflationRate)}
                </Button>
              ) : null}
              {typeof warning.suggestion.salaryGrowthRate === "number" ? (
                <Button
                  size="xs"
                  variant="default"
                  onClick={() =>
                    onChange({ salaryGrowthRate: warning.suggestion.salaryGrowthRate })
                  }
                >
                  {labels.guardrailSuggestedSalaryGrowth(
                    warning.suggestion.salaryGrowthRate
                  )}
                </Button>
              ) : null}
            </Group>
          </Stack>
        </Alert>
      ))}

      <Group grow align="start">
        <Stack gap={2}>
          <NumberInput
            label={labels.inflationRate}
            description={baselineLabel(labels.baselinePrefix, baseline.inflationRate)}
            value={values.inflationRate ?? ""}
            min={scenarioAssumptionConstraints.inflationRate.min}
            max={scenarioAssumptionConstraints.inflationRate.max}
            step={scenarioAssumptionConstraints.inflationRate.step}
            decimalScale={2}
            onChange={(value) =>
              onChange({ inflationRate: typeof value === "number" ? value : undefined })
            }
          />
          {renderImpact("inflationRate")}
        </Stack>
        <Stack gap={2}>
          <NumberInput
            label={labels.salaryGrowthRate}
            description={baselineLabel(labels.baselinePrefix, baseline.salaryGrowthRate)}
            value={values.salaryGrowthRate ?? ""}
            min={scenarioAssumptionConstraints.salaryGrowthRate.min}
            max={scenarioAssumptionConstraints.salaryGrowthRate.max}
            step={scenarioAssumptionConstraints.salaryGrowthRate.step}
            decimalScale={2}
            onChange={(value) =>
              onChange({ salaryGrowthRate: typeof value === "number" ? value : undefined })
            }
          />
          {renderImpact("salaryGrowthRate")}
        </Stack>
      </Group>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{labels.emergencyFundMonths}</Text>
          <Text size="sm" c="dimmed">
            {labels.emergencyFundValue(values.emergencyFundMonths ?? baseline.emergencyFundMonths ?? 6)}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {baselineLabel(labels.baselinePrefix, baseline.emergencyFundMonths, " 個月")}
        </Text>
        <Slider
          min={emergencyMin}
          max={emergencyMax}
          step={emergencyStep}
          value={values.emergencyFundMonths ?? baseline.emergencyFundMonths ?? 6}
          onChange={(value) => onChange({ emergencyFundMonths: value })}
        />
        {renderImpact("emergencyFundMonths")}
      </Stack>

      <Group grow align="start">
        <Stack gap={2}>
          <NumberInput
            label={labels.rentAnnualGrowthPct}
            description={baselineLabel(labels.baselinePrefix, baseline.rentAnnualGrowthPct)}
            value={values.rentAnnualGrowthPct ?? ""}
            min={scenarioAssumptionConstraints.rentAnnualGrowthPct.min}
            max={scenarioAssumptionConstraints.rentAnnualGrowthPct.max}
            step={scenarioAssumptionConstraints.rentAnnualGrowthPct.step}
            decimalScale={2}
            onChange={(value) =>
              onChange({ rentAnnualGrowthPct: typeof value === "number" ? value : undefined })
            }
          />
          {renderImpact("rentAnnualGrowthPct")}
        </Stack>
        <Stack gap={2}>
          <NumberInput
            label={labels.propertyAppreciationPct}
            description={baselineLabel(labels.baselinePrefix, baseline.propertyAppreciationPct)}
            value={values.propertyAppreciationPct ?? ""}
            min={scenarioAssumptionConstraints.propertyAppreciationPct.min}
            max={scenarioAssumptionConstraints.propertyAppreciationPct.max}
            step={scenarioAssumptionConstraints.propertyAppreciationPct.step}
            decimalScale={2}
            onChange={(value) =>
              onChange({
                propertyAppreciationPct: typeof value === "number" ? value : undefined,
              })
            }
          />
          {renderImpact("propertyAppreciationPct")}
        </Stack>
      </Group>

      <Group grow align="start">
        <Stack gap={2}>
          <NumberInput
            label={labels.cashYieldPct}
            description={baselineLabel(labels.baselinePrefix, baseline.cashYieldPct)}
            value={values.cashYieldPct ?? ""}
            min={scenarioAssumptionConstraints.cashYieldPct.min}
            max={scenarioAssumptionConstraints.cashYieldPct.max}
            step={scenarioAssumptionConstraints.cashYieldPct.step}
            decimalScale={2}
            onChange={(value) =>
              onChange({ cashYieldPct: typeof value === "number" ? value : undefined })
            }
          />
          {renderImpact("cashYieldPct")}
        </Stack>
        <Stack gap={2}>
          <NumberInput
            label={labels.carDepreciationRatePct}
            description={baselineLabel(labels.baselinePrefix, baseline.carDepreciationRatePct)}
            value={values.carDepreciationRatePct ?? ""}
            min={scenarioAssumptionConstraints.carDepreciationRatePct.min}
            max={scenarioAssumptionConstraints.carDepreciationRatePct.max}
            step={scenarioAssumptionConstraints.carDepreciationRatePct.step}
            decimalScale={2}
            onChange={(value) =>
              onChange({
                carDepreciationRatePct: typeof value === "number" ? value : undefined,
              })
            }
          />
          {renderImpact("carDepreciationRatePct")}
        </Stack>
      </Group>
    </Stack>
  );
}
