import { Group, NumberInput, Slider, Stack, Text } from "@mantine/core";
import type { ScenarioAssumptions } from "../src/store/scenarioStore";
import { scenarioAssumptionConstraints } from "../src/domain/scenarioAssumptions";

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
};

type Props = {
  values: ScenarioAssumptionsOverride;
  baseline: ScenarioAssumptionsOverride;
  labels: Labels;
  emergencyFundRange?: { min: number; max: number; step?: number };
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
  onChange,
}: Props) {
  const emergencyMin =
    emergencyFundRange?.min ?? scenarioAssumptionConstraints.emergencyFundMonths.min;
  const emergencyMax =
    emergencyFundRange?.max ?? scenarioAssumptionConstraints.emergencyFundMonths.max;
  const emergencyStep =
    emergencyFundRange?.step ?? scenarioAssumptionConstraints.emergencyFundMonths.step;

  return (
    <Stack gap="md">
      <Group grow align="start">
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
      </Stack>

      <Group grow align="start">
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
      </Group>

      <Group grow align="start">
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
      </Group>
    </Stack>
  );
}
