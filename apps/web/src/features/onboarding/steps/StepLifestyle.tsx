import {
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

interface StepLifestyleProps {
  rentEnabled: boolean;
  rentMonthly: number;
  rentStartMonth: string;
  rentDurationYears?: number;
  carEnabled: boolean;
  carPurchaseMonth: string;
  carPurchasePrice: number;
  carDownPayment: number;
  carLoanTermYears: number;
  carLoanRatePct: number;
  carHoldingCostMonthly: number;
  carDepreciationPct: number;
  travelEnabled: boolean;
  travelAnnualBudget: number;
  errors: Record<string, string | undefined>;
  onRentEnabledChange: (value: boolean) => void;
  onRentChange: (patch: {
    rentMonthly?: number;
    rentStartMonth?: string;
    rentDurationYears?: number;
  }) => void;
  onCarEnabledChange: (value: boolean) => void;
  onCarChange: (patch: {
    carPurchaseMonth?: string;
    carPurchasePrice?: number;
    carDownPayment?: number;
    carLoanTermYears?: number;
    carLoanRatePct?: number;
    carHoldingCostMonthly?: number;
    carDepreciationPct?: number;
  }) => void;
  onTravelEnabledChange: (value: boolean) => void;
  onTravelChange: (annualBudget: number) => void;
}

export default function StepLifestyle({
  rentEnabled,
  rentMonthly,
  rentStartMonth,
  rentDurationYears,
  carEnabled,
  carPurchaseMonth,
  carPurchasePrice,
  carDownPayment,
  carLoanTermYears,
  carLoanRatePct,
  carHoldingCostMonthly,
  carDepreciationPct,
  travelEnabled,
  travelAnnualBudget,
  errors,
  onRentEnabledChange,
  onRentChange,
  onCarEnabledChange,
  onCarChange,
  onTravelEnabledChange,
  onTravelChange,
}: StepLifestyleProps) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>生活選擇</Title>
        <Text size="sm" c="dimmed">
          選擇租屋、買車或旅行開支，系統會建立相應的 event 或 position。
        </Text>
      </Stack>

      <Stack gap="md">
        <Switch
          label="我需要租屋"
          checked={rentEnabled}
          onChange={(event) => onRentEnabledChange(event.currentTarget.checked)}
        />
        {rentEnabled && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NumberInput
              label="每月租金"
              value={Number.isFinite(rentMonthly) ? rentMonthly : 0}
              onChange={(value) => onRentChange({ rentMonthly: Number(value ?? 0) })}
              min={0}
              thousandSeparator=","
              error={errors.rentMonthly}
            />
            <TextInput
              label="開始月份"
              type="month"
              value={rentStartMonth}
              onChange={(event) =>
                onRentChange({ rentStartMonth: event.currentTarget.value })
              }
              error={errors.rentStartMonth}
            />
            <NumberInput
              label="租期（年）"
              value={rentDurationYears ?? ""}
              onChange={(value) =>
                onRentChange({
                  rentDurationYears:
                    typeof value === "number" && !Number.isNaN(value) ? value : 0,
                })
              }
              min={0}
              step={0.5}
              error={errors.rentDurationYears}
            />
          </SimpleGrid>
        )}
      </Stack>

      <Stack gap="md">
        <Switch
          label="我會買車"
          checked={carEnabled}
          onChange={(event) => onCarEnabledChange(event.currentTarget.checked)}
        />
        {carEnabled && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="購買月份"
              type="month"
              value={carPurchaseMonth}
              onChange={(event) =>
                onCarChange({ carPurchaseMonth: event.currentTarget.value })
              }
              error={errors.carPurchaseMonth}
            />
            <NumberInput
              label="車價"
              value={Number.isFinite(carPurchasePrice) ? carPurchasePrice : 0}
              onChange={(value) =>
                onCarChange({ carPurchasePrice: Number(value ?? 0) })
              }
              min={0}
              thousandSeparator=","
              error={errors.carPurchasePrice}
            />
            <NumberInput
              label="首期"
              value={Number.isFinite(carDownPayment) ? carDownPayment : 0}
              onChange={(value) => onCarChange({ carDownPayment: Number(value ?? 0) })}
              min={0}
              thousandSeparator=","
              error={errors.carDownPayment}
            />
            <NumberInput
              label="供款年期"
              value={Number.isFinite(carLoanTermYears) ? carLoanTermYears : 0}
              onChange={(value) =>
                onCarChange({ carLoanTermYears: Number(value ?? 0) })
              }
              min={0}
              error={errors.carLoanTermYears}
            />
            <NumberInput
              label="利率 %"
              value={Number.isFinite(carLoanRatePct) ? carLoanRatePct : 0}
              onChange={(value) => onCarChange({ carLoanRatePct: Number(value ?? 0) })}
              min={0}
              max={100}
              error={errors.carLoanRatePct}
            />
            <NumberInput
              label="每月持有成本"
              value={
                Number.isFinite(carHoldingCostMonthly) ? carHoldingCostMonthly : 0
              }
              onChange={(value) =>
                onCarChange({ carHoldingCostMonthly: Number(value ?? 0) })
              }
              min={0}
              thousandSeparator=","
              error={errors.carHoldingCostMonthly}
            />
            <NumberInput
              label="年折舊 %"
              value={Number.isFinite(carDepreciationPct) ? carDepreciationPct : 0}
              onChange={(value) =>
                onCarChange({ carDepreciationPct: Number(value ?? 0) })
              }
              min={0}
              max={100}
              error={errors.carDepreciationPct}
            />
          </SimpleGrid>
        )}
      </Stack>

      <Stack gap="md">
        <Switch
          label="我有旅行預算"
          checked={travelEnabled}
          onChange={(event) => onTravelEnabledChange(event.currentTarget.checked)}
        />
        {travelEnabled && (
          <NumberInput
            label="每年旅行預算"
            value={Number.isFinite(travelAnnualBudget) ? travelAnnualBudget : 0}
            onChange={(value) => onTravelChange(Number(value ?? 0))}
            min={0}
            thousandSeparator=","
            error={errors.travelAnnualBudget}
          />
        )}
      </Stack>
    </Stack>
  );
}
