import { NumberInput, Stack, Text, TextInput, Title } from "@mantine/core";
import type { OnboardingPersona } from "../types";

interface StepIncomeProps {
  persona?: OnboardingPersona;
  monthlyIncome: number;
  annualGrowthPct?: number;
  retirementMonth?: string | null;
  errors: Record<string, string | undefined>;
  onMonthlyIncomeChange: (value: number) => void;
  onAnnualGrowthChange: (value?: number) => void;
  onRetirementMonthChange: (value: string) => void;
}

export default function StepIncome({
  persona,
  monthlyIncome,
  annualGrowthPct,
  retirementMonth,
  errors,
  onMonthlyIncomeChange,
  onAnnualGrowthChange,
  onRetirementMonthChange,
}: StepIncomeProps) {
  const needsRetirementMonth = persona === "D";
  const showRetirementMonth = persona === "D" || persona === "E";

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={4}>收入</Title>
        <Text size="sm" c="dimmed">
          這裡會建立一條每月收入的 timeline event。
        </Text>
      </Stack>
      <NumberInput
        label="每月收入"
        value={Number.isFinite(monthlyIncome) ? monthlyIncome : 0}
        onChange={(value) => onMonthlyIncomeChange(Number(value ?? 0))}
        thousandSeparator=","
        min={0}
        error={errors.monthlyIncome}
      />
      <NumberInput
        label="年增長 %（可選）"
        value={annualGrowthPct ?? ""}
        onChange={(value) =>
          onAnnualGrowthChange(
            typeof value === "number" && !Number.isNaN(value) ? value : undefined
          )
        }
        min={0}
        max={100}
        error={errors.annualGrowthPct}
      />
      {showRetirementMonth && (
        <TextInput
          label={needsRetirementMonth ? "退休月份（必填）" : "退休月份（可選）"}
          type="month"
          value={retirementMonth ?? ""}
          onChange={(event) => onRetirementMonthChange(event.currentTarget.value)}
          error={errors.retirementMonth}
        />
      )}
    </Stack>
  );
}
