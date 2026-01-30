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
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { mapOnboardingDraftToStoreItems } from "../../domain/onboarding/mapOnboardingDraftToStoreItems";
import WarningsPanel from "../../../components/WarningsPanel";
import OnboardingV2WizardShell from "./v2/OnboardingV2WizardShell";

const steps = ["members", "totals", "microPlan", "preview", "result"] as const;

const DRAFT_STORAGE_KEY = "onboarding:v2:draft";

type DraftStorageState = {
  step: number;
  includePartner: boolean;
  primaryMember: OnboardingDraftMember;
  partnerMember: OnboardingDraftMember;
  monthlyIncomeTotal: number | "";
  monthlyExpenseTotal: number | "";
  initialCash: number | "";
  planKind: "housing" | "baby";
  housingKind: "rent" | "buy";
  rentStartMonth: string;
  rentMonthly: number | "";
  purchaseMonth: string;
  purchasePrice: number | "";
  downPaymentPct: number | "";
  mortgageRatePct: number | "";
  termYears: number | "";
  babyDueMonth: string;
  babyMonthlyBudget: number | "";
  babyOneOffCost: number | "";
};

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

const buildEmptyMember = () => ({
  id: nanoid(),
  name: "",
  ageAtBaseMonth: undefined,
});

const getInitialDraftState = (): DraftStorageState => {
  const fallback: DraftStorageState = {
    step: 0,
    includePartner: false,
    primaryMember: buildEmptyMember(),
    partnerMember: buildEmptyMember(),
    monthlyIncomeTotal: 0,
    monthlyExpenseTotal: 0,
    initialCash: "",
    planKind: "housing",
    housingKind: "rent",
    rentStartMonth: "",
    rentMonthly: "",
    purchaseMonth: "",
    purchasePrice: "",
    downPaymentPct: 30,
    mortgageRatePct: 3.5,
    termYears: 30,
    babyDueMonth: "",
    babyMonthlyBudget: "",
    babyOneOffCost: "",
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    const parsed = JSON.parse(stored) as Partial<DraftStorageState>;
    return {
      ...fallback,
      ...parsed,
      primaryMember: {
        ...fallback.primaryMember,
        ...parsed.primaryMember,
        id: parsed.primaryMember?.id ?? fallback.primaryMember.id,
      },
      partnerMember: {
        ...fallback.partnerMember,
        ...parsed.partnerMember,
        id: parsed.partnerMember?.id ?? fallback.partnerMember.id,
      },
    };
  } catch (error) {
    console.warn("Failed to parse onboarding draft state", error);
    return fallback;
  }
};

export default function OnboardingDraftWizard() {
  const t = useTranslations("onboardingDraft");
  const locale = useLocale();
  const router = useRouter();
  const initialState = useMemo(() => getInitialDraftState(), []);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const membersStore = useScenarioStore((state) => state.members);
  const budgetRulesStore = useScenarioStore((state) => state.budgetRules);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const updateScenarioClientComputed = useScenarioStore(
    (state) => state.updateScenarioClientComputed
  );
  const updateScenarioMeta = useScenarioStore((state) => state.updateScenarioMeta);
  const upsertEventDefinition = useScenarioStore((state) => state.upsertEventDefinition);
  const upsertScenarioEventRef = useScenarioStore(
    (state) => state.upsertScenarioEventRef
  );
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore((state) => state.updateHomePosition);
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);
  const scenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );
  const [step, setStep] = useState(initialState.step);
  const [includePartner, setIncludePartner] = useState(
    initialState.includePartner
  );
  const [primaryMember, setPrimaryMember] = useState<OnboardingDraftMember>(
    initialState.primaryMember
  );
  const [partnerMember, setPartnerMember] = useState<OnboardingDraftMember>(
    initialState.partnerMember
  );
  const [monthlyIncomeTotal, setMonthlyIncomeTotal] = useState<number | "">(
    initialState.monthlyIncomeTotal
  );
  const [monthlyExpenseTotal, setMonthlyExpenseTotal] = useState<number | "">(
    initialState.monthlyExpenseTotal
  );
  const [initialCash, setInitialCash] = useState<number | "">(
    initialState.initialCash
  );
  const [planKind, setPlanKind] = useState<"housing" | "baby">(
    initialState.planKind
  );
  const [housingKind, setHousingKind] = useState<"rent" | "buy">(
    initialState.housingKind
  );
  const [rentStartMonth, setRentStartMonth] = useState(
    initialState.rentStartMonth
  );
  const [rentMonthly, setRentMonthly] = useState<number | "">(
    initialState.rentMonthly
  );
  const [purchaseMonth, setPurchaseMonth] = useState(
    initialState.purchaseMonth
  );
  const [purchasePrice, setPurchasePrice] = useState<number | "">(
    initialState.purchasePrice
  );
  const [downPaymentPct, setDownPaymentPct] = useState<number | "">(
    initialState.downPaymentPct
  );
  const [mortgageRatePct, setMortgageRatePct] = useState<number | "">(
    initialState.mortgageRatePct
  );
  const [termYears, setTermYears] = useState<number | "">(
    initialState.termYears
  );
  const [babyDueMonth, setBabyDueMonth] = useState(initialState.babyDueMonth);
  const [babyMonthlyBudget, setBabyMonthlyBudget] = useState<number | "">(
    initialState.babyMonthlyBudget
  );
  const [babyOneOffCost, setBabyOneOffCost] = useState<number | "">(
    initialState.babyOneOffCost
  );
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload: DraftStorageState = {
      step,
      includePartner,
      primaryMember,
      partnerMember,
      monthlyIncomeTotal,
      monthlyExpenseTotal,
      initialCash,
      planKind,
      housingKind,
      rentStartMonth,
      rentMonthly,
      purchaseMonth,
      purchasePrice,
      downPaymentPct,
      mortgageRatePct,
      termYears,
      babyDueMonth,
      babyMonthlyBudget,
      babyOneOffCost,
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [
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
    step,
    termYears,
  ]);

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

  const { baseline, option, errors, warnings } = useOnboardingDraftProjectionWithLedger(draft, {
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
  const planLabLink = useMemo(
    () => (scenarioId ? buildScenarioUrl("/plan-lab", scenarioId) : "/plan-lab"),
    [scenarioId]
  );

  const handleNext = () => {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const hasOption = optionSeries.length > 0;

  const handleSave = () => {
    if (!scenarioId) {
      return;
    }
    const mapping = mapOnboardingDraftToStoreItems({
      draft,
      baseMonth: resolvedBaseMonth,
      scenarioId,
      members: membersStore,
    });
    const nextErrors = mapping.errors.map((error) => error.message);
    setSaveErrors(nextErrors);
    const hasNonBlockingErrors = mapping.errors.length > 0;
    if (mapping.errors.some((error) => error.blocking)) {
      return;
    }

    mapping.globalChanges.members.forEach((member) => {
      const existing = membersStore.find((entry) => entry.id === member.id);
      if (existing) {
        updateMember(member.id, member);
      } else {
        createMember(member);
      }
    });

    mapping.globalChanges.budgetRules.forEach((rule) => {
      const existing = budgetRulesStore.find((entry) => entry.id === rule.id);
      if (existing) {
        updateBudgetRule(rule.id, rule);
      } else {
        createBudgetRule(rule);
      }
    });

    mapping.scenarioChanges.eventDefinitions.forEach((definition) => {
      upsertEventDefinition(definition);
      upsertScenarioEventRef(scenarioId, { refId: definition.id, enabled: true });
    });

    mapping.scenarioChanges.homePositions.forEach((home) => {
      const exists = scenario?.positions?.homes?.some((entry) => entry.id === home.id);
      if (exists) {
        updateHomePosition(scenarioId, home);
      } else {
        addHomePosition(scenarioId, home);
      }
    });

    if (mapping.scenarioChanges.initialCash !== undefined) {
      updateScenarioAssumptions(scenarioId, {
        initialCash: mapping.scenarioChanges.initialCash,
      });
    }

    updateScenarioMeta(scenarioId, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    const onboardingFlags = `&onboardingPlaceholders=1${
      hasNonBlockingErrors ? "&onboardingSkipped=1" : ""
    }`;
    router.push(
      `/${locale}${buildScenarioUrl("/money", scenarioId)}${onboardingFlags}`
    );
  };

  const handleLater = () => {
    if (!scenarioId) {
      return;
    }
    updateScenarioMeta(scenarioId, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    router.push(`/${locale}${buildScenarioUrl("/dashboard", scenarioId)}`);
  };

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

      <OnboardingV2WizardShell
        activeStep={step}
        onStepChange={setStep}
        steps={[
          {
            id: "members",
            title: t("step.members"),
            content: (
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
                          ageAtBaseMonth:
                            typeof value === "number" ? value : undefined,
                        }))
                      }
                    />
                  </Stack>
                  <Divider />
                  <Switch
                    label={t("includePartner")}
                    checked={includePartner}
                    onChange={(event) =>
                      setIncludePartner(event.currentTarget.checked)
                    }
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
                            ageAtBaseMonth:
                              typeof value === "number" ? value : undefined,
                          }))
                        }
                      />
                    </Stack>
                  )}
                </Stack>
              </Card>
            ),
          },
          {
            id: "totals",
            title: t("step.totals"),
            content: (
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
                    onChange={(value) =>
                      setMonthlyIncomeTotal(
                        typeof value === "number" ? value : ""
                      )
                    }
                  />
                  <NumberInput
                    label={t("monthlyExpenses")}
                    min={0}
                    value={monthlyExpenseTotal}
                    onChange={(value) =>
                      setMonthlyExpenseTotal(
                        typeof value === "number" ? value : ""
                      )
                    }
                  />
                  <NumberInput
                    label={t("initialCash")}
                    min={0}
                    value={initialCash}
                    onChange={(value) =>
                      setInitialCash(typeof value === "number" ? value : "")
                    }
                  />
                </Stack>
              </Card>
            ),
          },
          {
            id: "microPlan",
            title: t("step.microPlan"),
            content: (
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
                        onChange={(value) =>
                          setHousingKind(value as "rent" | "buy")
                        }
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
                            onChange={(event) =>
                              setRentStartMonth(event.currentTarget.value)
                            }
                          />
                          <NumberInput
                            label={t("rentMonthly")}
                            min={0}
                            value={rentMonthly}
                            onChange={(value) =>
                              setRentMonthly(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                        </Stack>
                      ) : (
                        <Stack gap="sm">
                          <TextInput
                            label={t("purchaseMonth")}
                            placeholder={t("monthPlaceholder")}
                            value={purchaseMonth}
                            error={errorMap["housing.purchaseMonth"]}
                            onChange={(event) =>
                              setPurchaseMonth(event.currentTarget.value)
                            }
                          />
                          <NumberInput
                            label={t("purchasePrice")}
                            min={0}
                            value={purchasePrice}
                            onChange={(value) =>
                              setPurchasePrice(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                          <NumberInput
                            label={t("downPaymentPct")}
                            min={0}
                            max={100}
                            value={downPaymentPct}
                            onChange={(value) =>
                              setDownPaymentPct(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                          <NumberInput
                            label={t("mortgageRatePct")}
                            min={0}
                            max={100}
                            value={mortgageRatePct}
                            onChange={(value) =>
                              setMortgageRatePct(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                          <NumberInput
                            label={t("mortgageTermYears")}
                            min={1}
                            value={termYears}
                            onChange={(value) =>
                              setTermYears(typeof value === "number" ? value : "")
                            }
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
                        onChange={(event) =>
                          setBabyDueMonth(event.currentTarget.value)
                        }
                      />
                      <NumberInput
                        label={t("babyMonthlyBudget")}
                        min={0}
                        value={babyMonthlyBudget}
                        onChange={(value) =>
                          setBabyMonthlyBudget(
                            typeof value === "number" ? value : ""
                          )
                        }
                      />
                      <NumberInput
                        label={t("babyOneOff")}
                        min={0}
                        value={babyOneOffCost}
                        onChange={(value) =>
                          setBabyOneOffCost(
                            typeof value === "number" ? value : ""
                          )
                        }
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
            ),
          },
          {
            id: "preview",
            title: t("step.preview"),
            content: (
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
                    <WarningsPanel warnings={warnings} defaultOpen={false} />
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
                      <Button component={Link} href={planLabLink} variant="light">
                        {t("nextPlanLab")}
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Stack>
            ),
          },
          {
            id: "result",
            title: t("step.result"),
            content: (
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Title order={4}>{t("resultTitle")}</Title>
                  <Text size="sm" c="dimmed">
                    {t("resultHint")}
                  </Text>
                  {saveErrors.length > 0 && (
                    <Stack gap={4}>
                      <Text size="sm" c="red">
                        {t("saveErrorsTitle")}
                      </Text>
                      {saveErrors.map((error) => (
                        <Text key={error} size="sm" c="red">
                          • {error}
                        </Text>
                      ))}
                    </Stack>
                  )}
                  <Group align="center" wrap="wrap">
                    <Button onClick={handleSave}>{t("saveCta")}</Button>
                    <Button variant="default" onClick={handleLater}>
                      {t("laterCta")}
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t("saveHint")}
                  </Text>
                </Stack>
              </Card>
            ),
          },
        ]}
        navigation={
          <>
            <Button variant="default" onClick={handleBack} disabled={step === 0}>
              {t("back")}
            </Button>
            <Button onClick={handleNext} disabled={step === steps.length - 1}>
              {t("next")}
            </Button>
          </>
        }
      />
    </Stack>
  );
}
