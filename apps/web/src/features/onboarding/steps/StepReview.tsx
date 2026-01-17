import { Button, Card, Group, Stack, Switch, Text, Title } from "@mantine/core";
import NetWorthChart from "../../../../features/overview/components/NetWorthChart";
import type { TimeSeriesPoint } from "../../../../features/overview/types";

interface StepReviewProps {
  incomeMonthly: number;
  rentMonthly: number;
  travelAnnual: number;
  carMonthlyCost: number;
  homePurchasePrice: number;
  investmentMonthly: number;
  childMonthlyCost: number;
  showNoCar: boolean;
  showDelayHome: boolean;
  showExtraInvest: boolean;
  onNoCarToggle: (value: boolean) => void;
  onDelayHomeToggle: (value: boolean) => void;
  onExtraInvestToggle: (value: boolean) => void;
  previewSeries: TimeSeriesPoint[];
  onFinish: () => void;
}

const formatAmount = (value: number) =>
  value ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0";

export default function StepReview({
  incomeMonthly,
  rentMonthly,
  travelAnnual,
  carMonthlyCost,
  homePurchasePrice,
  investmentMonthly,
  childMonthlyCost,
  showNoCar,
  showDelayHome,
  showExtraInvest,
  onNoCarToggle,
  onDelayHomeToggle,
  onExtraInvestToggle,
  previewSeries,
  onFinish,
}: StepReviewProps) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>總覽</Title>
        <Text size="sm" c="dimmed">
          確認一下設定，然後完成建立 Scenario。
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text>每月收入：${formatAmount(incomeMonthly)}</Text>
          <Text>每月租金：${formatAmount(rentMonthly)}</Text>
          <Text>旅行預算（年）：${formatAmount(travelAnnual)}</Text>
          <Text>車輛每月成本：${formatAmount(carMonthlyCost)}</Text>
          <Text>置業金額：${formatAmount(homePurchasePrice)}</Text>
          <Text>每月投資：${formatAmount(investmentMonthly)}</Text>
          <Text>小朋友成本：${formatAmount(childMonthlyCost)}</Text>
        </Stack>
      </Card>

      <Stack gap="md">
        <Title order={5}>Quick Toggles</Title>
        <Switch
          label="如果我唔買車"
          checked={showNoCar}
          onChange={(event) => onNoCarToggle(event.currentTarget.checked)}
        />
        <Switch
          label="如果我遲兩年買樓"
          checked={showDelayHome}
          onChange={(event) => onDelayHomeToggle(event.currentTarget.checked)}
        />
        <Switch
          label="如果我每月多投資"
          checked={showExtraInvest}
          onChange={(event) => onExtraInvestToggle(event.currentTarget.checked)}
        />
      </Stack>

      <Stack gap="sm">
        <Title order={5}>Projection 預覽</Title>
        {previewSeries.length > 0 ? (
          <NetWorthChart data={previewSeries} title="Net Worth Preview" />
        ) : (
          <Text size="sm" c="dimmed">
            尚未有足夠資料產生預覽。
          </Text>
        )}
      </Stack>

      <Text size="sm" c="dimmed">
        提示：如果你之後手動新增類似支出事件，可能會重複計算；可在 Overview 的警告中查看。
      </Text>

      <Group justify="flex-end">
        <Button onClick={onFinish}>完成</Button>
      </Group>
    </Stack>
  );
}
