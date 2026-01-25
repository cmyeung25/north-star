"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Stepper,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatCurrency } from "../../../lib/i18n";
import { projectionToOverviewViewModel } from "../../engine/adapter";
import { useOnboardingDraftProjectionWithLedger } from "../../engine/useOnboardingDraftProjectionWithLedger";
import {
  type OnboardingDraft,
  type OnboardingDraftMember,
} from "../../domain/onboardingDraft/types";
import { getCurrentMonth } from "./utils";
import { normalizeMonthStrict } from "../../utils/month";
import {
  getActiveScenario,
  useScenarioStore,
} from "../../store/scenarioStore";
import { buildScenarioUrl } from "../../utils/scenarioContext";
import type { TimeSeriesPoint } from "../../../features/overview/types";

const steps = ["members", "totals", "microPlan", "preview"] as const;

// type StepKey = (typeof steps)[number];

const mergeSeries = (baseline: TimeSeriesPoint[], option: TimeSeriesPoint[]) => {
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

const normalizeNumber = (value: number | "", fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

export default function OnboardingDraftWizard() {
  const t = useTranslations("onboardingDraft");
  const locale = useLocale();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const scenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );
  const [step, setStep] = useState(0);
  const [includePartner, setIncludePartner] = useState(false);
  const [primaryMember, setPrimaryMember] = useState<OnboardingDraftMember>(() => ({
    id: nanoid(),
    name: "",
    ageAtBaseMonth: undefined,
  }));
  const [partnerMember, setPartnerMember] = useState<OnboardingDraftMember>(() => ({
    id: nanoid(),
    name: "",
    ageAtBaseMonth: undefined,
  }));
  const [monthlyIncomeTotal, setMonthlyIncomeTotal] = useState<number | "">(0);
  const [monthlyExpenseTotal, setMonthlyExpenseTotal] = useState<number | "">(0);
  const [initialCash, setInitialCash] = useState<number | "">("");
  const [planKind, setPlanKind] = useState<"housing" | "baby">("housing");
  const [housingKind, setHousingKind] = useState<"rent" | "buy">("rent");
  const [rentStartMonth, setRentStartMonth] = useState("");
  const [rentMonthly, setRentMonthly] = useState<number | "">("");
  const [purchaseMonth, setPurchaseMonth] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<number | "">("");
  const [downPaymentPct, setDownPaymentPct] = useState<number | "">(30);
  const [mortgageRatePct, setMortgageRatePct] = useState<number | "">(3.5);
  const [termYears, setTermYears] = useState<number | "">(30);
  const [babyDueMonth, setBabyDueMonth] = useState("");
  const [babyMonthlyBudget, setBabyMonthlyBudget] = useState<number | "">("");
  const [babyOneOffCost, setBabyOneOffCost] = useState<number | "">("");

  const resolvedBaseMonth = useMemo(() => {
    const raw = appSettings.globalBaseMonth ?? getCurrentMonth();
    const normalized = normalizeMonthStrict(raw);
    return normalized.ok ? normalized.month : getCurrentMonth();
  }, [appSettings.globalBaseMonth]);

  const draft = useMemo<OnboardingDraft>(
    () => ({
      members: includePartner ? [primaryMember, partnerMember] : [primaryMember],
      baseline: {
        monthlyIncomeTotal: normalizeNumber(monthlyIncomeTotal),
        monthlyExpenseTotal: normalizeNumber(monthlyExpenseTotal),
        initialCash:
          typeof initialCash === "number" && Number.isFinite(initialCash)
            ? initialCash
            : undefined,
      },
      microPlan:
        planKind === "housing"
          ? {
              kind: "housing",
              housing:
                housingKind === "rent"
                  ? {
                      kind: "rent",
                      startMonth: rentStartMonth || undefined,
                      monthlyRent:
                        typeof rentMonthly === "number" ? rentMonthly : undefined,
                    }
                  : {
                      kind: "buy",
                      purchaseMonth: purchaseMonth || undefined,
                      purchasePrice:
                        typeof purchasePrice === "number" ? purchasePrice : undefined,
                      downPaymentPct:
                        typeof downPaymentPct === "number" ? downPaymentPct : undefined,
                      mortgageRatePct:
                        typeof mortgageRatePct === "number" ? mortgageRatePct : undefined,
                      termYears: typeof termYears === "number" ? termYears : undefined,
                    },
            }
          : {
              kind: "baby",
              baby: {
                dueMonth: babyDueMonth || undefined,
                monthlyBudget:
                  typeof babyMonthlyBudget === "number"
                    ? babyMonthlyBudget
                    : undefined,
                oneOffCost:
                  typeof babyOneOffCost === "number" ? babyOneOffCost : undefined,
              },
            },
    }),
    [
      babyDueMonth,
      babyMonthlyBudget,
      babyOneOffCost,
      downPaymentPct,
      housingKind,
      includePartner,
      initialCash,
      monthlyExpenseTotal,
      monthlyIncomeTotal,
      mortgageRatePct,
      partnerMember,
      planKind,
      primaryMember,
      purchaseMonth,
      purchasePrice,
      rentMonthly,
      rentStartMonth,
      termYears,
    ]
  );

  const { baseline, option, errors } = useOnboardingDraftProjectionWithLedger(draft, {
    baseMonth: resolvedBaseMonth,
    horizonMonths: appSettings.globalHorizonMonths,
  });

  const errorMap = useMemo(() => {
    return errors.reduce<Record<string, string>>((acc, error) => {
      if (error.reason === "invalid-month") {
        acc[error.field] = t("monthInvalid");
      }
      return acc;
    }, {});
  }, [errors, t]);

  const baselineSeries = useMemo(() => {
    if (!baseline.projection) {
      return [];
    }
    return projectionToOverviewViewModel(baseline.projection).netWorthSeries;
  }, [baseline.projection]);

  const optionSeries = useMemo(() => {
    if (!option.projection) {
      return [];
    }
    return projectionToOverviewViewModel(option.projection).netWorthSeries;
  }, [option.projection]);

  const chartSeries = useMemo(
    () => mergeSeries(baselineSeries, optionSeries),
    [baselineSeries, optionSeries]
  );

  const scenarioId = scenario?.id ?? "";
  const currency = scenario?.baseCurrency;

  const handleNext = () => {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const hasOption = optionSeries.length > 0;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text size="sm" c="dimmed">
          {t("subtitle")}
        </Text>
        <Group justify="space-between" wrap="wrap">
          <Text size="xs" c="dimmed">
            {t("baseMonthLabel", { month: resolvedBaseMonth })}
          </Text>
          <Badge color="orange" variant="light">
            {t("previewBadge")}
          </Badge>
        </Group>
      </Stack>

      <Stepper active={step} onStepClick={setStep}>
        {steps.map((key) => (
          <Stepper.Step key={key} label={t(`step.${key}`)} />
        ))}
      </Stepper>

      {step === 0 && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Title order={4}>{t("membersTitle")}</Title>
            <Text size="sm" c="dimmed">
              {t("membersHint")}
            </Text>
            <Stack gap="sm">
              <Text fw={500}>{t("memberPrimary")}</Text>
              <TextInput
                label={t("memberName")}
                placeholder={t("memberNamePlaceholder")}
                value={primaryMember.name ?? ""}
                onChange={(event) =>
                  setPrimaryMember((current) => ({
                    ...current,
                    name: event.currentTarget.value,
                  }))
                }
              />
              <NumberInput
                label={t("memberAge")}
                value={primaryMember.ageAtBaseMonth ?? ""}
                min={0}
                onChange={(value) =>
                  setPrimaryMember((current) => ({
                    ...current,
                    ageAtBaseMonth: typeof value === "number" ? value : undefined,
                  }))
                }
              />
            </Stack>
            <Divider />
            <Switch
              label={t("includePartner")}
              checked={includePartner}
              onChange={(event) => setIncludePartner(event.currentTarget.checked)}
            />
            {includePartner && (
              <Stack gap="sm">
                <Text fw={500}>{t("memberPartner")}</Text>
                <TextInput
                  label={t("memberName")}
                  placeholder={t("memberNamePlaceholder")}
                  value={partnerMember.name ?? ""}
                  onChange={(event) =>
                    setPartnerMember((current) => ({
                      ...current,
                      name: event.currentTarget.value,
                    }))
                  }
                />
                <NumberInput
                  label={t("memberAge")}
                  value={partnerMember.ageAtBaseMonth ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPartnerMember((current) => ({
                      ...current,
                      ageAtBaseMonth: typeof value === "number" ? value : undefined,
                    }))
                  }
                />
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {step === 1 && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Title order={4}>{t("totalsTitle")}</Title>
            <Text size="sm" c="dimmed">
              {t("totalsHint")}
            </Text>
            <NumberInput
              label={t("monthlyIncome")}
              min={0}
              value={monthlyIncomeTotal}
              onChange={setMonthlyIncomeTotal}
            />
            <NumberInput
              label={t("monthlyExpenses")}
              min={0}
              value={monthlyExpenseTotal}
              onChange={setMonthlyExpenseTotal}
            />
            <NumberInput
              label={t("initialCash")}
              min={0}
              value={initialCash}
              onChange={setInitialCash}
            />
          </Stack>
        </Card>
      )}

      {step === 2 && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Title order={4}>{t("microPlanTitle")}</Title>
            <Text size="sm" c="dimmed">
              {t("microPlanHint")}
            </Text>
            <SegmentedControl
              value={planKind}
              onChange={(value) => setPlanKind(value as "housing" | "baby")}
              data={[
                { label: t("microPlanHousing"), value: "housing" },
                { label: t("microPlanBaby"), value: "baby" },
              ]}
            />

            {planKind === "housing" && (
              <Stack gap="sm">
                <SegmentedControl
                  value={housingKind}
                  onChange={(value) => setHousingKind(value as "rent" | "buy")}
                  data={[
                    { label: t("housingRent"), value: "rent" },
                    { label: t("housingBuy"), value: "buy" },
                  ]}
                />
                {housingKind === "rent" ? (
                  <Stack gap="sm">
                    <TextInput
                      label={t("rentStartMonth")}
                      placeholder={t("monthPlaceholder")}
                      value={rentStartMonth}
                      error={errorMap["housing.startMonth"]}
                      onChange={(event) => setRentStartMonth(event.currentTarget.value)}
                    />
                    <NumberInput
                      label={t("rentMonthly")}
                      min={0}
                      value={rentMonthly}
                      onChange={setRentMonthly}
                    />
                  </Stack>
                ) : (
                  <Stack gap="sm">
                    <TextInput
                      label={t("purchaseMonth")}
                      placeholder={t("monthPlaceholder")}
                      value={purchaseMonth}
                      error={errorMap["housing.purchaseMonth"]}
                      onChange={(event) => setPurchaseMonth(event.currentTarget.value)}
                    />
                    <NumberInput
                      label={t("purchasePrice")}
                      min={0}
                      value={purchasePrice}
                      onChange={setPurchasePrice}
                    />
                    <NumberInput
                      label={t("downPaymentPct")}
                      min={0}
                      max={100}
                      value={downPaymentPct}
                      onChange={setDownPaymentPct}
                    />
                    <NumberInput
                      label={t("mortgageRatePct")}
                      min={0}
                      max={100}
                      value={mortgageRatePct}
                      onChange={setMortgageRatePct}
                    />
                    <NumberInput
                      label={t("mortgageTermYears")}
                      min={1}
                      value={termYears}
                      onChange={setTermYears}
                    />
                  </Stack>
                )}
              </Stack>
            )}

            {planKind === "baby" && (
              <Stack gap="sm">
                <TextInput
                  label={t("babyDueMonth")}
                  placeholder={t("monthPlaceholder")}
                  value={babyDueMonth}
                  error={errorMap["baby.dueMonth"]}
                  onChange={(event) => setBabyDueMonth(event.currentTarget.value)}
                />
                <NumberInput
                  label={t("babyMonthlyBudget")}
                  min={0}
                  value={babyMonthlyBudget}
                  onChange={setBabyMonthlyBudget}
                />
                <NumberInput
                  label={t("babyOneOff")}
                  min={0}
                  value={babyOneOffCost}
                  onChange={setBabyOneOffCost}
                />
              </Stack>
            )}

            {errors.length > 0 && (
              <Text size="sm" c="red">
                {t("monthInvalidHint")}
              </Text>
            )}
          </Stack>
        </Card>
      )}

      {step === 3 && (
        <Stack gap="md">
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={4}>{t("previewTitle")}</Title>
                <Badge color="orange" variant="light">
                  {t("previewOnly")}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {t("previewHint")}
              </Text>
              {chartSeries.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("previewEmpty")}
                </Text>
              ) : (
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartSeries} margin={{ left: 8, right: 16 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        width={80}
                        tickFormatter={(value) =>
                          formatCurrency(Number(value), currency, locale)
                        }
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(Number(value), currency, locale)
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        stroke="#4c6ef5"
                        strokeWidth={2}
                        dot={false}
                        name={t("previewBaselineLabel")}
                      />
                      {hasOption && (
                        <Line
                          type="monotone"
                          dataKey="option"
                          stroke="#12b886"
                          strokeWidth={2}
                          dot={false}
                          name={t("previewOptionLabel")}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {errors.length > 0 && (
                <Text size="sm" c="red">
                  {t("previewErrors")}
                </Text>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Title order={5}>{t("nextStepsTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("nextStepsHint")}
              </Text>
              <Group align="center" wrap="wrap">
                <Button
                  component={Link}
                  href={scenarioId ? buildScenarioUrl("/money", scenarioId) : "/money"}
                  variant="light"
                >
                  {t("nextMoney")}
                </Button>
                <Button
                  component={Link}
                  href={scenarioId ? buildScenarioUrl("/people", scenarioId) : "/people"}
                  variant="light"
                >
                  {t("nextPeople")}
                </Button>
                <Button
                  component={Link}
                  href={scenarioId ? buildScenarioUrl("/overview", scenarioId) : "/overview"}
                  variant="light"
                >
                  {t("nextPlanLab")}
                </Button>
              </Group>
              <Divider />
              <Button disabled variant="default">
                {t("saveDisabled")}
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}

      <Group justify="space-between">
        <Button variant="default" onClick={handleBack} disabled={step === 0}>
          {t("back")}
        </Button>
        <Button onClick={handleNext} disabled={step === steps.length - 1}>
          {t("next")}
        </Button>
      </Group>
    </Stack>
  );
}
