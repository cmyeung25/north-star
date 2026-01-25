import {
  Accordion,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlanLabDraft } from "../../src/domain/planLab/types";
import type { EventDefinition } from "../../src/domain/events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { normalizeMonthInput, normalizeMonthStrict } from "../../src/utils/month";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import type { TimeSeriesPoint } from "../overview/types";

type ChartType = "netWorth" | "cash" | "netCashflow";

const defaultPurchasePrice = 8_000_000;
const defaultDownPaymentPct = 30;

type PlanLabPanelProps = {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  displayMode: "nominal" | "real";
  deflateSeries: (series: TimeSeriesPoint[]) => TimeSeriesPoint[];
  baselineSeries: {
    cash: TimeSeriesPoint[];
    netWorth: TimeSeriesPoint[];
    netCashflow: TimeSeriesPoint[];
  };
};

const mergeSeries = (
  baseline: TimeSeriesPoint[],
  option: TimeSeriesPoint[]
) => {
  const monthSet = new Set<string>();
  baseline.forEach((entry) => monthSet.add(entry.month));
  option.forEach((entry) => monthSet.add(entry.month));
  const months = Array.from(monthSet).sort();
  const baselineLookup = baseline.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.month] = entry.value;
    return acc;
  }, {});
  const optionLookup = option.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.month] = entry.value;
    return acc;
  }, {});
  return months.map((month) => ({
    month,
    baseline: baselineLookup[month] ?? null,
    option: optionLookup[month] ?? null,
  }));
};

const getMonthError = (value: string, message: string) => {
  const status = normalizeMonthInput(value);
  if (status.status === "invalid") {
    return message;
  }
  return undefined;
};

export default function PlanLabPanel({
  scenario,
  eventLibrary,
  members,
  budgetRules,
  displayMode,
  deflateSeries,
  baselineSeries,
}: PlanLabPanelProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const [panelValue, setPanelValue] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>("netWorth");
  const [housingMode, setHousingMode] = useState<"rent" | "rent-bigger" | "buy">(
    "rent"
  );
  const [rentStartMonth, setRentStartMonth] = useState(
    scenario.assumptions.baseMonth ?? ""
  );
  const [rentMonthly, setRentMonthly] = useState<number | "">(
    scenario.assumptions.rentMonthly ?? ""
  );
  const [purchaseMonth, setPurchaseMonth] = useState(
    scenario.assumptions.baseMonth ?? ""
  );
  const [purchasePrice, setPurchasePrice] = useState<number | "">(
    defaultPurchasePrice
  );
  const [downPaymentPct, setDownPaymentPct] = useState<number | "">(
    defaultDownPaymentPct
  );
  const [downPaymentAmount, setDownPaymentAmount] = useState<number | "">(() => {
    const price =
      typeof purchasePrice === "number" ? purchasePrice : defaultPurchasePrice;
    return Math.round((price * defaultDownPaymentPct) / 100);
  });
  const [mortgageRatePct, setMortgageRatePct] = useState<number | "">(
    scenario.assumptions.mortgageRatePct ?? 2.5
  );
  const [termYears, setTermYears] = useState<number | "">(
    scenario.assumptions.mortgageTermYears ?? 30
  );
  const [babyDueMonth, setBabyDueMonth] = useState("");
  const [babyMonthlyBudget, setBabyMonthlyBudget] = useState<number | "">("");
  const [babyOneOffCost, setBabyOneOffCost] = useState<number | "">("");
  const [buyPanelOpen, setBuyPanelOpen] = useState(false);

  const isOpen = panelValue === "plan-lab";

  const monthInvalidMessage = t("planLabMonthInvalid");
  const rentStartMonthError = getMonthError(rentStartMonth, monthInvalidMessage);
  const purchaseMonthError = getMonthError(purchaseMonth, monthInvalidMessage);
  const babyDueMonthError = getMonthError(babyDueMonth, monthInvalidMessage);

  const { draft, hasInvalidMonths } = useMemo(() => {
    const invalid =
      (rentStartMonth &&
        !normalizeMonthStrict(rentStartMonth).ok) ||
      (purchaseMonth && !normalizeMonthStrict(purchaseMonth).ok) ||
      (babyDueMonth && !normalizeMonthStrict(babyDueMonth).ok);

    if (invalid) {
      return { draft: null, hasInvalidMonths: true };
    }

    const planLabDraft: PlanLabDraft = {};

    if (housingMode === "rent" || housingMode === "rent-bigger") {
      const normalized = rentStartMonth
        ? normalizeMonthStrict(rentStartMonth)
        : null;
      planLabDraft.housing = {
        kind: "rent",
        startMonth: normalized?.ok ? normalized.month : undefined,
        monthlyRent:
          typeof rentMonthly === "number" ? rentMonthly : undefined,
        annualRentGrowthPct: scenario.assumptions.rentAnnualGrowthPct ?? undefined,
      };
    }

    if (housingMode === "buy") {
      const normalized = purchaseMonth
        ? normalizeMonthStrict(purchaseMonth)
        : null;
      planLabDraft.housing = {
        kind: "buy",
        purchaseMonth: normalized?.ok ? normalized.month : undefined,
        purchasePrice:
          typeof purchasePrice === "number" ? purchasePrice : undefined,
        downPaymentAmount:
          typeof downPaymentAmount === "number" ? downPaymentAmount : undefined,
        downPaymentPct:
          typeof downPaymentPct === "number" ? downPaymentPct : undefined,
        mortgageRatePct:
          typeof mortgageRatePct === "number" ? mortgageRatePct : undefined,
        termYears: typeof termYears === "number" ? termYears : undefined,
      };
    }

    if (babyDueMonth || typeof babyMonthlyBudget === "number" || typeof babyOneOffCost === "number") {
      const normalized = babyDueMonth
        ? normalizeMonthStrict(babyDueMonth)
        : null;
      planLabDraft.babyPlan = {
        targetMonth: normalized?.ok ? normalized.month : undefined,
        monthlyBabyBudget:
          typeof babyMonthlyBudget === "number" ? babyMonthlyBudget : undefined,
        oneOffBabyCost:
          typeof babyOneOffCost === "number" ? babyOneOffCost : undefined,
      };
    }

    return { draft: planLabDraft, hasInvalidMonths: false };
  }, [
    babyDueMonth,
    babyMonthlyBudget,
    babyOneOffCost,
    downPaymentAmount,
    downPaymentPct,
    housingMode,
    mortgageRatePct,
    purchaseMonth,
    purchasePrice,
    rentMonthly,
    rentStartMonth,
    scenario.assumptions.rentAnnualGrowthPct,
    termYears,
  ]);

  const planLabProjection = usePlanLabProjectionWithLedger(
    isOpen && !hasInvalidMonths ? draft : null,
    isOpen ? scenario : null,
    eventLibrary,
    { members, budgetRules }
  );

  const optionViewModel = useMemo(
    () =>
      planLabProjection.projection
        ? projectionToOverviewViewModel(planLabProjection.projection)
        : null,
    [planLabProjection.projection]
  );

  const optionSeries = useMemo(() => {
    if (!optionViewModel) {
      return {
        cash: [],
        netWorth: [],
        netCashflow: [],
      };
    }
    const base = {
      cash: optionViewModel.cashSeries ?? [],
      netWorth: optionViewModel.netWorthSeries ?? [],
      netCashflow: optionViewModel.netCashflowSeries ?? [],
    };
    if (displayMode === "real") {
      return {
        cash: deflateSeries(base.cash),
        netWorth: deflateSeries(base.netWorth),
        netCashflow: deflateSeries(base.netCashflow),
      };
    }
    return base;
  }, [deflateSeries, displayMode, optionViewModel]);

  const chartData = useMemo(() => {
    const baseline =
      chartType === "cash"
        ? baselineSeries.cash
        : chartType === "netCashflow"
          ? baselineSeries.netCashflow
          : baselineSeries.netWorth;
    const option =
      chartType === "cash"
        ? optionSeries.cash
        : chartType === "netCashflow"
          ? optionSeries.netCashflow
          : optionSeries.netWorth;
    return mergeSeries(baseline, option);
  }, [baselineSeries, chartType, optionSeries]);

  const planLabEnabled = isOpen && !hasInvalidMonths;

  return (
    <Card withBorder radius="md" padding="md">
      <Accordion value={panelValue} onChange={setPanelValue}>
        <Accordion.Item value="plan-lab">
          <Accordion.Control>
            <Group justify="space-between" align="center" wrap="wrap">
              <Stack gap={2}>
                <Group gap="xs" align="center">
                  <Title order={4}>{t("planLabTitle")}</Title>
                  <Badge color="blue" variant="light">
                    {t("planLabPreviewBadge")}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {t("planLabSubtitle")}
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="light"
                disabled
                title={t("planLabSaveDisabled")}
              >
                {t("planLabSave")}
              </Button>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                {t("planLabPreviewNotice")}
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Stack gap="sm">
                  <Text fw={600}>{t("planLabHousingTitle")}</Text>
                  <SegmentedControl
                    data={[
                      { value: "rent", label: t("planLabHousingRent") },
                      { value: "rent-bigger", label: t("planLabHousingRentBigger") },
                      { value: "buy", label: t("planLabHousingBuy") },
                    ]}
                    value={housingMode}
                    onChange={(value) => {
                      const nextMode = value as "rent" | "rent-bigger" | "buy";
                      setHousingMode(nextMode);
                      if (nextMode === "rent") {
                        setRentMonthly(
                          scenario.assumptions.rentMonthly ?? ""
                        );
                      }
                      if (nextMode === "rent-bigger") {
                        const baseline = scenario.assumptions.rentMonthly ?? 0;
                        setRentMonthly(Math.round(baseline * 1.3));
                      }
                    }}
                  />
                  {(housingMode === "rent" || housingMode === "rent-bigger") && (
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                      <TextInput
                        label={t("planLabRentStartMonth")}
                        placeholder="YYYY-MM"
                        value={rentStartMonth}
                        onChange={(event) => setRentStartMonth(event.currentTarget.value)}
                        error={rentStartMonthError}
                      />
                      <NumberInput
                        label={t("planLabRentMonthly")}
                        value={rentMonthly}
                        min={0}
                        onChange={(value) =>
                          setRentMonthly(typeof value === "number" ? value : "")
                        }
                      />
                    </SimpleGrid>
                  )}
                  {housingMode === "buy" && (
                    <Stack gap="sm">
                      <Button
                        size="xs"
                        variant={buyPanelOpen ? "filled" : "light"}
                        onClick={() => setBuyPanelOpen((current) => !current)}
                      >
                        {buyPanelOpen
                          ? t("planLabBuyHideDetails")
                          : t("planLabBuyShowDetails")}
                      </Button>
                      {buyPanelOpen && (
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                          <TextInput
                            label={t("planLabPurchaseMonth")}
                            placeholder="YYYY-MM"
                            value={purchaseMonth}
                            onChange={(event) =>
                              setPurchaseMonth(event.currentTarget.value)
                            }
                            error={purchaseMonthError}
                          />
                          <NumberInput
                            label={t("planLabPurchasePrice")}
                            value={purchasePrice}
                            min={0}
                            onChange={(value) =>
                              setPurchasePrice(typeof value === "number" ? value : "")
                            }
                          />
                          <NumberInput
                            label={t("planLabDownPaymentAmount")}
                            value={downPaymentAmount}
                            min={0}
                            onChange={(value) => {
                              const amount = typeof value === "number" ? value : "";
                              setDownPaymentAmount(amount);
                              if (typeof amount === "number" && typeof purchasePrice === "number") {
                                setDownPaymentPct(
                                  purchasePrice > 0
                                    ? Number(((amount / purchasePrice) * 100).toFixed(2))
                                    : 0
                                );
                              }
                            }}
                          />
                          <NumberInput
                            label={t("planLabDownPaymentPct")}
                            value={downPaymentPct}
                            min={0}
                            max={100}
                            decimalScale={2}
                            onChange={(value) => {
                              const pct = typeof value === "number" ? value : "";
                              setDownPaymentPct(pct);
                              if (typeof pct === "number" && typeof purchasePrice === "number") {
                                setDownPaymentAmount(
                                  Math.round((purchasePrice * pct) / 100)
                                );
                              }
                            }}
                          />
                          <NumberInput
                            label={t("planLabMortgageRate")}
                            value={mortgageRatePct}
                            min={0}
                            decimalScale={2}
                            onChange={(value) =>
                              setMortgageRatePct(typeof value === "number" ? value : "")
                            }
                          />
                          <NumberInput
                            label={t("planLabMortgageTerm")}
                            value={termYears}
                            min={0}
                            onChange={(value) =>
                              setTermYears(typeof value === "number" ? value : "")
                            }
                          />
                        </SimpleGrid>
                      )}
                    </Stack>
                  )}
                </Stack>

                <Stack gap="sm">
                  <Text fw={600}>{t("planLabBabyTitle")}</Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                    <TextInput
                      label={t("planLabBabyDueMonth")}
                      placeholder="YYYY-MM"
                      value={babyDueMonth}
                      onChange={(event) => setBabyDueMonth(event.currentTarget.value)}
                      error={babyDueMonthError}
                    />
                    <NumberInput
                      label={t("planLabBabyMonthlyBudget")}
                      value={babyMonthlyBudget}
                      min={0}
                      onChange={(value) =>
                        setBabyMonthlyBudget(typeof value === "number" ? value : "")
                      }
                    />
                    <NumberInput
                      label={t("planLabBabyOneOffCost")}
                      value={babyOneOffCost}
                      min={0}
                      onChange={(value) =>
                        setBabyOneOffCost(typeof value === "number" ? value : "")
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </SimpleGrid>

              <Divider />

              <Stack gap="sm">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Text fw={600}>{t("planLabPreviewTitle")}</Text>
                  <SegmentedControl
                    size="xs"
                    data={[
                      { value: "netWorth", label: t("planLabChartNetWorth") },
                      { value: "cash", label: t("planLabChartCash") },
                      { value: "netCashflow", label: t("planLabChartNetCashflow") },
                    ]}
                    value={chartType}
                    onChange={(value) => setChartType(value as ChartType)}
                  />
                </Group>
                {!planLabEnabled && (
                  <Text size="sm" c="dimmed">
                    {t("planLabPreviewDisabled")}
                  </Text>
                )}
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ left: 8, right: 12 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        width={72}
                        tickFormatter={(value) =>
                          formatCurrency(Number(value), undefined, locale)
                        }
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(Number(value), undefined, locale)
                        }
                        labelFormatter={(label) =>
                          t("monthLabel", { month: label })
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        stroke="#228be6"
                        strokeWidth={2}
                        dot={false}
                        name={t("planLabBaselineLabel")}
                      />
                      <Line
                        type="monotone"
                        dataKey="option"
                        stroke="#12b886"
                        strokeWidth={2}
                        dot={false}
                        name={t("planLabOptionLabel")}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Stack>

              <Divider />

              <Stack gap="xs">
                <Text fw={600}>{t("planLabWarningsTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("planLabWarningsPlaceholder")}
                </Text>
              </Stack>
              <Text size="xs" c="dimmed">
                {t("planLabSaveHint")}
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}
