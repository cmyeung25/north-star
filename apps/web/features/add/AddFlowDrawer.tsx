"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Notification,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
} from "@mantine/core";
import { buildMonthRange, monthIndex } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "../../lib/i18n";
import {
  createBudgetRuleId,
  createHomePositionId,
  getScenarioById,
  type BudgetCategory,
  type BudgetRule,
  type HomePositionDraft,
} from "../../src/store/scenarioStore";
import { useScenarioStore } from "../../src/store/scenarioStore";
import { useUiStore } from "../../src/store/uiStore";
import { compileBudgetRuleToMonthlySeries } from "../../src/domain/budget/compileBudgetRules";
import { normalizeMonthInput, normalizeMonthStrict } from "../../src/utils/month";
import { addMonths, monthAtAge, monthsBetween } from "../../src/domain/members/age";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import { createEventId, getEventTypeDisplay } from "../../components/timeline/utils";
import EndConditionPicker from "../../components/EndConditionPicker";
import type { EventDefinition } from "../../src/domain/events/types";
import type { EventType } from "../../src/features/timeline/schema";

const budgetCategories: BudgetCategory[] = [
  "health",
  "baseline",
  "childcare",
  "education",
  "eldercare",
  "petcare",
];

type FlowType = "rule" | "home" | "event";

type EventIntent = "income" | "expense" | "oneOff";

type RuleDraft = {
  name: string;
  memberId: string | null;
  category: BudgetCategory;
  ageFrom: number;
  ageTo: number;
  monthlyAmount: number;
  annualGrowthPct: number;
  startMonthInput: string;
  endMonthInput: string;
};

type HomeDraft = {
  name: string;
  purchaseMonthInput: string;
  purchasePrice: number;
  downPayment: number;
  feesOneTime: number;
  mortgageTermYears: number;
  mortgageRatePct: number;
  holdingCostMonthly: number;
  holdingCostAnnualGrowthPct: number;
  annualAppreciationPct: number;
};

type EventDraft = {
  intent: EventIntent;
  name: string;
  amount: number;
  startMonthInput: string;
  endMonthInput: string;
  endConditionMode: "month" | "age";
  oneOffMonthInput: string;
  annualGrowthPct: number;
  memberId: string | null;
  incomeSubtype:
    | "salary"
    | "bonus"
    | "freelance"
    | "rental"
    | "dividend"
    | "interest"
    | "other"
    | null;
  highlighted: boolean;
  endAtAgeYears: number | null;
};

type ImpactToast = {
  message: string;
  month: string | null;
};

const eventTypeByIntent: Record<EventIntent, EventType> = {
  income: "salary",
  expense: "travel",
  oneOff: "custom",
};

const buildMonthSeries = (start: string, end?: string | null) => {
  if (end) {
    const delta = monthsBetween(start, end);
    if (delta < 0) {
      return [];
    }
    return Array.from({ length: delta + 1 }, (_, index) => addMonths(start, index));
  }
  return buildMonthRange(start, 12);
};

type AddFlowDrawerProps = {
  opened: boolean;
  onClose: () => void;
  scenarioId?: string | null;
};

export default function AddFlowDrawer({ opened, onClose, scenarioId }: AddFlowDrawerProps) {
  const t = useTranslations("addFlow");
  const common = useTranslations("common");
  const timelineText = useTranslations("timeline");
  const validationText = useTranslations("validation");
  const locale = useLocale();
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const addEventToScenarios = useScenarioStore((state) => state.addEventToScenarios);
  const updateScenarioEventRef = useScenarioStore((state) => state.updateScenarioEventRef);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const openBreakdown = useUiStore((state) => state.openBreakdown);

  const resolvedScenarioId = scenarioId ?? activeScenarioId;
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const baseCurrency = scenario?.baseCurrency ?? "USD";
  const baseMonth = appSettings.globalBaseMonth ?? scenario?.assumptions.baseMonth ?? "";

  const [flowType, setFlowType] = useState<FlowType | null>(null);
  const [step, setStep] = useState(0);
  const [impactToast, setImpactToast] = useState<ImpactToast | null>(null);

  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(() => ({
    name: t("ruleDefaultName", { index: budgetRules.length + 1 }),
    memberId: members[0]?.id ?? null,
    category: "health",
    ageFrom: 0,
    ageTo: 3,
    monthlyAmount: 0,
    annualGrowthPct: 0,
    startMonthInput: baseMonth,
    endMonthInput: "",
  }));

  const [ruleErrors, setRuleErrors] = useState<{ start?: string; end?: string }>({});

  const [homeDraft, setHomeDraft] = useState<HomeDraft>(() => ({
    name: "",
    purchaseMonthInput: baseMonth,
    purchasePrice: 0,
    downPayment: 0,
    feesOneTime: 0,
    mortgageTermYears: 30,
    mortgageRatePct: 4,
    holdingCostMonthly: 0,
    holdingCostAnnualGrowthPct: 0,
    annualAppreciationPct: 0,
  }));

  const [homeErrors, setHomeErrors] = useState<{ purchaseMonth?: string }>({});

  const [eventDraft, setEventDraft] = useState<EventDraft>(() => ({
    intent: "income",
    name: "",
    amount: 0,
    startMonthInput: baseMonth,
    endMonthInput: "",
    endConditionMode: "month",
    oneOffMonthInput: baseMonth,
    annualGrowthPct: 0,
    memberId: members[0]?.id ?? null,
    incomeSubtype: "salary",
    highlighted: false,
    endAtAgeYears: null,
  }));

  const [eventErrors, setEventErrors] = useState<{
    start?: string;
    end?: string;
    oneOff?: string;
    endAtAge?: string;
  }>({});

  useEffect(() => {
    if (!opened) {
      setFlowType(null);
      setStep(0);
      return;
    }

    setRuleDraft({
      name: t("ruleDefaultName", { index: budgetRules.length + 1 }),
      memberId: members[0]?.id ?? null,
      category: "health",
      ageFrom: 0,
      ageTo: 3,
      monthlyAmount: 0,
      annualGrowthPct: 0,
      startMonthInput: baseMonth,
      endMonthInput: "",
    });
    setRuleErrors({});

    setHomeDraft({
      name: "",
      purchaseMonthInput: baseMonth,
      purchasePrice: 0,
      downPayment: 0,
      feesOneTime: 0,
      mortgageTermYears: 30,
      mortgageRatePct: 4,
      holdingCostMonthly: 0,
      holdingCostAnnualGrowthPct: 0,
      annualAppreciationPct: 0,
    });
    setHomeErrors({});

    setEventDraft({
      intent: "income",
      name: "",
      amount: 0,
      startMonthInput: baseMonth,
      endMonthInput: "",
      endConditionMode: "month",
      oneOffMonthInput: baseMonth,
      annualGrowthPct: 0,
      memberId: members[0]?.id ?? null,
      incomeSubtype: "salary",
      highlighted: false,
      endAtAgeYears: null,
    });
    setEventErrors({});
  }, [opened, baseMonth, budgetRules.length, members, t]);

  const steps = useMemo(() => {
    if (!flowType) {
      return [{ key: "intent", label: t("stepIntent") }];
    }

    if (flowType === "rule") {
      return [
        { key: "intent", label: t("stepIntent") },
        { key: "ruleTarget", label: t("ruleStepTarget") },
        { key: "ruleAmount", label: t("ruleStepAmount") },
        { key: "summary", label: t("stepSummary") },
      ];
    }

    if (flowType === "home") {
      return [
        { key: "intent", label: t("stepIntent") },
        { key: "homeAction", label: t("homeStepAction") },
        { key: "homeDetails", label: t("homeStepDetails") },
        { key: "summary", label: t("stepSummary") },
      ];
    }

    return [
      { key: "intent", label: t("stepIntent") },
      { key: "eventDetails", label: t("eventStepDetails") },
      { key: "eventOptions", label: t("eventStepOptions") },
      { key: "summary", label: t("stepSummary") },
    ];
  }, [flowType, t]);

  const rulePreview = useMemo(() => {
    if (!scenario) {
      return { total: 0, average: 0, months: [] as string[] };
    }

    const normalizedStart = ruleDraft.startMonthInput
      ? normalizeMonthStrict(ruleDraft.startMonthInput)
      : null;
    const normalizedEnd = ruleDraft.endMonthInput
      ? normalizeMonthStrict(ruleDraft.endMonthInput)
      : null;
    if (ruleDraft.startMonthInput && !normalizedStart?.ok) {
      return { total: 0, average: 0, months: [] as string[] };
    }
    if (ruleDraft.endMonthInput && !normalizedEnd?.ok) {
      return { total: 0, average: 0, months: [] as string[] };
    }

    const previewRule: BudgetRule = {
      id: "preview",
      name: ruleDraft.name || t("ruleLabel"),
      enabled: true,
      memberId: ruleDraft.memberId ?? undefined,
      category: ruleDraft.category,
      ageBand: { fromYears: ruleDraft.ageFrom, toYears: ruleDraft.ageTo },
      monthlyAmount: ruleDraft.monthlyAmount,
      annualGrowthPct: ruleDraft.annualGrowthPct,
      startMonth: normalizedStart?.ok ? normalizedStart.month : undefined,
      endMonth: normalizedEnd?.ok ? normalizedEnd.month : undefined,
      applyScope: { scope: "all" },
    };

    const scenarioForPreview = {
      ...scenario,
      assumptions: {
        ...scenario.assumptions,
        baseMonth: baseMonth || scenario.assumptions.baseMonth,
        horizonMonths: appSettings.globalHorizonMonths,
      },
    };

    const series = compileBudgetRuleToMonthlySeries(previewRule, scenarioForPreview, members);
    if (!baseMonth) {
      return { total: 0, average: 0, months: [] as string[] };
    }
    const previewMonths = buildMonthRange(baseMonth, 12);
    const total = previewMonths.reduce((sum, month) => {
      const entry = series.find((item) => item.month === month);
      return sum + Math.abs(entry?.amount ?? 0);
    }, 0);
    return {
      total,
      average: previewMonths.length > 0 ? total / previewMonths.length : 0,
      months: previewMonths,
    };
  }, [
    appSettings.globalHorizonMonths,
    baseMonth,
    members,
    ruleDraft,
    scenario,
    t,
  ]);

  const eventPreview = useMemo(() => {
    const monthValue =
      eventDraft.intent === "oneOff"
        ? eventDraft.oneOffMonthInput
        : eventDraft.startMonthInput;
    const normalizedStart = monthValue ? normalizeMonthStrict(monthValue) : null;
    if (monthValue && !normalizedStart?.ok) {
      return [] as string[];
    }
    if (!normalizedStart?.ok) {
      return [] as string[];
    }
    let resolvedEnd: string | null = null;
    if (eventDraft.intent !== "oneOff") {
      if (eventDraft.endConditionMode === "month") {
        const endInput = eventDraft.endMonthInput;
        const normalizedEnd = endInput ? normalizeMonthStrict(endInput) : null;
        if (endInput && !normalizedEnd?.ok) {
          return [] as string[];
        }
        resolvedEnd = normalizedEnd?.ok ? normalizedEnd.month : null;
      } else if (eventDraft.endConditionMode === "age" && eventDraft.endAtAgeYears) {
        const member = members.find((entry) => entry.id === eventDraft.memberId);
        if (!member || !baseMonth) {
          return [] as string[];
        }
        resolvedEnd = monthAtAge(member, eventDraft.endAtAgeYears, baseMonth);
      }
    }
    return buildMonthSeries(normalizedStart.month, resolvedEnd);
  }, [baseMonth, eventDraft, members]);

  const eventIntentLabel = useMemo(() => {
    const type = eventTypeByIntent[eventDraft.intent];
    return getEventTypeDisplay(timelineText, type, eventDraft.incomeSubtype ?? undefined);
  }, [eventDraft.intent, eventDraft.incomeSubtype, timelineText]);

  const endAtAgePreviewMonth = useMemo(() => {
    if (eventDraft.endConditionMode !== "age" || eventDraft.endAtAgeYears === null) {
      return null;
    }
    const member = members.find((entry) => entry.id === eventDraft.memberId);
    if (!member || !baseMonth) {
      return null;
    }
    return monthAtAge(member, eventDraft.endAtAgeYears, baseMonth);
  }, [
    baseMonth,
    eventDraft.endAtAgeYears,
    eventDraft.endConditionMode,
    eventDraft.memberId,
    members,
  ]);

  const resolveRuleMonths = () => {
    const nextErrors: { start?: string; end?: string } = {};
    const start = ruleDraft.startMonthInput
      ? normalizeMonthStrict(ruleDraft.startMonthInput)
      : null;
    if (ruleDraft.startMonthInput && !start?.ok) {
      nextErrors.start = validationText("useYearMonth");
    }
    const end = ruleDraft.endMonthInput
      ? normalizeMonthStrict(ruleDraft.endMonthInput)
      : null;
    if (ruleDraft.endMonthInput && !end?.ok) {
      nextErrors.end = validationText("useYearMonth");
    }
    setRuleErrors(nextErrors);
    return {
      start: start?.ok ? start.month : undefined,
      end: end?.ok ? end.month : undefined,
      ok: Object.keys(nextErrors).length === 0,
    };
  };

  const resolveHomeMonth = () => {
    const nextErrors: { purchaseMonth?: string } = {};
    const purchase = normalizeMonthStrict(homeDraft.purchaseMonthInput);
    if (!purchase.ok) {
      nextErrors.purchaseMonth = validationText("useYearMonth");
      setHomeErrors(nextErrors);
      return { ok: false, purchaseMonth: undefined };
    }
    setHomeErrors({});
    return { ok: true, purchaseMonth: purchase.month };
  };

  const resolveEventMonths = () => {
    const nextErrors: {
      start?: string;
      end?: string;
      oneOff?: string;
      endAtAge?: string;
    } = {};
    const isOneOff = eventDraft.intent === "oneOff";
    const monthInput = isOneOff ? eventDraft.oneOffMonthInput : eventDraft.startMonthInput;
    const start = normalizeMonthStrict(monthInput);
    if (!start.ok) {
      nextErrors[isOneOff ? "oneOff" : "start"] = validationText("useYearMonth");
    }
    let endMonth: string | undefined;
    if (!isOneOff && eventDraft.endConditionMode === "month" && eventDraft.endMonthInput) {
      const end = normalizeMonthStrict(eventDraft.endMonthInput);
      if (!end.ok) {
        nextErrors.end = validationText("useYearMonth");
      } else if (start.ok && monthIndex(start.month, end.month) < 0) {
        nextErrors.end = validationText("endMonthAfterStart");
      } else {
        endMonth = end.month;
      }
    }

    let endFromAge: string | null = null;
    if (!isOneOff && eventDraft.endConditionMode === "age") {
      if (eventDraft.endAtAgeYears === null) {
        nextErrors.endAtAge = validationText("endAtAgeMissingBase");
      } else {
        const member = members.find((entry) => entry.id === eventDraft.memberId);
        if (!member || !baseMonth) {
          nextErrors.endAtAge = validationText("endAtAgeMissingBase");
        } else {
          endFromAge = monthAtAge(member, eventDraft.endAtAgeYears, baseMonth);
          if (!endFromAge) {
            nextErrors.endAtAge = validationText("endAtAgeMissingBase");
          }
        }
      }
    }

    setEventErrors(nextErrors);
    return {
      ok: Object.keys(nextErrors).length === 0,
      startMonth: start.ok ? start.month : undefined,
      endMonth: endFromAge ?? endMonth,
    };
  };

  const handleSelectIntent = (nextFlow: FlowType, intent?: EventIntent) => {
    setFlowType(nextFlow);
    if (intent) {
      setEventDraft((current) => ({
        ...current,
        intent,
        incomeSubtype: intent === "income" ? "salary" : current.incomeSubtype,
      }));
    }
    setStep(1);
  };

  const handleConfirm = () => {
    if (!scenario || !resolvedScenarioId) {
      return;
    }

    if (flowType === "rule") {
      const monthResolution = resolveRuleMonths();
      if (!monthResolution.ok) {
        return;
      }
      const nextRule: BudgetRule = {
        id: createBudgetRuleId(),
        name: ruleDraft.name || t("ruleLabel"),
        enabled: true,
        memberId: ruleDraft.memberId ?? undefined,
        category: ruleDraft.category,
        ageBand: { fromYears: ruleDraft.ageFrom, toYears: ruleDraft.ageTo },
        monthlyAmount: ruleDraft.monthlyAmount,
        annualGrowthPct: ruleDraft.annualGrowthPct,
        startMonth: monthResolution.start,
        endMonth: monthResolution.end,
        applyScope: { scope: "all" },
      };
      createBudgetRule(nextRule);
      const impactMonth = monthResolution.start ?? baseMonth ?? null;
      setImpactToast({ message: t("confirmToast"), month: impactMonth });
      onClose();
      return;
    }

    if (flowType === "home") {
      const monthResolution = resolveHomeMonth();
      if (!monthResolution.ok || !monthResolution.purchaseMonth) {
        return;
      }
      const nextHome: HomePositionDraft = {
        id: createHomePositionId(),
        name: homeDraft.name.trim() ? homeDraft.name.trim() : undefined,
        usage: "primary",
        mode: "new_purchase",
        purchaseMonth: monthResolution.purchaseMonth,
        purchasePrice: homeDraft.purchasePrice,
        downPayment: homeDraft.downPayment,
        feesOneTime: homeDraft.feesOneTime,
        mortgageRatePct: homeDraft.mortgageRatePct,
        mortgageTermYears: homeDraft.mortgageTermYears,
        holdingCostMonthly: homeDraft.holdingCostMonthly,
        holdingCostAnnualGrowthPct: homeDraft.holdingCostAnnualGrowthPct,
        annualAppreciationPct: homeDraft.annualAppreciationPct,
      };
      addHomePosition(resolvedScenarioId, nextHome);
      setImpactToast({ message: t("confirmToast"), month: monthResolution.purchaseMonth });
      onClose();
      return;
    }

    if (flowType === "event") {
      const monthResolution = resolveEventMonths();
      if (!monthResolution.ok || !monthResolution.startMonth) {
        return;
      }
      const type = eventTypeByIntent[eventDraft.intent];
      const definition: EventDefinition = {
        id: createEventId(),
        title: eventDraft.name || eventIntentLabel,
        type,
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: monthResolution.startMonth,
          endMonth: monthResolution.endMonth ?? null,
          monthlyAmount: eventDraft.intent === "oneOff" ? 0 : eventDraft.amount,
          oneTimeAmount: eventDraft.intent === "oneOff" ? eventDraft.amount : 0,
          annualGrowthPct: eventDraft.intent === "oneOff" ? 0 : eventDraft.annualGrowthPct,
        },
        currency: baseCurrency,
        memberId: eventDraft.memberId ?? undefined,
        incomeSubtype:
          eventDraft.intent === "income" ? eventDraft.incomeSubtype ?? undefined : undefined,
        endAtAgeYears: eventDraft.endAtAgeYears ?? undefined,
      };
      addEventToScenarios(definition, [resolvedScenarioId]);
      if (eventDraft.highlighted) {
        updateScenarioEventRef(resolvedScenarioId, definition.id, {
          highlighted: true,
        });
      }
      setImpactToast({ message: t("confirmToast"), month: monthResolution.startMonth });
      onClose();
    }
  };

  const isRuleMonthValid = () => {
    const start = ruleDraft.startMonthInput
      ? normalizeMonthStrict(ruleDraft.startMonthInput)
      : null;
    if (ruleDraft.startMonthInput && !start?.ok) {
      return false;
    }
    const end = ruleDraft.endMonthInput
      ? normalizeMonthStrict(ruleDraft.endMonthInput)
      : null;
    if (ruleDraft.endMonthInput && !end?.ok) {
      return false;
    }
    return true;
  };

  const isHomeMonthValid = () => {
    const purchase = normalizeMonthStrict(homeDraft.purchaseMonthInput);
    return purchase.ok;
  };

  const isEventMonthValid = () => {
    const isOneOff = eventDraft.intent === "oneOff";
    const monthInput = isOneOff
      ? eventDraft.oneOffMonthInput
      : eventDraft.startMonthInput;
    const start = normalizeMonthStrict(monthInput);
    if (!start.ok) {
      return false;
    }
    if (!isOneOff && eventDraft.endConditionMode === "month" && eventDraft.endMonthInput) {
      const end = normalizeMonthStrict(eventDraft.endMonthInput);
      if (!end.ok) {
        return false;
      }
      if (monthIndex(start.month, end.month) < 0) {
        return false;
      }
    }
    if (!isOneOff && eventDraft.endConditionMode === "age") {
      if (eventDraft.endAtAgeYears === null) {
        return false;
      }
      const member = members.find((entry) => entry.id === eventDraft.memberId);
      if (!member || !baseMonth) {
        return false;
      }
      const endFromAge = monthAtAge(member, eventDraft.endAtAgeYears, baseMonth);
      if (!endFromAge) {
        return false;
      }
    }
    return true;
  };

  const canConfirm = () => {
    if (!scenario || !resolvedScenarioId) {
      return false;
    }

    if (flowType === "rule") {
      if (!ruleDraft.name.trim()) {
        return false;
      }
      return ruleDraft.monthlyAmount >= 0 && isRuleMonthValid();
    }

    if (flowType === "home") {
      if (homeDraft.purchasePrice <= 0) {
        return false;
      }
      return isHomeMonthValid();
    }

    if (flowType === "event") {
      if (eventDraft.amount <= 0) {
        return false;
      }
      return isEventMonthValid();
    }

    return false;
  };

  const isFinalStep = step === steps.length - 1 && flowType !== null;

  const handleViewImpact = () => {
    if (!impactToast) {
      return;
    }
    const scenarioPath = `/${locale}${buildScenarioUrl("/overview", resolvedScenarioId)}`;
    openBreakdown(impactToast.month ?? undefined);
    router.push(scenarioPath);
    setImpactToast(null);
  };

  const ruleMemberOptions = useMemo(
    () => [
      { value: "", label: t("ruleMemberHousehold") },
      ...members.map((member) => ({ value: member.id, label: member.name })),
    ],
    [members, t]
  );

  return (
    <>
      <Drawer opened={opened} onClose={onClose} position="right" size="lg" title={t("title")}
      >
        <Stack gap="lg">
          <Stepper active={step} onStepClick={setStep} allowNextStepsSelect={false}>
            {steps.map((item) => (
              <Stepper.Step key={item.key} label={item.label} />
            ))}
          </Stepper>

          {step === 0 && (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t("intentHint")}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Text fw={600}>{t("intentRule")}</Text>
                    <Text size="sm" c="dimmed">
                      {t("intentRuleHint")}
                    </Text>
                    <Button onClick={() => handleSelectIntent("rule")}>{t("intentRule")}</Button>
                  </Stack>
                </Card>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Text fw={600}>{t("intentHome")}</Text>
                    <Text size="sm" c="dimmed">
                      {t("intentHomeHint")}
                    </Text>
                    <Button onClick={() => handleSelectIntent("home")}>{t("intentHome")}</Button>
                  </Stack>
                </Card>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Text fw={600}>{t("intentIncome")}</Text>
                    <Text size="sm" c="dimmed">
                      {t("intentIncomeHint")}
                    </Text>
                    <Button onClick={() => handleSelectIntent("event", "income")}>{t("intentIncome")}</Button>
                  </Stack>
                </Card>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Text fw={600}>{t("intentExpense")}</Text>
                    <Text size="sm" c="dimmed">
                      {t("intentExpenseHint")}
                    </Text>
                    <Button onClick={() => handleSelectIntent("event", "expense")}>{t("intentExpense")}</Button>
                  </Stack>
                </Card>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Text fw={600}>{t("intentOneOff")}</Text>
                    <Text size="sm" c="dimmed">
                      {t("intentOneOffHint")}
                    </Text>
                    <Button onClick={() => handleSelectIntent("event", "oneOff")}>{t("intentOneOff")}</Button>
                  </Stack>
                </Card>
              </SimpleGrid>
            </Stack>
          )}

          {flowType === "rule" && step === 1 && (
            <Stack gap="md">
              <TextInput
                label={t("ruleName")}
                value={ruleDraft.name}
                onChange={(event) =>
                  setRuleDraft((current) => ({
                    ...current,
                    name: event.currentTarget.value,
                  }))
                }
              />
              <Select
                label={t("ruleMember")}
                value={ruleDraft.memberId ?? ""}
                data={ruleMemberOptions}
                onChange={(value) =>
                  setRuleDraft((current) => ({
                    ...current,
                    memberId: value || null,
                  }))
                }
              />
              <Select
                label={t("ruleCategoryLabel")}
                value={ruleDraft.category}
                data={budgetCategories.map((category) => ({
                  value: category,
                  label: t(`ruleCategory.${category}`),
                }))}
                onChange={(value) => {
                  if (!value) {
                    return;
                  }
                  setRuleDraft((current) => ({
                    ...current,
                    category: value as BudgetCategory,
                  }));
                }}
              />
              <Group grow>
                <NumberInput
                  label={t("ruleAgeFrom")}
                  value={ruleDraft.ageFrom}
                  min={0}
                  max={120}
                  onChange={(value) =>
                    setRuleDraft((current) => ({
                      ...current,
                      ageFrom: typeof value === "number" ? value : 0,
                    }))
                  }
                />
                <NumberInput
                  label={t("ruleAgeTo")}
                  value={ruleDraft.ageTo}
                  min={0}
                  max={120}
                  onChange={(value) =>
                    setRuleDraft((current) => ({
                      ...current,
                      ageTo: typeof value === "number" ? value : 0,
                    }))
                  }
                />
              </Group>
            </Stack>
          )}

          {flowType === "rule" && step === 2 && (
            <Stack gap="md">
              <NumberInput
                label={t("ruleMonthlyAmount")}
                value={ruleDraft.monthlyAmount}
                min={0}
                onChange={(value) =>
                  setRuleDraft((current) => ({
                    ...current,
                    monthlyAmount: typeof value === "number" ? value : 0,
                  }))
                }
              />
              <NumberInput
                label={t("ruleAnnualGrowth")}
                value={ruleDraft.annualGrowthPct}
                min={0}
                max={100}
                step={0.1}
                decimalScale={2}
                onChange={(value) =>
                  setRuleDraft((current) => ({
                    ...current,
                    annualGrowthPct: typeof value === "number" ? value : 0,
                  }))
                }
              />
              <Group grow>
                <TextInput
                  label={t("ruleStartMonth")}
                  value={ruleDraft.startMonthInput}
                  placeholder={common("yearMonthPlaceholder")}
                  error={ruleErrors.start}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setRuleDraft((current) => ({ ...current, startMonthInput: value }));
                    const normalized = normalizeMonthInput(value);
                    setRuleErrors((current) => ({
                      ...current,
                      start:
                        normalized.status === "invalid"
                          ? validationText("useYearMonth")
                          : undefined,
                    }));
                  }}
                />
                <TextInput
                  label={t("ruleEndMonth")}
                  value={ruleDraft.endMonthInput}
                  placeholder={common("yearMonthPlaceholder")}
                  error={ruleErrors.end}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setRuleDraft((current) => ({ ...current, endMonthInput: value }));
                    const normalized = normalizeMonthInput(value);
                    setRuleErrors((current) => ({
                      ...current,
                      end:
                        normalized.status === "invalid"
                          ? validationText("useYearMonth")
                          : undefined,
                    }));
                  }}
                />
              </Group>
            </Stack>
          )}

          {flowType === "rule" && step === 3 && (
            <Stack gap="md">
              <Text fw={600}>{t("summaryTitle")}</Text>
              <Stack gap={4}>
                <Text size="sm">
                  {t("summaryRuleName", { name: ruleDraft.name || t("ruleLabel") })}
                </Text>
                <Text size="sm">
                  {t("summaryRuleAmount", {
                    amount: formatCurrency(ruleDraft.monthlyAmount, baseCurrency, locale),
                  })}
                </Text>
                <Text size="sm">
                  {t("summaryRuleGrowth", { value: ruleDraft.annualGrowthPct })}
                </Text>
              </Stack>
              <Divider />
              <Stack gap={4}>
                <Text fw={600}>{t("impactPreviewTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("impactBudgetPreview", {
                    total: formatCurrency(rulePreview.total, baseCurrency, locale),
                    average: formatCurrency(rulePreview.average, baseCurrency, locale),
                  })}
                </Text>
              </Stack>
            </Stack>
          )}

          {flowType === "home" && step === 1 && (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t("homeActionHint")}
              </Text>
              <SegmentedControl
                data={[{ value: "purchase", label: t("homeActionPurchase") }]}
                value="purchase"
              />
            </Stack>
          )}

          {flowType === "home" && step === 2 && (
            <Stack gap="md">
              <TextInput
                label={t("homeName")}
                placeholder={t("homeNamePlaceholder")}
                value={homeDraft.name}
                onChange={(event) =>
                  setHomeDraft((current) => ({
                    ...current,
                    name: event.currentTarget.value,
                  }))
                }
              />
              <TextInput
                label={t("homePurchaseMonth")}
                value={homeDraft.purchaseMonthInput}
                placeholder={common("yearMonthPlaceholder")}
                error={homeErrors.purchaseMonth}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setHomeDraft((current) => ({ ...current, purchaseMonthInput: value }));
                  const normalized = normalizeMonthInput(value);
                  setHomeErrors((current) => ({
                    ...current,
                    purchaseMonth:
                      normalized.status === "invalid"
                        ? validationText("useYearMonth")
                        : undefined,
                  }));
                }}
              />
              <Group grow>
                <NumberInput
                  label={t("homePurchasePrice")}
                  value={homeDraft.purchasePrice}
                  min={0}
                  onChange={(value) =>
                    setHomeDraft((current) => ({
                      ...current,
                      purchasePrice: typeof value === "number" ? value : 0,
                    }))
                  }
                />
                <NumberInput
                  label={t("homeDownPayment")}
                  value={homeDraft.downPayment}
                  min={0}
                  onChange={(value) =>
                    setHomeDraft((current) => ({
                      ...current,
                      downPayment: typeof value === "number" ? value : 0,
                    }))
                  }
                />
              </Group>
              <NumberInput
                label={t("homeFeesOneTime")}
                value={homeDraft.feesOneTime}
                min={0}
                onChange={(value) =>
                  setHomeDraft((current) => ({
                    ...current,
                    feesOneTime: typeof value === "number" ? value : 0,
                  }))
                }
              />
              <Group grow>
                <NumberInput
                  label={t("homeMortgageTerm")}
                  value={homeDraft.mortgageTermYears}
                  min={0}
                  step={1}
                  onChange={(value) =>
                    setHomeDraft((current) => ({
                      ...current,
                      mortgageTermYears: typeof value === "number" ? value : 0,
                    }))
                  }
                />
                <NumberInput
                  label={t("homeMortgageRate")}
                  value={homeDraft.mortgageRatePct}
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  onChange={(value) =>
                    setHomeDraft((current) => ({
                      ...current,
                      mortgageRatePct: typeof value === "number" ? value : 0,
                    }))
                  }
                />
              </Group>
              <Group grow>
                <NumberInput
                  label={t("homeHoldingCost")}
                  value={homeDraft.holdingCostMonthly}
                  min={0}
                  onChange={(value) =>
                    setHomeDraft((current) => ({
                      ...current,
                      holdingCostMonthly: typeof value === "number" ? value : 0,
                    }))
                  }
                />
                <NumberInput
                  label={t("homeHoldingGrowth")}
                  value={homeDraft.holdingCostAnnualGrowthPct}
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  onChange={(value) =>
                    setHomeDraft((current) => ({
                      ...current,
                      holdingCostAnnualGrowthPct: typeof value === "number" ? value : 0,
                    }))
                  }
                />
              </Group>
            </Stack>
          )}

          {flowType === "home" && step === 3 && (
            <Stack gap="md">
              <Text fw={600}>{t("summaryTitle")}</Text>
              <Stack gap={4}>
                <Text size="sm">
                  {t("summaryHomePrice", {
                    amount: formatCurrency(homeDraft.purchasePrice, baseCurrency, locale),
                  })}
                </Text>
                <Text size="sm">
                  {t("summaryHomeDownPayment", {
                    amount: formatCurrency(homeDraft.downPayment, baseCurrency, locale),
                  })}
                </Text>
                <Text size="sm">
                  {t("summaryHomeFees", {
                    amount: formatCurrency(homeDraft.feesOneTime, baseCurrency, locale),
                  })}
                </Text>
                <Text size="sm">
                  {t("summaryHomeMortgage", {
                    rate: homeDraft.mortgageRatePct,
                    term: homeDraft.mortgageTermYears,
                  })}
                </Text>
                <Text size="sm">
                  {t("summaryHomeHolding", {
                    amount: formatCurrency(homeDraft.holdingCostMonthly, baseCurrency, locale),
                  })}
                </Text>
              </Stack>
              <Divider />
              <Stack gap={4}>
                <Text fw={600}>{t("homeBreakdownTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("homeBreakdownHint")}
                </Text>
                <Badge color="yellow" variant="light">
                  {t("homeDoubleCountingWarning")}
                </Badge>
              </Stack>
            </Stack>
          )}

          {flowType === "event" && step === 1 && (
            <Stack gap="md">
              <TextInput
                label={t("eventName")}
                value={eventDraft.name}
                onChange={(event) =>
                  setEventDraft((current) => ({
                    ...current,
                    name: event.currentTarget.value,
                  }))
                }
              />
              <NumberInput
                label={
                  eventDraft.intent === "oneOff"
                    ? t("eventOneOffAmount")
                    : t("eventMonthlyAmount")
                }
                value={eventDraft.amount}
                min={0}
                onChange={(value) =>
                  setEventDraft((current) => ({
                    ...current,
                    amount: typeof value === "number" ? value : 0,
                  }))
                }
              />
              {eventDraft.intent === "oneOff" ? (
                <TextInput
                  label={t("eventOneOffMonth")}
                  value={eventDraft.oneOffMonthInput}
                  placeholder={common("yearMonthPlaceholder")}
                  error={eventErrors.oneOff}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setEventDraft((current) => ({ ...current, oneOffMonthInput: value }));
                    const normalized = normalizeMonthInput(value);
                    setEventErrors((current) => ({
                      ...current,
                      oneOff:
                        normalized.status === "invalid"
                          ? validationText("useYearMonth")
                          : undefined,
                    }));
                  }}
                />
              ) : (
                <Group grow>
                  <TextInput
                    label={t("eventStartMonth")}
                    value={eventDraft.startMonthInput}
                    placeholder={common("yearMonthPlaceholder")}
                    error={eventErrors.start}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setEventDraft((current) => ({ ...current, startMonthInput: value }));
                      const normalized = normalizeMonthInput(value);
                      setEventErrors((current) => ({
                        ...current,
                        start:
                          normalized.status === "invalid"
                            ? validationText("useYearMonth")
                            : undefined,
                      }));
                    }}
                  />
                  <EndConditionPicker
                    mode={eventDraft.endConditionMode}
                    onModeChange={(value) => {
                      setEventDraft((current) => ({
                        ...current,
                        endConditionMode: value,
                        endMonthInput: value === "age" ? "" : current.endMonthInput,
                        endAtAgeYears: value === "month" ? null : current.endAtAgeYears,
                      }));
                      setEventErrors((current) => ({
                        ...current,
                        end: value === "age" ? undefined : current.end,
                        endAtAge: value === "month" ? undefined : current.endAtAge,
                      }));
                    }}
                    monthLabel={t("eventEndMonth")}
                    monthPlaceholder={common("yearMonthPlaceholder")}
                    monthValue={eventDraft.endMonthInput}
                    monthError={eventErrors.end}
                    onMonthChange={(value) => {
                      setEventDraft((current) => ({ ...current, endMonthInput: value }));
                      const normalized = normalizeMonthInput(value);
                      setEventErrors((current) => ({
                        ...current,
                        end:
                          normalized.status === "invalid"
                            ? validationText("useYearMonth")
                            : undefined,
                      }));
                    }}
                    ageLabel={t("eventEndAtAge")}
                    ageValue={eventDraft.endAtAgeYears ?? ""}
                    ageError={eventErrors.endAtAge}
                    ageMax={120}
                    onAgeChange={(value) =>
                      setEventDraft((current) => ({
                        ...current,
                        endAtAgeYears: typeof value === "number" ? value : null,
                      }))
                    }
                    monthOptionLabel={t("endConditionMonth")}
                    ageOptionLabel={t("endConditionAge")}
                    computedMonthLabel={t("endConditionComputed")}
                    computedMonthValue={endAtAgePreviewMonth ?? undefined}
                  />
                </Group>
              )}
              {eventDraft.intent !== "oneOff" && (
                <NumberInput
                  label={t("eventAnnualGrowth")}
                  value={eventDraft.annualGrowthPct}
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  onChange={(value) =>
                    setEventDraft((current) => ({
                      ...current,
                      annualGrowthPct: typeof value === "number" ? value : 0,
                    }))
                  }
                />
              )}
            </Stack>
          )}

          {flowType === "event" && step === 2 && (
            <Stack gap="md">
              <Select
                label={t("eventMember")}
                value={eventDraft.memberId ?? ""}
                data={[
                  { value: "", label: t("ruleMemberHousehold") },
                  ...members.map((member) => ({ value: member.id, label: member.name })),
                ]}
                onChange={(value) =>
                  setEventDraft((current) => ({
                    ...current,
                    memberId: value || null,
                  }))
                }
              />
              {eventDraft.intent === "income" && (
                <Select
                  label={t("eventIncomeSubtype")}
                  value={eventDraft.incomeSubtype ?? "salary"}
                  data={[
                    { value: "salary", label: t("eventIncomeSalary") },
                    { value: "bonus", label: t("eventIncomeBonus") },
                    { value: "freelance", label: t("eventIncomeFreelance") },
                    { value: "rental", label: t("eventIncomeRental") },
                    { value: "dividend", label: t("eventIncomeDividend") },
                    { value: "interest", label: t("eventIncomeInterest") },
                    { value: "other", label: t("eventIncomeOther") },
                  ]}
                  onChange={(value) =>
                    setEventDraft((current) => ({
                      ...current,
                      incomeSubtype: (value ?? "salary") as EventDraft["incomeSubtype"],
                    }))
                  }
                />
              )}
              <SegmentedControl
                data={[
                  { value: "no", label: t("eventHighlightOff") },
                  { value: "yes", label: t("eventHighlightOn") },
                ]}
                value={eventDraft.highlighted ? "yes" : "no"}
                onChange={(value) =>
                  setEventDraft((current) => ({
                    ...current,
                    highlighted: value === "yes",
                  }))
                }
              />
            </Stack>
          )}

          {flowType === "event" && step === 3 && (
            <Stack gap="md">
              <Text fw={600}>{t("summaryTitle")}</Text>
              <Stack gap={4}>
                <Text size="sm">{t("summaryEventType", { type: eventIntentLabel })}</Text>
                <Text size="sm">
                  {t("summaryEventAmount", {
                    amount: formatCurrency(eventDraft.amount, baseCurrency, locale),
                  })}
                </Text>
                {eventPreview.length > 0 ? (
                  <Text size="sm">
                    {t("summaryEventMonths", {
                      start: eventPreview[0],
                      end: eventPreview[eventPreview.length - 1],
                      count: eventPreview.length,
                    })}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("summaryEventMonthsEmpty")}
                  </Text>
                )}
              </Stack>
              <Divider />
              <Stack gap={4}>
                <Text fw={600}>{t("impactPreviewTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("impactEventPreview", { count: eventPreview.length })}
                </Text>
              </Stack>
            </Stack>
          )}

          {flowType && step > 0 && (
            <Group justify="space-between">
              <Button
                variant="subtle"
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
              >
                {common("actionBack")}
              </Button>
              {isFinalStep ? (
                <Button onClick={handleConfirm} disabled={!canConfirm()}>
                  {common("actionConfirm")}
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    setStep((current) => Math.min(current + 1, steps.length - 1))
                  }
                >
                  {common("actionNext")}
                </Button>
              )}
            </Group>
          )}
        </Stack>
      </Drawer>

      {impactToast && (
        <Notification
          color="teal"
          onClose={() => setImpactToast(null)}
          style={{ position: "fixed", right: 24, bottom: 24, zIndex: 300 }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{impactToast.message}</Text>
            <Button size="xs" variant="light" onClick={handleViewImpact}>
              {t("viewImpact")}
            </Button>
          </Group>
        </Notification>
      )}
    </>
  );
}
