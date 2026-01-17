import {
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

interface StepDecisionsProps {
  showHome: boolean;
  showInvestment: boolean;
  homeEnabled: boolean;
  homePurchaseMonth: string;
  homePurchasePrice: number;
  homeDownPaymentPct: number;
  homeTermYears: number;
  homeRatePct: number;
  homeFees: number;
  homeHoldingCostMonthly: number;
  homeAppreciationPct: number;
  investmentEnabled: boolean;
  investmentMonthly: number;
  investmentReturnPct: number;
  investmentFeePct?: number;
  investmentStartMonth: string;
  loanEnabled: boolean;
  loanStartMonth: string;
  loanPrincipal: number;
  loanRatePct: number;
  loanTermYears: number;
  loanMonthlyPayment?: number;
  errors: Record<string, string | undefined>;
  onHomeToggle: (value: boolean) => void;
  onHomeChange: (patch: {
    homePurchaseMonth?: string;
    homePurchasePrice?: number;
    homeDownPaymentPct?: number;
    homeTermYears?: number;
    homeRatePct?: number;
    homeFees?: number;
    homeHoldingCostMonthly?: number;
    homeAppreciationPct?: number;
  }) => void;
  onInvestmentToggle: (value: boolean) => void;
  onInvestmentChange: (patch: {
    investmentMonthly?: number;
    investmentReturnPct?: number;
    investmentFeePct?: number;
    investmentStartMonth?: string;
  }) => void;
  onLoanToggle: (value: boolean) => void;
  onLoanChange: (patch: {
    loanStartMonth?: string;
    loanPrincipal?: number;
    loanRatePct?: number;
    loanTermYears?: number;
    loanMonthlyPayment?: number;
  }) => void;
}

export default function StepDecisions({
  showHome,
  showInvestment,
  homeEnabled,
  homePurchaseMonth,
  homePurchasePrice,
  homeDownPaymentPct,
  homeTermYears,
  homeRatePct,
  homeFees,
  homeHoldingCostMonthly,
  homeAppreciationPct,
  investmentEnabled,
  investmentMonthly,
  investmentReturnPct,
  investmentFeePct,
  investmentStartMonth,
  loanEnabled,
  loanStartMonth,
  loanPrincipal,
  loanRatePct,
  loanTermYears,
  loanMonthlyPayment,
  errors,
  onHomeToggle,
  onHomeChange,
  onInvestmentToggle,
  onInvestmentChange,
  onLoanToggle,
  onLoanChange,
}: StepDecisionsProps) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>重大決策</Title>
        <Text size="sm" c="dimmed">
          置業、投資與貸款會以 position 方式寫入，不會重複建立供款事件。
        </Text>
      </Stack>

      {showHome && (
        <Stack gap="md">
          <Switch
            label="準備買樓"
            checked={homeEnabled}
            onChange={(event) => onHomeToggle(event.currentTarget.checked)}
          />
          {homeEnabled && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput
                label="購買月份"
                type="month"
                value={homePurchaseMonth}
                onChange={(event) =>
                  onHomeChange({ homePurchaseMonth: event.currentTarget.value })
                }
                error={errors.homePurchaseMonth}
              />
              <NumberInput
                label="樓價"
                value={Number.isFinite(homePurchasePrice) ? homePurchasePrice : 0}
                onChange={(value) =>
                  onHomeChange({ homePurchasePrice: Number(value ?? 0) })
                }
                min={0}
                thousandSeparator=","
                error={errors.homePurchasePrice}
              />
              <NumberInput
                label="首期 %"
                value={Number.isFinite(homeDownPaymentPct) ? homeDownPaymentPct : 0}
                onChange={(value) =>
                  onHomeChange({ homeDownPaymentPct: Number(value ?? 0) })
                }
                min={0}
                max={100}
                error={errors.homeDownPaymentPct}
              />
              <NumberInput
                label="按揭年期"
                value={Number.isFinite(homeTermYears) ? homeTermYears : 0}
                onChange={(value) =>
                  onHomeChange({ homeTermYears: Number(value ?? 0) })
                }
                min={0}
                error={errors.homeTermYears}
              />
              <NumberInput
                label="利率 %"
                value={Number.isFinite(homeRatePct) ? homeRatePct : 0}
                onChange={(value) => onHomeChange({ homeRatePct: Number(value ?? 0) })}
                min={0}
                max={100}
                error={errors.homeRatePct}
              />
              <NumberInput
                label="一次性費用"
                value={Number.isFinite(homeFees) ? homeFees : 0}
                onChange={(value) => onHomeChange({ homeFees: Number(value ?? 0) })}
                min={0}
                thousandSeparator=","
                error={errors.homeFees}
              />
              <NumberInput
                label="每月持有成本"
                value={
                  Number.isFinite(homeHoldingCostMonthly)
                    ? homeHoldingCostMonthly
                    : 0
                }
                onChange={(value) =>
                  onHomeChange({ homeHoldingCostMonthly: Number(value ?? 0) })
                }
                min={0}
                thousandSeparator=","
                error={errors.homeHoldingCostMonthly}
              />
              <NumberInput
                label="年增值 %"
                value={Number.isFinite(homeAppreciationPct) ? homeAppreciationPct : 0}
                onChange={(value) =>
                  onHomeChange({ homeAppreciationPct: Number(value ?? 0) })
                }
                min={-100}
                max={100}
                error={errors.homeAppreciationPct}
              />
            </SimpleGrid>
          )}
        </Stack>
      )}

      {showInvestment && (
        <Stack gap="md">
          <Switch
            label="每月投資"
            checked={investmentEnabled}
            onChange={(event) => onInvestmentToggle(event.currentTarget.checked)}
          />
          {investmentEnabled && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput
                label="開始月份"
                type="month"
                value={investmentStartMonth}
                onChange={(event) =>
                  onInvestmentChange({ investmentStartMonth: event.currentTarget.value })
                }
                error={errors.investmentStartMonth}
              />
              <NumberInput
                label="每月投資額"
                value={Number.isFinite(investmentMonthly) ? investmentMonthly : 0}
                onChange={(value) =>
                  onInvestmentChange({ investmentMonthly: Number(value ?? 0) })
                }
                min={0}
                thousandSeparator=","
                error={errors.investmentMonthly}
              />
              <NumberInput
                label="預期年回報 %"
                value={Number.isFinite(investmentReturnPct) ? investmentReturnPct : 0}
                onChange={(value) =>
                  onInvestmentChange({ investmentReturnPct: Number(value ?? 0) })
                }
                min={-100}
                max={100}
                error={errors.investmentReturnPct}
              />
              <NumberInput
                label="年費率 %"
                value={investmentFeePct ?? ""}
                onChange={(value) =>
                  onInvestmentChange({
                    investmentFeePct:
                      typeof value === "number" && !Number.isNaN(value)
                        ? value
                        : undefined,
                  })
                }
                min={0}
                max={10}
                error={errors.investmentFeePct}
              />
            </SimpleGrid>
          )}
        </Stack>
      )}

      <Stack gap="md">
        <Switch
          label="有貸款"
          checked={loanEnabled}
          onChange={(event) => onLoanToggle(event.currentTarget.checked)}
        />
        {loanEnabled && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="開始月份"
              type="month"
              value={loanStartMonth}
              onChange={(event) =>
                onLoanChange({ loanStartMonth: event.currentTarget.value })
              }
              error={errors.loanStartMonth}
            />
            <NumberInput
              label="本金"
              value={Number.isFinite(loanPrincipal) ? loanPrincipal : 0}
              onChange={(value) => onLoanChange({ loanPrincipal: Number(value ?? 0) })}
              min={0}
              thousandSeparator=","
              error={errors.loanPrincipal}
            />
            <NumberInput
              label="利率 %"
              value={Number.isFinite(loanRatePct) ? loanRatePct : 0}
              onChange={(value) => onLoanChange({ loanRatePct: Number(value ?? 0) })}
              min={0}
              max={100}
              error={errors.loanRatePct}
            />
            <NumberInput
              label="年期"
              value={Number.isFinite(loanTermYears) ? loanTermYears : 0}
              onChange={(value) => onLoanChange({ loanTermYears: Number(value ?? 0) })}
              min={0}
              error={errors.loanTermYears}
            />
            <NumberInput
              label="每月供款（可選）"
              value={loanMonthlyPayment ?? ""}
              onChange={(value) =>
                onLoanChange({
                  loanMonthlyPayment:
                    typeof value === "number" && !Number.isNaN(value) ? value : undefined,
                })
              }
              min={0}
              thousandSeparator=","
              error={errors.loanMonthlyPayment}
            />
          </SimpleGrid>
        )}
      </Stack>
    </Stack>
  );
}
