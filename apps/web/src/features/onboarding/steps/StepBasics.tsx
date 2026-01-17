import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { OnboardingPersona } from "../types";

interface StepBasicsProps {
  baseMonth: string;
  initialCash: number;
  horizonMonths: number;
  persona?: OnboardingPersona;
  errors: Record<string, string | undefined>;
  onBaseMonthChange: (value: string) => void;
  onInitialCashChange: (value: number) => void;
  onHorizonChange: (value: number) => void;
}

const horizonOptions = [
  { label: "5 年", value: "60" },
  { label: "10 年", value: "120" },
  { label: "20 年", value: "240" },
  { label: "到退休", value: "360" },
];

const cashQuickChips = [0, 20000, 50000, 100000];

export default function StepBasics({
  baseMonth,
  initialCash,
  horizonMonths,
  persona,
  errors,
  onBaseMonthChange,
  onInitialCashChange,
  onHorizonChange,
}: StepBasicsProps) {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={4}>基本設定</Title>
        <Text size="sm" c="dimmed">
          先設定起始月份、現金與投影年期。
        </Text>
      </Stack>
      <TextInput
        label="起始月份"
        type="month"
        value={baseMonth}
        onChange={(event) => onBaseMonthChange(event.currentTarget.value)}
        error={errors.baseMonth}
      />
      <Stack gap={6}>
        <NumberInput
          label="起始現金"
          value={Number.isFinite(initialCash) ? initialCash : 0}
          onChange={(value) => onInitialCashChange(Number(value ?? 0))}
          thousandSeparator=","
          min={0}
          error={errors.initialCash}
        />
        <Group gap="xs">
          {cashQuickChips.map((amount) => (
            <Button
              key={amount}
              size="xs"
              variant={initialCash === amount ? "filled" : "light"}
              onClick={() => onInitialCashChange(amount)}
            >
              {amount.toLocaleString()}
            </Button>
          ))}
        </Group>
      </Stack>
      <Stack gap={6}>
        <Text fw={500}>投影年期</Text>
        <SegmentedControl
          data={horizonOptions}
          value={String(horizonMonths)}
          onChange={(value) => onHorizonChange(Number(value))}
          fullWidth
        />
        {persona === "A" && (
          <Text size="xs" c="dimmed">
            學生 / 初入職通常會用較短時間做初步規劃。
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
