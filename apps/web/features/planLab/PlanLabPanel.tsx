"use client";

import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Grid,
  Group,
  Menu,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip as MantineTooltip,
} from "@mantine/core";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PlanLabDraft,
  PlanLabExperiment,
  PlanLabExperimentType,
  PlanLabPositionPatch,
  PlanLabRulePatch,
} from "../../src/domain/planLab/types";
import type { EventDefinition, EventRule, EventRuleOverrides } from "../../src/domain/events/types";
import type {
  BudgetRule,
  Scenario,
  ScenarioMember,
  ScenarioMemberKind,
} from "../../src/store/scenarioStore";
import {
  createBudgetRuleId,
  createMemberId,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { normalizeMonthInput, parseMonthStrict } from "../../src/utils/month";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import type { TimeSeriesPoint } from "../overview/types";
import WarningsPanel from "../../components/WarningsPanel";
import { computeFirstBucket } from "../../src/domain/planLab/computeFirstBucket";
import {
  computeCashRiskScorecard,
  computeBufferThresholdFromLedger,
} from "../../src/domain/planLab/scorecard/cashRisk";
import { PlanLabCashRiskScorecard } from "../../components/PlanLabCashRiskScorecard";
import { buildScenarioEventViews, buildTimelineEventFromDefinition, buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import TimelineEventForm, { type TimelineEventFormResult } from "../../components/timeline/TimelineEventForm";
import { getEventMeta } from "../../src/events/eventCatalog";
import SmartInvestForm from "../../components/SmartInvestForm";
import { buildDefaultSmartInvestPolicy } from "../../src/domain/smartInvest/defaultPolicy";
import type { SmartInvestPolicy } from "../../src/domain/smartInvest/types";
import { applySmartInvestPatch } from "../../src/domain/planLab/smartInvestAdjust";
import { appliesToScenario } from "../../src/domain/applyScope";
import { buildChildBudgetRuleTemplates } from "../../src/domain/planLab/childBudgetTemplates";
import { materializePlanLabDraft } from "../../src/domain/planLab/materializePlanLabDraft";
import { getMemberAgeYears } from "../../src/domain/members/age";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";


type ChartType = "netWorth" | "cash" | "netCashflow";

type ScenarioItemKind = "event" | "rule" | "position";

type PositionKind =
  | "home"
  | "car"
  | "investment"
  | "insurance"
  | "loan"
  | "cash"
  | "smartInvest";

type ScenarioEditorItem = {
  id: string;
  kind: ScenarioItemKind;
  title: string;
  category: string;
  memberId?: string | null;
  memberName?: string | null;
  startMonth?: string;
  endMonth?: string | null;
  enabled: boolean;
  risky?: boolean;
  amount?: number | null;
  eventRefId?: string;
  eventDefinitionId?: string;
  ruleId?: string;
  ruleSource?: "baseline" | "draft";
  positionKey?: string;
  positionKind?: PositionKind;
  position?: any;
  budgetRule?: BudgetRule;
  eventDefinition?: EventDefinition;
  eventRule?: EventRule;
  eventOverrides?: EventRuleOverrides;
};

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

const getMonthError = (value: string, message: string) => {
  const status = normalizeMonthInput(value);
  if (status.status === "invalid") {
    return message;
  }
  return undefined;
};

const isStrictMonth = (value: string) => parseMonthStrict(value).ok;

const buildPatchedDefinition = (
  definition: EventDefinition,
  patch?: { patch?: Partial<EventDefinition>; endMonth?: string; isDisabled?: boolean }
) => {
  if (!patch?.patch) {
    return definition;
  }
  return {
    ...definition,
    ...patch.patch,
    rule: {
      ...definition.rule,
      ...(patch.patch.rule ?? {}),
    },
  };
};

const eventTypeLabel = (definition: EventDefinition) => {
  const meta = getEventMeta(definition.type);
  return meta.group;
};

const buildPositionKey = (kind: PositionKind, id: string | undefined, index: number) =>
  `${kind}:${id ?? `index-${index}`}`;

const buildPositionTitle = (kind: PositionKind, position: any, index: number, labels: {
  home: string;
  car: string;
  investment: string;
  insurance: string;
  loan: string;
  cash: string;
  position: string;
}) => {
  if (kind === "home") {
    return position?.name ?? labels.home;
  }
  if (kind === "car") {
    return position?.name ?? labels.car.replace("{index}", String(index + 1));
  }
  if (kind === "investment") {
    return position?.name ?? labels.investment.replace("{index}", String(index + 1));
  }
  if (kind === "insurance") {
    return position?.name ?? labels.insurance.replace("{index}", String(index + 1));
  }
  if (kind === "loan") {
    return position?.name ?? labels.loan.replace("{index}", String(index + 1));
  }
  if (kind === "cash") {
    return position?.name ?? labels.cash.replace("{index}", String(index + 1));
  }
  return labels.position.replace("{index}", String(index + 1));
};

type PlanLabRowBadge = {
  label: string;
  color?: string;
};

type PlanLabRowMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type PlanLabAccordionRowProps = {
  id: string;
  title: string;
  badges: PlanLabRowBadge[];
  summary?: string;
  enabled?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  menuItems?: PlanLabRowMenuItem[];
  panel?: ReactNode;
};

const PlanLabAccordionRow = memo(function PlanLabAccordionRow({
  id,
  title,
  badges,
  summary,
  enabled,
  onToggle,
  onEdit,
  menuItems,
  panel,
}: PlanLabAccordionRowProps) {
  return (
    <Accordion.Item value={id}>
      <Accordion.Control>
        <Group justify="space-between" align="center" wrap="nowrap" w="100%">
          <Stack gap={4} miw={0}>
            <Text fw={600} size="sm" lineClamp={1}>
              {title}
            </Text>
            <Group gap={4} wrap="wrap">
              {badges.map((badge) => (
                <Badge
                  key={`${id}-${badge.label}`}
                  size="xs"
                  variant="light"
                  color={badge.color}
                >
                  {badge.label}
                </Badge>
              ))}
            </Group>
          </Stack>
          <Text size="xs" c="dimmed" ta="center" maw={200} lineClamp={2}>
            {summary ?? "—"}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {onToggle && (
              <Switch
                size="sm"
                checked={Boolean(enabled)}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  onToggle();
                }}
              />
            )}
            {onEdit && (
              <ActionIcon
                size="sm"
                variant="light"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                <Text size="sm">✎</Text>
              </ActionIcon>
            )}
            {menuItems && menuItems.length > 0 && (
              <Menu withinPortal position="bottom-end">
                <Menu.Target>
                  <ActionIcon
                    size="sm"
                    variant="light"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Text size="sm">⋯</Text>
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {menuItems.map((item) => (
                    <Menu.Item
                      key={`${id}-${item.label}`}
                      leftSection={item.icon}
                      onClick={(event) => {
                        event.stopPropagation();
                        item.onClick();
                      }}
                      disabled={item.disabled}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </Accordion.Control>
      {panel && <Accordion.Panel>{panel}</Accordion.Panel>}
    </Accordion.Item>
  );
});

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
  const router = useRouter();
  const duplicateScenario = useScenarioStore((state) => state.duplicateScenario);
  const deleteScenario = useScenarioStore((state) => state.deleteScenario);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const upsertEventDefinition = useScenarioStore((state) => state.upsertEventDefinition);
  const createMember = useScenarioStore((state) => state.createMember);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);

  const translate = useCallback(
    (
    key: string,
    fallback: string,
    values?: Record<string, string | number>
    ) => (t.has(key) ? t(key, values) : fallback),
    [t]
  );

  const smartInvestLabel = translate(
    "planLabSmartInvestLabel",
    "智能投資（Smart Invest）"
  );
  const smartInvestTooltip = translate(
    "planLabSmartInvestTooltip",
    "自動依照設定投入與提取資金，維持目標資產配置。"
  );

  const [chartType, setChartType] = useState<ChartType>("netWorth");
  const [baselinePatches, setBaselinePatches] = useState<PlanLabDraft["baselinePatches"]>({
    eventPatches: {},
    rulePatches: {},
    positionPatches: {},
    smartInvestPatch: undefined,
  });
  const [draftMembers, setDraftMembers] = useState<ScenarioMember[]>([]);
  const [draftBudgetRules, setDraftBudgetRules] = useState<BudgetRule[]>([]);
  const [experiments, setExperiments] = useState<PlanLabExperiment[]>([]);
  const [experimentDrawerOpen, setExperimentDrawerOpen] = useState(false);
  const [experimentDraft, setExperimentDraft] = useState<PlanLabExperiment | null>(null);
  const [experimentDraftErrors, setExperimentDraftErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [experimentDrawerMode, setExperimentDrawerMode] = useState<"add" | "edit">(
    "add"
  );
  const [firstBucketTargetAmount, setFirstBucketTargetAmount] = useState<number | "">(
    ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "positions" | "events" | "rules">(
    "all"
  );
  const [activeOnly, setActiveOnly] = useState(true);
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [showRiskyOnly, setShowRiskyOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<"category" | "member" | "timeline">("category");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScenarioEditorItem | null>(null);
  const [editingFocus, setEditingFocus] = useState<"validity" | null>(null);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberDraft, setMemberDraft] = useState<{
    name: string;
    kind: ScenarioMemberKind;
    birthMonth: string;
    ageAtBaseMonth: number | "";
  } | null>(null);
  const [memberDraftErrors, setMemberDraftErrors] = useState<{
    name?: string;
    birthMonth?: string;
  }>({});
  const [childTemplateSelections, setChildTemplateSelections] = useState<
    Record<string, boolean>
  >({});

  const monthInvalidMessage = t("planLabMonthInvalid");

  const eventPatches = baselinePatches?.eventPatches ?? {};
  const rulePatches = baselinePatches?.rulePatches ?? {};
  const positionPatches = baselinePatches?.positionPatches ?? {};
  const smartInvestPatch = baselinePatches?.smartInvestPatch;
  const defaultSmartInvestPolicy = useMemo(
    () => buildDefaultSmartInvestPolicy("Smart Invest"),
    []
  );
  const baselineSmartInvestPolicy = scenario.assumptions.smartInvest;
  const combinedMembers = useMemo(
    () => [...members, ...draftMembers],
    [members, draftMembers]
  );
  const scenarioMembers = useMemo(
    () =>
      combinedMembers.filter((member) =>
        appliesToScenario(member.applyScope, scenario.id)
      ),
    [combinedMembers, scenario.id]
  );
  const combinedBudgetRules = useMemo(
    () => [...budgetRules, ...draftBudgetRules],
    [budgetRules, draftBudgetRules]
  );
  const scenarioBudgetRules = useMemo(
    () =>
      combinedBudgetRules.filter((rule) =>
        appliesToScenario(rule.applyScope, scenario.id)
      ),
    [combinedBudgetRules, scenario.id]
  );

  const positionTitleLabels = useMemo(
    () => ({
      home: translate("planLabPositionHomeFallback", "住宅"),
      car: translate("planLabPositionCarFallback", "車輛 {index}"),
      investment: translate("planLabPositionInvestmentFallback", "投資 {index}"),
      insurance: translate("planLabPositionInsuranceFallback", "保險 {index}"),
      loan: translate("planLabPositionLoanFallback", "貸款 {index}"),
      cash: translate("planLabPositionCashFallback", "現金桶 {index}"),
      position: translate("planLabPositionFallback", "資產 {index}"),
    }),
    [translate]
  );

  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      home: translate("planLabCategoryHome", "住宅"),
      car: translate("planLabCategoryCar", "車輛"),
      investment: translate("planLabCategoryInvestment", "投資"),
      insurance: translate("planLabCategoryInsurance", "保險"),
      loan: translate("planLabCategoryLoan", "貸款"),
      cash: translate("planLabCategoryCash", "現金"),
      event: translate("planLabCategoryEventFallback", "事件"),
      health: translate("planLabRuleCategoryHealth", "健康"),
      baseline: translate("planLabRuleCategoryBaseline", "基準"),
      childcare: translate("planLabRuleCategoryChildcare", "育兒"),
      education: translate("planLabRuleCategoryEducation", "教育"),
      eldercare: translate("planLabRuleCategoryEldercare", "長者照顧"),
      petcare: translate("planLabRuleCategoryPetcare", "寵物照顧"),
    }),
    [translate]
  );

  const getGroupLabel = (groupKey: string, item: ScenarioEditorItem) => {
    if (groupKey === "member") {
      if (!item.memberId) {
        return translate("planLabGroupUnassigned", "未指定");
      }
      return (
        combinedMembers.find((member) => member.id === item.memberId)?.name ??
        translate("planLabGroupUnassigned", "未指定")
      );
    }
    if (groupKey === "timeline") {
      return item.startMonth ?? translate("planLabGroupNoDate", "未設定月份");
    }
    return categoryLabels[item.category] ?? item.category;
  };

  const formatSmartInvestReserveLabel = useCallback(
    (reserve: SmartInvestPolicy["reserve"]) => {
      if (reserve.mode === "fixed") {
        const amount = formatCurrency(
          reserve.amount ?? 0,
          scenario.baseCurrency,
          locale
        );
        return translate(
          "planLabSmartInvestReserveFixed",
          `保留 ${amount}`,
          { amount }
        );
      }
      const months = reserve.months ?? 0;
      return translate(
        "planLabSmartInvestReserveMonths",
        `保留 ${months} 個月`,
        { months }
      );
    },
    [locale, scenario.baseCurrency, translate]
  );

  const formatSmartInvestContributionLabel = useCallback(
    (contribution: SmartInvestPolicy["contribution"]) => {
      if (contribution.mode === "percentOfIncome") {
        const pct = contribution.pct ?? 0;
        return translate(
          "planLabSmartInvestContributionIncome",
          `供款 佔收入 ${pct}%`,
          { pct }
        );
      }
      if (contribution.mode === "percentOfSurplus") {
        const pct = contribution.pct ?? 0;
        return translate(
          "planLabSmartInvestContributionSurplus",
          `供款 佔結餘 ${pct}%`,
          { pct }
        );
      }
      if (contribution.mode === "excessCash") {
        const pct = contribution.investPct ?? 100;
        const threshold = formatCurrency(
          contribution.thresholdAmount ?? 0,
          scenario.baseCurrency,
          locale
        );
        return translate(
          "planLabSmartInvestContributionExcess",
          `供款 ${pct}%（超過 ${threshold} 的現金）`,
          { pct, threshold }
        );
      }
      return translate(
        "planLabSmartInvestContributionRebalance",
        "供款再平衡"
      );
    },
    [locale, scenario.baseCurrency, translate]
  );

  const updateEventPatch = (id: string, patch: Partial<NonNullable<typeof eventPatches>[string]>) => {
    setBaselinePatches((current) => ({
      ...current,
      eventPatches: {
        ...(current?.eventPatches ?? {}),
        [id]: {
          ...(current?.eventPatches?.[id] ?? {}),
          ...patch,
        },
      },
    }));
  };

  const updateRulePatch = (id: string, patch: Partial<PlanLabRulePatch>) => {
    setBaselinePatches((current) => ({
      ...current,
      rulePatches: {
        ...(current?.rulePatches ?? {}),
        [id]: {
          ...(current?.rulePatches?.[id] ?? {}),
          ...patch,
        },
      },
    }));
  };

  const updatePositionPatch = (key: string, patch: Partial<PlanLabPositionPatch>) => {
    setBaselinePatches((current) => ({
      ...current,
      positionPatches: {
        ...(current?.positionPatches ?? {}),
        [key]: {
          ...(current?.positionPatches?.[key] ?? {}),
          ...patch,
        },
      },
    }));
  };

  const updateSmartInvestPatch = (
    patch: Partial<NonNullable<PlanLabDraft["baselinePatches"]>["smartInvestPatch"]>
  ) => {
    setBaselinePatches((current) => ({
      ...current,
      smartInvestPatch: {
        ...(current?.smartInvestPatch ?? {}),
        ...patch,
      },
    }));
  };

  const removePatch = (kind: ScenarioItemKind, id: string) => {
    setBaselinePatches((current) => {
      if (!current) {
        return current;
      }
      if (kind === "event") {
        const next = { ...(current.eventPatches ?? {}) };
        delete next[id];
        return { ...current, eventPatches: next };
      }
      if (kind === "rule") {
        const next = { ...(current.rulePatches ?? {}) };
        delete next[id];
        return { ...current, rulePatches: next };
      }
      if (kind === "position" && id === "smartInvest") {
        return { ...current, smartInvestPatch: undefined };
      }
      const next = { ...(current.positionPatches ?? {}) };
      delete next[id];
      return { ...current, positionPatches: next };
    });
  };

  const openEditingItem = useCallback(
    (item: ScenarioEditorItem, focus: "validity" | null = null) => {
      setEditingItem(item);
      setEditingFocus(focus);
    },
    []
  );

  const buildNewRuleDraft = useCallback(
    (overrides: Partial<BudgetRule> = {}) =>
      ({
        id: createBudgetRuleId(),
        name: translate("planLabRuleDefaultName", "新規則"),
        enabled: true,
        memberId: undefined,
        category: "baseline",
        ageBand: { fromYears: 0, toYears: 18 },
        monthlyAmount: 0,
        annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
        ...overrides,
      }) satisfies BudgetRule,
    [translate]
  );

  const openAddRuleDrawer = useCallback(
    (ruleOverrides: Partial<BudgetRule> = {}) => {
      const rule = buildNewRuleDraft(ruleOverrides);
      openEditingItem({
        id: `rule:${rule.id}`,
        kind: "rule",
        title: rule.name,
        category: rule.category,
        memberId: rule.memberId,
        memberName: rule.memberId
          ? combinedMembers.find((member) => member.id === rule.memberId)?.name ?? null
          : null,
        startMonth: rule.startMonth ?? undefined,
        endMonth: rule.endMonth ?? null,
        enabled: rule.enabled,
        amount: rule.monthlyAmount,
        ruleId: rule.id,
        ruleSource: "draft",
        budgetRule: rule,
      });
    },
    [buildNewRuleDraft, combinedMembers, openEditingItem]
  );

  const buildExperimentDefaults = (type: PlanLabExperimentType): PlanLabExperiment => {
    const baseMonth = scenario.assumptions.baseMonth ?? "";
    if (type === "oneOffExpense") {
      return { id: nanoid(), type, month: baseMonth, amount: 5000, isEnabled: true };
    }
    if (type === "rangeExpense") {
      return {
        id: nanoid(),
        type,
        startMonth: baseMonth,
        endMonth: baseMonth,
        monthlyAmount: 1500,
        isEnabled: true,
      };
    }
    if (type === "homeBuy") {
      return {
        id: nanoid(),
        type,
        purchaseMonth: baseMonth,
        purchasePrice: 8_000_000,
        downPaymentPct: 30,
        isEnabled: true,
      };
    }
    if (type === "carPlan") {
      return {
        id: nanoid(),
        type,
        purchaseMonth: baseMonth,
        purchasePrice: 300000,
        downPayment: 60000,
        annualDepreciationRatePct: 15,
        holdingCostMonthly: 3000,
        isEnabled: true,
      };
    }
    if (type === "incomeAdjust") {
      return {
        id: nanoid(),
        type,
        startMonth: baseMonth,
        monthlyAmount: 5000,
        isEnabled: true,
      };
    }
    if (type === "smartInvestAdjust") {
      const basePolicy = baselineSmartInvestPolicy ?? defaultSmartInvestPolicy;
      if (basePolicy.reserve.mode === "fixed") {
        return {
          id: nanoid(),
          type,
          reserveMode: "fixed",
          reserveAmount: Math.max(0, basePolicy.reserve.amount + 10000),
          isEnabled: true,
        };
      }
      return {
        id: nanoid(),
        type,
        reserveMode: "monthsOfOutflow",
        reserveMonths: Math.max(0, basePolicy.reserve.months + 1),
        isEnabled: true,
      };
    }
    return {
      id: nanoid(),
      type: "travelAnnual",
      startMonth: baseMonth,
      annualAmount: 20000,
      isEnabled: true,
    };
  };

  const updateExperiment = (id: string, patch: Partial<PlanLabExperiment>) => {
    setExperiments((current) =>
      current.map((experiment) =>
        experiment.id === id ? { ...experiment, ...patch } : experiment
      )
    );
  };

  const removeExperiment = (id: string) => {
    setExperiments((current) => current.filter((experiment) => experiment.id !== id));
  };

  const removeDraftMember = (memberId: string) => {
    setDraftMembers((current) =>
      current.filter((member) => member.id !== memberId)
    );
    setDraftBudgetRules((current) =>
      current.filter((rule) => rule.memberId !== memberId)
    );
  };

  const removeDraftBudgetRule = (ruleId: string) => {
    setDraftBudgetRules((current) => current.filter((rule) => rule.id !== ruleId));
  };

  const duplicateExperiment = (experiment: PlanLabExperiment) => {
    setExperiments((current) => [...current, { ...experiment, id: nanoid() }]);
  };

  const openAddExperimentDrawer = () => {
    setExperimentDrawerMode("add");
    setExperimentDraft(null);
    setExperimentDraftErrors({});
    setExperimentDrawerOpen(true);
  };

  const openEditExperimentDrawer = (experiment: PlanLabExperiment) => {
    setExperimentDrawerMode("edit");
    setExperimentDraft({ ...experiment });
    setExperimentDraftErrors({});
    setExperimentDrawerOpen(true);
  };

  const updateExperimentDraft = (patch: Partial<PlanLabExperiment>) => {
    setExperimentDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const validateExperimentDraft = (draft: PlanLabExperiment) => {
    const errors: Record<string, string | undefined> = {};
    const setMonthError = (field: string, value?: string | null) => {
      if (!value) {
        errors[field] = t("planLabMonthRequired");
        return;
      }
      if (!parseMonthStrict(value).ok) {
        errors[field] = monthInvalidMessage;
      }
    };

    if (draft.type === "oneOffExpense") {
      setMonthError("month", draft.month);
    }
    if (draft.type === "rangeExpense") {
      setMonthError("startMonth", draft.startMonth);
      setMonthError("endMonth", draft.endMonth);
    }
    if (draft.type === "homeBuy") {
      setMonthError("purchaseMonth", draft.purchaseMonth);
    }
    if (draft.type === "carPlan") {
      setMonthError("purchaseMonth", draft.purchaseMonth);
    }
    if (draft.type === "incomeAdjust") {
      setMonthError("startMonth", draft.startMonth);
    }
    if (draft.type === "travelAnnual") {
      setMonthError("startMonth", draft.startMonth);
    }
    if (draft.type === "smartInvestAdjust") {
      // no month fields
    }
    return errors;
  };

  const applyExperimentDraft = () => {
    if (!experimentDraft) {
      return;
    }
    const errors = validateExperimentDraft(experimentDraft);
    setExperimentDraftErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    if (experimentDrawerMode === "add") {
      setExperiments((current) => [...current, experimentDraft]);
    } else {
      updateExperiment(experimentDraft.id, experimentDraft);
    }
    setExperimentDrawerOpen(false);
  };

  const openAddMemberDrawer = () => {
    setMemberDraft({
      name: "",
      kind: "person",
      birthMonth: "",
      ageAtBaseMonth: "",
    });
    setMemberDraftErrors({});
    setChildTemplateSelections({});
    setMemberDrawerOpen(true);
  };

  const isChildDraft = useMemo(() => {
    if (!memberDraft || memberDraft.kind !== "person") {
      return false;
    }
    if (typeof memberDraft.ageAtBaseMonth === "number") {
      return memberDraft.ageAtBaseMonth < 18;
    }
    if (!memberDraft.birthMonth) {
      return false;
    }
    const baseMonth = scenario.assumptions.baseMonth;
    if (!baseMonth) {
      return false;
    }
    const normalizedBirthMonth = parseMonthStrict(memberDraft.birthMonth);
    if (!normalizedBirthMonth.ok) {
      return false;
    }
    const ageYears = getMemberAgeYears(
      {
        id: "draft",
        name: memberDraft.name,
        kind: memberDraft.kind,
        birthMonth: normalizedBirthMonth.month,
        ageAtBaseMonth: memberDraft.ageAtBaseMonth || undefined,
      },
      baseMonth,
      baseMonth
    );
    return ageYears < 18;
  }, [memberDraft, scenario.assumptions.baseMonth]);

  const childTemplateOptions = useMemo(() => {
    if (!memberDraft || !isChildDraft) {
      return [];
    }
    return buildChildBudgetRuleTemplates({
      memberId: "template",
      memberName: memberDraft.name || undefined,
    });
  }, [isChildDraft, memberDraft]);

  const handleMemberSave = () => {
    if (!memberDraft) {
      return;
    }
    const nextErrors: { name?: string; birthMonth?: string } = {};
    if (!memberDraft.name.trim()) {
      nextErrors.name = translate("planLabMemberNameRequired", "請輸入名稱");
    }
    if (memberDraft.birthMonth) {
      const status = normalizeMonthInput(memberDraft.birthMonth);
      if (status.status === "invalid") {
        nextErrors.birthMonth = monthInvalidMessage;
      }
      if (status.status === "partial") {
        nextErrors.birthMonth = translate(
          "planLabMonthIncomplete",
          "月份尚未完整"
        );
      }
    }
    setMemberDraftErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const memberId = createMemberId();
    const nextMember: ScenarioMember = {
      id: memberId,
      name: memberDraft.name.trim(),
      kind: memberDraft.kind,
      birthMonth: memberDraft.birthMonth || undefined,
      ageAtBaseMonth:
        typeof memberDraft.ageAtBaseMonth === "number"
          ? memberDraft.ageAtBaseMonth
          : undefined,
    };
    setDraftMembers((current) => [...current, nextMember]);

    if (isChildDraft && childTemplateOptions.length > 0) {
      const selectedIndexes = Object.entries(childTemplateSelections)
        .filter(([, selected]) => selected)
        .map(([index]) => Number(index))
        .filter((index) => Number.isFinite(index));
      if (selectedIndexes.length > 0) {
        const templates = buildChildBudgetRuleTemplates({
          memberId,
          memberName: nextMember.name,
        });
        const selectedRules = templates.filter((_, index) =>
          selectedIndexes.includes(index)
        );
        setDraftBudgetRules((current) => [...current, ...selectedRules]);
        const firstRule = selectedRules[0];
        if (firstRule) {
          openEditingItem({
            id: `rule:${firstRule.id}`,
            kind: "rule",
            title: firstRule.name,
            category: firstRule.category,
            memberId: firstRule.memberId,
            memberName: nextMember.name,
            startMonth: firstRule.startMonth ?? undefined,
            endMonth: firstRule.endMonth ?? null,
            enabled: firstRule.enabled,
            amount: firstRule.monthlyAmount,
            ruleId: firstRule.id,
            ruleSource: "draft",
            budgetRule: firstRule,
          });
        }
      }
    }

    setMemberDrawerOpen(false);
  };

  const scenarioItems = useMemo<ScenarioEditorItem[]>(() => {
    const items: ScenarioEditorItem[] = [];
    const eventViews = buildScenarioEventViews(scenario, eventLibrary);
    eventViews.forEach((view) => {
      const patch = eventPatches[view.definition.id];
      const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : view.ref.enabled;
      const category = eventTypeLabel(view.definition);
      const title = view.definition.title;
      const rule = view.rule;
      const memberName = view.definition.memberId
        ? combinedMembers.find((member) => member.id === view.definition.memberId)?.name ??
          null
        : null;
      const risky =
        view.definition.type === "buy_home" ||
        ["mortgage", "housing", "home", "rent"].some((keyword) =>
          view.definition.title.toLowerCase().includes(keyword)
        );
      items.push({
        id: `event:${view.definition.id}`,
        kind: "event",
        title,
        category: category || "event",
        memberId: view.definition.memberId ?? null,
        memberName,
        startMonth: rule.startMonth,
        endMonth: patch?.endMonth ?? rule.endMonth ?? null,
        enabled: isEnabled,
        risky,
        eventRefId: view.ref.refId,
        eventDefinitionId: view.definition.id,
        eventDefinition: view.definition,
        eventRule: rule,
        eventOverrides: view.ref.overrides,
      });
    });

    const draftRuleIds = new Set(draftBudgetRules.map((rule) => rule.id));
    scenarioBudgetRules.forEach((rule) => {
      const isDraftRule = draftRuleIds.has(rule.id);
      const patch = isDraftRule ? null : rulePatches[rule.id];
      const isEnabled =
        patch?.isDisabled !== undefined ? !patch.isDisabled : rule.enabled;
      const memberName = rule.memberId
        ? combinedMembers.find((member) => member.id === rule.memberId)?.name ?? null
        : null;
      const amount = isDraftRule
        ? rule.monthlyAmount ?? null
        : patch?.patch?.monthlyAmount ?? rule.monthlyAmount ?? null;
      const startMonth = isDraftRule
        ? rule.startMonth
        : patch?.patch?.startMonth ?? rule.startMonth;
      const endMonth = isDraftRule
        ? rule.endMonth ?? null
        : patch?.endMonth ?? patch?.patch?.endMonth ?? rule.endMonth ?? null;
      items.push({
        id: `rule:${rule.id}`,
        kind: "rule",
        title: rule.name,
        category: rule.category,
        memberId: rule.memberId ?? null,
        memberName,
        startMonth,
        endMonth,
        enabled: isEnabled,
        amount,
        ruleId: rule.id,
        ruleSource: isDraftRule ? "draft" : "baseline",
        budgetRule: rule,
      });
    });

    const positions = scenario.positions;
    if (baselineSmartInvestPolicy) {
      const key = "smartInvest";
      const patchedPolicy = applySmartInvestPatch(
        baselineSmartInvestPolicy,
        smartInvestPatch
      );
      items.push({
        id: `position:${key}`,
        kind: "position",
        title: smartInvestLabel,
        category: "investment",
        enabled: patchedPolicy.enabled,
        positionKey: key,
        positionKind: "smartInvest",
        position: patchedPolicy,
      });
    }
    if (positions?.home) {
      const key = "home:primary";
      const patch = positionPatches[key];
      const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
      items.push({
        id: `position:${key}`,
        kind: "position",
        title: positions.home.name ?? positionTitleLabels.home,
        category: "home",
        enabled: isEnabled,
        positionKey: key,
        positionKind: "home",
        position: positions.home as any,
        risky: true,
      });
    }
    if (positions?.homes) {
      positions.homes.forEach((home, index) => {
        const key = buildPositionKey("home", home.id, index);
        const patch = positionPatches[key];
        const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
        items.push({
          id: `position:${key}`,
          kind: "position",
          title: buildPositionTitle("home", home, index, positionTitleLabels),
          category: "home",
          enabled: isEnabled,
          positionKey: key,
          positionKind: "home",
          position: home as any,
          risky: true,
        });
      });
    }
    if (positions?.cars) {
      positions.cars.forEach((car, index) => {
        const key = buildPositionKey("car", car.id, index);
        const patch = positionPatches[key];
        const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
        items.push({
          id: `position:${key}`,
          kind: "position",
          title: buildPositionTitle("car", car, index, positionTitleLabels),
          category: "car",
          enabled: isEnabled,
          positionKey: key,
          positionKind: "car",
          position: car as any,
        });
      });
    }
    if (positions?.investments) {
      positions.investments.forEach((investment, index) => {
        const key = buildPositionKey("investment", investment.id, index);
        const patch = positionPatches[key];
        const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
        items.push({
          id: `position:${key}`,
          kind: "position",
          title: buildPositionTitle("investment", investment, index, positionTitleLabels),
          category: "investment",
          enabled: isEnabled,
          positionKey: key,
          positionKind: "investment",
          position: investment as any,
        });
      });
    }
    if (positions?.insurances) {
      positions.insurances.forEach((insurance, index) => {
        const key = buildPositionKey("insurance", insurance.id, index);
        const patch = positionPatches[key];
        const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : insurance.enabled;
        items.push({
          id: `position:${key}`,
          kind: "position",
          title: buildPositionTitle("insurance", insurance, index, positionTitleLabels),
          category: "insurance",
          enabled: isEnabled,
          positionKey: key,
          positionKind: "insurance",
          position: insurance as any,
        });
      });
    }
    if (positions?.loans) {
      positions.loans.forEach((loan, index) => {
        const key = buildPositionKey("loan", loan.id, index);
        const patch = positionPatches[key];
        const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
        items.push({
          id: `position:${key}`,
          kind: "position",
          title: buildPositionTitle("loan", loan, index, positionTitleLabels),
          category: "loan",
          enabled: isEnabled,
          positionKey: key,
          positionKind: "loan",
          position: loan as any,
        });
      });
    }
    if (positions?.cashBuckets) {
      positions.cashBuckets.forEach((bucket, index) => {
        const key = buildPositionKey("cash", bucket.id, index);
        const patch = positionPatches[key];
        const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
        items.push({
          id: `position:${key}`,
          kind: "position",
          title: buildPositionTitle("cash", bucket, index, positionTitleLabels),
          category: "cash",
          enabled: isEnabled,
          positionKey: key,
          positionKind: "cash",
          position: bucket as any,
        });
      });
    }

    return items;
  }, [
    baselineSmartInvestPolicy,
    combinedMembers,
    draftBudgetRules,
    eventLibrary,
    eventPatches,
    positionPatches,
    positionTitleLabels,
    rulePatches,
    scenario,
    scenarioBudgetRules,
    smartInvestLabel,
    smartInvestPatch,
  ]);

  const getScenarioItemBadges = useCallback(
    (item: ScenarioEditorItem): PlanLabRowBadge[] => {
      const badges: PlanLabRowBadge[] = [];
      const categoryLabel = categoryLabels[item.category] ?? item.category;
      if (categoryLabel) {
        badges.push({ label: categoryLabel });
      }
      if (item.memberName) {
        badges.push({ label: item.memberName, color: "gray" });
      }
      if (!item.enabled) {
        badges.push({ label: translate("planLabBadgeDisabled", "已停用"), color: "red" });
      }
      if (item.endMonth) {
        badges.push({ label: translate("planLabBadgeEnded", "已結束"), color: "yellow" });
      }
      return badges;
    },
    [categoryLabels, translate]
  );

  const getScenarioItemSummary = useCallback(
    (item: ScenarioEditorItem) => {
      const parts: string[] = [];
      if (typeof item.amount === "number") {
        parts.push(formatCurrency(item.amount, scenario.baseCurrency, locale));
      }
      if (item.startMonth || item.endMonth) {
        const start = item.startMonth ?? "—";
        const end = item.endMonth ? ` → ${item.endMonth}` : "";
        parts.push(`${start}${end}`);
      }
      return parts.join(" · ");
    },
    [locale, scenario.baseCurrency]
  );

  const getExperimentSummary = useCallback(
    (experiment: PlanLabExperiment) => {
      const currency = scenario.baseCurrency;
      if (experiment.type === "oneOffExpense") {
        return `${formatCurrency(experiment.amount ?? 0, currency, locale)} · ${
          experiment.month ?? ""
        }`;
      }
      if (experiment.type === "rangeExpense") {
        return `${formatCurrency(
          experiment.monthlyAmount ?? 0,
          currency,
          locale
        )}／月 · ${experiment.startMonth ?? ""} → ${experiment.endMonth ?? ""}`;
      }
      if (experiment.type === "homeBuy") {
        return `${formatCurrency(experiment.purchasePrice ?? 0, currency, locale)} · ${
          experiment.purchaseMonth ?? ""
        }`;
      }
      if (experiment.type === "carPlan") {
        return `${formatCurrency(experiment.purchasePrice ?? 0, currency, locale)} · ${
          experiment.purchaseMonth ?? ""
        }`;
      }
      if (experiment.type === "incomeAdjust") {
        return `${formatCurrency(
          experiment.monthlyAmount ?? 0,
          currency,
          locale
        )}／月 · ${experiment.startMonth ?? ""}`;
      }
      if (experiment.type === "travelAnnual") {
        return `${formatCurrency(experiment.annualAmount ?? 0, currency, locale)} · ${
          experiment.startMonth ?? ""
        }`;
      }
      return translate("planLabExperimentSmartInvestSummary", "智能投資調整");
    },
    [locale, scenario.baseCurrency, translate]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return scenarioItems.filter((item) => {
      if (filterKind === "events" && item.kind !== "event") {
        return false;
      }
      if (filterKind === "rules" && item.kind !== "rule") {
        return false;
      }
      if (filterKind === "positions" && item.kind !== "position") {
        return false;
      }
      if (activeOnly && !item.enabled) {
        return false;
      }
      if (showChangedOnly) {
        if (item.kind === "event" && item.eventDefinitionId) {
          const patch = eventPatches[item.eventDefinitionId];
          if (!patch || (!patch.isDisabled && !patch.endMonth && !patch.patch)) {
            return false;
          }
        }
        if (item.kind === "rule" && item.ruleId) {
          if (item.ruleSource === "draft") {
            return true;
          }
          const patch = rulePatches[item.ruleId];
          if (!patch || (!patch.isDisabled && !patch.endMonth && !patch.patch)) {
            return false;
          }
        }
        if (item.kind === "position" && item.positionKey) {
          if (item.positionKind === "smartInvest") {
            if (!smartInvestPatch || (!smartInvestPatch.isDisabled && !smartInvestPatch.patch)) {
              return false;
            }
          } else {
            const patch = positionPatches[item.positionKey];
            if (!patch || (!patch.isDisabled && !patch.patch)) {
              return false;
            }
          }
        }
      }
      if (showRiskyOnly && !item.risky) {
        return false;
      }
      if (query && !item.title.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [
    activeOnly,
    eventPatches,
    filterKind,
    positionPatches,
    rulePatches,
    scenarioItems,
    searchQuery,
    showChangedOnly,
    showRiskyOnly,
    smartInvestPatch,
  ]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ScenarioEditorItem[]>();
    filteredItems.forEach((item) => {
      const groupKey = getGroupLabel(groupBy, item);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems, groupBy, combinedMembers, categoryLabels]);

  const planLabDraft: PlanLabDraft = useMemo(
    () => ({
      baselinePatches,
      experiments,
      scorecardSettings: {
        firstBucketTargetAmount:
          typeof firstBucketTargetAmount === "number" ? firstBucketTargetAmount : undefined,
      },
      additions: {
        members: draftMembers,
        budgetRules: draftBudgetRules,
      },
    }),
    [baselinePatches, draftBudgetRules, draftMembers, experiments, firstBucketTargetAmount]
  );

  const planLabProjection = usePlanLabProjectionWithLedger(
    planLabDraft,
    scenario,
    eventLibrary,
    { members, budgetRules }
  );
  const baselineProjection = usePlanLabProjectionWithLedger(
    null,
    scenario,
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
    if (!optionViewModel || !planLabProjection.projection) {
      return {
        cash: [],
        netWorth: [],
        netCashflow: [],
      };
    }
    const netCashflowBase = planLabProjection.months.map((month) => ({
      month,
      value: planLabProjection.projectionNetCashflowByMonth?.[month] ?? 0,
    }));
    const base = {
      cash: optionViewModel.cashSeries ?? [],
      netWorth: optionViewModel.netWorthSeries ?? [],
      netCashflow: netCashflowBase,
    };
    if (displayMode === "real") {
      return {
        cash: deflateSeries(base.cash),
        netWorth: deflateSeries(base.netWorth),
        netCashflow: deflateSeries(base.netCashflow),
      };
    }
    return base;
  }, [deflateSeries, displayMode, optionViewModel, planLabProjection]);

  const firstBucketTargetValue =
    typeof firstBucketTargetAmount === "number" ? firstBucketTargetAmount : null;
  const firstBucketResult = useMemo(
    () => computeFirstBucket(planLabProjection.projection, firstBucketTargetValue),
    [firstBucketTargetValue, planLabProjection.projection]
  );
  const baselineFirstBucketResult = useMemo(
    () => computeFirstBucket(baselineProjection.projection, firstBucketTargetValue),
    [firstBucketTargetValue, baselineProjection.projection]
  );
  const optionBucketIndex = firstBucketResult?.achievedIndex;
  const baselineBucketIndex = baselineFirstBucketResult?.achievedIndex;
  const firstBucketDeltaMonths =
    optionBucketIndex != null && baselineBucketIndex != null
      ? baselineBucketIndex - optionBucketIndex
      : null;

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

  // Compute cash risk scorecard metrics
  const cashRiskScorecard = useMemo(() => {
    if (!optionSeries.cash || optionSeries.cash.length === 0) {
      return null;
    }
    // Compute buffer threshold from ledger items (3-month expense buffer)
    const bufferThreshold = computeBufferThresholdFromLedger(
      planLabProjection.ledger,
      planLabProjection.months
    );
    return computeCashRiskScorecard({
      cashSeries: optionSeries.cash,
      bufferThreshold,
    });
  }, [optionSeries.cash, planLabProjection.ledger, planLabProjection.months]);

  const experimentTypeOptions = useMemo(
    () => [
      {
        value: "oneOffExpense",
        label: translate("planLabExperimentOneOff", "一次性支出"),
      },
      {
        value: "rangeExpense",
        label: translate("planLabExperimentRange", "期間支出"),
      },
      {
        value: "homeBuy",
        label: translate("planLabExperimentHomeBuy", "置業"),
      },
      {
        value: "carPlan",
        label: translate("planLabExperimentCarPlan", "汽車方案"),
      },
      {
        value: "incomeAdjust",
        label: translate("planLabExperimentIncomeAdjust", "收入調整"),
      },
      {
        value: "travelAnnual",
        label: translate("planLabExperimentTravelAnnual", "年度旅遊"),
      },
      {
        value: "smartInvestAdjust",
        label: translate("planLabExperimentSmartInvestAdjust", "智能投資調整"),
      },
    ],
    [translate]
  );

  const experimentTypeCards = useMemo(
    () => [
      {
        type: "oneOffExpense" as PlanLabExperimentType,
        label: translate("planLabExperimentCardWedding", "婚禮"),
      },
      {
        type: "rangeExpense" as PlanLabExperimentType,
        label: translate("planLabExperimentCardBaby", "育兒"),
      },
      {
        type: "travelAnnual" as PlanLabExperimentType,
        label: translate("planLabExperimentCardTravel", "旅遊"),
      },
      {
        type: "homeBuy" as PlanLabExperimentType,
        label: translate("planLabExperimentCardHome", "置業"),
      },
      {
        type: "incomeAdjust" as PlanLabExperimentType,
        label: translate("planLabExperimentCardIncome", "收入"),
      },
      {
        type: "carPlan" as PlanLabExperimentType,
        label: translate("planLabExperimentCardCar", "汽車"),
      },
      {
        type: "smartInvestAdjust" as PlanLabExperimentType,
        label: translate("planLabExperimentCardInvest", "投資"),
      },
    ],
    [translate]
  );

  const appliedControls = useMemo(() => {
    const controls: Array<{
      id: string;
      titleLine: string;
      deltaLine?: string;
      label: string;
      tooltip?: string;
      isEnabled: boolean;
      onToggle: () => void;
      onRemove: () => void;
    }> = [];

    draftMembers.forEach((member) => {
      const deltaLine = translate("planLabAppliedAddedMember", "新增成員");
      controls.push({
        id: `member-${member.id}`,
        titleLine: member.name,
        deltaLine,
        label: [member.name, deltaLine].filter(Boolean).join(" "),
        isEnabled: true,
        onToggle: () => {},
        onRemove: () => removeDraftMember(member.id),
      });
    });

    draftBudgetRules.forEach((rule) => {
      const deltaLine = translate("planLabAppliedAddedRule", "新增規則");
      controls.push({
        id: `rule-add-${rule.id}`,
        titleLine: rule.name,
        deltaLine,
        label: [rule.name, deltaLine].filter(Boolean).join(" "),
        isEnabled: rule.enabled,
        onToggle: () =>
          setDraftBudgetRules((current) =>
            current.map((entry) =>
              entry.id === rule.id ? { ...entry, enabled: !entry.enabled } : entry
            )
          ),
        onRemove: () => removeDraftBudgetRule(rule.id),
      });
    });

    Object.entries(eventPatches).forEach(([refId, patch]) => {
      const item = scenarioItems.find((entry) => entry.eventDefinitionId === refId);
      const title = item?.title ?? refId;
      const hasChange = patch.isDisabled || patch.endMonth || patch.patch;
      if (!hasChange) {
        return;
      }
      const deltaParts = [];
      if (patch.isDisabled) {
        deltaParts.push(translate("planLabAppliedDisabledShort", "已停用"));
      }
      if (patch.patch) {
        deltaParts.push(translate("planLabAppliedEditedShort", "已修改"));
      }
      if (patch.endMonth) {
        deltaParts.push(
          translate(
            "planLabAppliedEndsAt",
            `結束於 ${patch.endMonth}`,
            { month: patch.endMonth }
          )
        );
      }
      const deltaLine =
        deltaParts.join(" · ") || translate("planLabAppliedUpdated", "已更新");
      controls.push({
        id: `event-${refId}`,
        titleLine: title,
        deltaLine,
        label: [title, deltaLine].filter(Boolean).join(" "),
        isEnabled: !patch.isDisabled,
        onToggle: () => updateEventPatch(refId, { isDisabled: !patch.isDisabled }),
        onRemove: () => removePatch("event", refId),
      });
    });

    Object.entries(rulePatches).forEach(([ruleId, patch]) => {
      const item = scenarioItems.find((entry) => entry.ruleId === ruleId);
      const title = item?.title ?? ruleId;
      const hasChange = patch.isDisabled || patch.endMonth || patch.patch;
      if (!hasChange) {
        return;
      }
      const deltaParts = [];
      if (patch.isDisabled) {
        deltaParts.push(translate("planLabAppliedDisabledShort", "已停用"));
      }
      if (patch.patch) {
        deltaParts.push(translate("planLabAppliedEditedShort", "已修改"));
      }
      if (patch.endMonth) {
        deltaParts.push(
          translate(
            "planLabAppliedEndsAt",
            `結束於 ${patch.endMonth}`,
            { month: patch.endMonth }
          )
        );
      }
      const deltaLine =
        deltaParts.join(" · ") || translate("planLabAppliedUpdated", "已更新");
      controls.push({
        id: `rule-${ruleId}`,
        titleLine: title,
        deltaLine,
        label: [title, deltaLine].filter(Boolean).join(" "),
        isEnabled: !patch.isDisabled,
        onToggle: () => updateRulePatch(ruleId, { isDisabled: !patch.isDisabled }),
        onRemove: () => removePatch("rule", ruleId),
      });
    });

    Object.entries(positionPatches).forEach(([key, patch]) => {
      const item = scenarioItems.find((entry) => entry.positionKey === key);
      const title = item?.title ?? key;
      const hasChange = patch.isDisabled || patch.patch;
      if (!hasChange) {
        return;
      }
      const deltaParts = [];
      if (patch.isDisabled) {
        deltaParts.push(translate("planLabAppliedDisabledShort", "已停用"));
      }
      if (patch.patch) {
        deltaParts.push(translate("planLabAppliedEditedShort", "已修改"));
      }
      const deltaLine =
        deltaParts.join(" · ") || translate("planLabAppliedUpdated", "已更新");
      controls.push({
        id: `position-${key}`,
        titleLine: title,
        deltaLine,
        label: [title, deltaLine].filter(Boolean).join(" "),
        isEnabled: !patch.isDisabled,
        onToggle: () => updatePositionPatch(key, { isDisabled: !patch.isDisabled }),
        onRemove: () => removePatch("position", key),
      });
    });

    if (baselineSmartInvestPolicy && smartInvestPatch) {
      const patchedPolicy = applySmartInvestPatch(
        baselineSmartInvestPolicy,
        smartInvestPatch
      );
      const deltaParts: string[] = [];
      if (baselineSmartInvestPolicy.enabled !== patchedPolicy.enabled) {
        deltaParts.push(
          patchedPolicy.enabled
            ? translate("planLabSmartInvestEnabled", "已啟用")
            : translate("planLabSmartInvestDisabled", "已停用")
        );
      }
      if (
        baselineSmartInvestPolicy.reserve.mode !== patchedPolicy.reserve.mode ||
        (patchedPolicy.reserve.mode === "fixed" &&
          baselineSmartInvestPolicy.reserve.mode === "fixed" &&
          baselineSmartInvestPolicy.reserve.amount !== patchedPolicy.reserve.amount) ||
        (patchedPolicy.reserve.mode === "monthsOfOutflow" &&
          baselineSmartInvestPolicy.reserve.mode === "monthsOfOutflow" &&
          baselineSmartInvestPolicy.reserve.months !== patchedPolicy.reserve.months)
      ) {
        deltaParts.push(formatSmartInvestReserveLabel(patchedPolicy.reserve));
      }
      if (
        baselineSmartInvestPolicy.contribution.mode !==
          patchedPolicy.contribution.mode ||
        (patchedPolicy.contribution.mode === "percentOfIncome" &&
          baselineSmartInvestPolicy.contribution.mode === "percentOfIncome" &&
          baselineSmartInvestPolicy.contribution.pct !== patchedPolicy.contribution.pct) ||
        (patchedPolicy.contribution.mode === "percentOfSurplus" &&
          baselineSmartInvestPolicy.contribution.mode === "percentOfSurplus" &&
          baselineSmartInvestPolicy.contribution.pct !== patchedPolicy.contribution.pct) ||
        (patchedPolicy.contribution.mode === "excessCash" &&
          baselineSmartInvestPolicy.contribution.mode === "excessCash" &&
          (baselineSmartInvestPolicy.contribution.investPct !==
            patchedPolicy.contribution.investPct ||
            baselineSmartInvestPolicy.contribution.thresholdAmount !==
              patchedPolicy.contribution.thresholdAmount))
      ) {
        deltaParts.push(
          formatSmartInvestContributionLabel(patchedPolicy.contribution)
        );
      }
      if (
        JSON.stringify(baselineSmartInvestPolicy.allocation) !==
        JSON.stringify(patchedPolicy.allocation)
      ) {
        deltaParts.push(translate("planLabSmartInvestAllocationUpdated", "配置已更新"));
      }
      if (
        baselineSmartInvestPolicy.withdrawal.enabled !== patchedPolicy.withdrawal.enabled
      ) {
        deltaParts.push(
          patchedPolicy.withdrawal.enabled
            ? translate("planLabSmartInvestWithdrawalsEnabled", "已啟用提取")
            : translate("planLabSmartInvestWithdrawalsDisabled", "已停用提取")
        );
      }
      const deltaLine =
        deltaParts.join(" · ") ||
        translate("planLabAppliedUpdated", "已更新");
      controls.push({
        id: "smartInvest-baseline",
        titleLine: smartInvestLabel,
        deltaLine,
        label: [smartInvestLabel, deltaLine].filter(Boolean).join(" "),
        tooltip: smartInvestTooltip,
        isEnabled: patchedPolicy.enabled,
        onToggle: () =>
          updateSmartInvestPatch({ isDisabled: patchedPolicy.enabled }),
        onRemove: () => removePatch("position", "smartInvest"),
      });
    }

    experiments.forEach((experiment) => {
      const currency = scenario.baseCurrency;
      let deltaLine = "";
      const titleLine =
        experimentTypeOptions.find((option) => option.value === experiment.type)?.label ??
        translate("planLabExperimentFallback", "實驗");
      if (experiment.type === "oneOffExpense") {
        deltaLine = translate(
          "planLabAppliedExperimentOneOff",
          `一次性支出 ${formatCurrency(experiment.amount ?? 0, currency, locale)} · ${
            experiment.month ?? ""
          }`,
          {
          month: experiment.month ?? "",
          amount: formatCurrency(experiment.amount ?? 0, currency, locale),
          }
        );
      } else if (experiment.type === "rangeExpense") {
        deltaLine = translate(
          "planLabAppliedExperimentRange",
          `期間支出 ${formatCurrency(
            experiment.monthlyAmount ?? 0,
            currency,
            locale
          )}／月 · ${experiment.startMonth ?? ""} → ${experiment.endMonth ?? ""}`,
          {
          start: experiment.startMonth ?? "",
          end: experiment.endMonth ?? "",
          amount: formatCurrency(experiment.monthlyAmount ?? 0, currency, locale),
          }
        );
      } else if (experiment.type === "homeBuy") {
        deltaLine = translate(
          "planLabAppliedExperimentHomeBuy",
          `置業 · ${experiment.purchaseMonth ?? ""}`,
          {
          month: experiment.purchaseMonth ?? "",
          }
        );
      } else if (experiment.type === "carPlan") {
        deltaLine = translate(
          "planLabAppliedExperimentCarPlan",
          `汽車方案 · ${experiment.purchaseMonth ?? ""}`,
          {
          month: experiment.purchaseMonth ?? "",
          }
        );
      } else if (experiment.type === "incomeAdjust") {
        deltaLine = translate(
          "planLabAppliedExperimentIncome",
          `收入調整 ${formatCurrency(
            experiment.monthlyAmount ?? 0,
            currency,
            locale
          )}／月 · ${experiment.startMonth ?? ""}`,
          {
          month: experiment.startMonth ?? "",
          amount: formatCurrency(experiment.monthlyAmount ?? 0, currency, locale),
          }
        );
      } else if (experiment.type === "travelAnnual") {
        deltaLine = translate(
          "planLabAppliedExperimentTravel",
          `年度旅遊 ${formatCurrency(
            experiment.annualAmount ?? 0,
            currency,
            locale
          )} · ${experiment.startMonth ?? ""}`,
          {
          month: experiment.startMonth ?? "",
          amount: formatCurrency(experiment.annualAmount ?? 0, currency, locale),
          }
        );
      } else {
        const deltaParts: string[] = [];
        if (experiment.reserveMode) {
          deltaParts.push(
            experiment.reserveMode === "fixed"
              ? formatSmartInvestReserveLabel({
                  mode: "fixed",
                  amount: experiment.reserveAmount ?? 0,
                })
              : formatSmartInvestReserveLabel({
                  mode: "monthsOfOutflow",
                  months: experiment.reserveMonths ?? 0,
                })
          );
        }
        if (experiment.contributionMode) {
          if (experiment.contributionMode === "percentOfIncome") {
            deltaParts.push(
              formatSmartInvestContributionLabel({
                mode: "percentOfIncome",
                pct: experiment.contributionPct ?? 0,
              })
            );
          } else if (experiment.contributionMode === "percentOfSurplus") {
            deltaParts.push(
              formatSmartInvestContributionLabel({
                mode: "percentOfSurplus",
                pct: experiment.contributionPct ?? 0,
              })
            );
          } else if (experiment.contributionMode === "excessCash") {
            deltaParts.push(
              formatSmartInvestContributionLabel({
                mode: "excessCash",
                investPct: experiment.contributionInvestPct ?? 100,
                thresholdAmount: experiment.contributionThresholdAmount ?? 0,
              })
            );
          } else {
            deltaParts.push(
              translate("planLabSmartInvestContributionRebalance", "供款再平衡")
            );
          }
        }
        if (experiment.allocation) {
          deltaParts.push(
            translate("planLabSmartInvestAllocationOverride", "配置覆寫")
          );
        }
        if (experiment.withdrawalEnabled !== undefined) {
          deltaParts.push(
            experiment.withdrawalEnabled
              ? translate("planLabSmartInvestWithdrawalsEnabled", "已啟用提取")
              : translate("planLabSmartInvestWithdrawalsDisabled", "已停用提取")
          );
        }
        deltaLine =
          deltaParts.length > 0
            ? deltaParts.join(" · ")
            : translate("planLabAppliedUpdated", "已更新");
      }

      controls.push({
        id: `experiment-${experiment.id}`,
        titleLine,
        deltaLine,
        label: [titleLine, deltaLine].filter(Boolean).join(" "),
        isEnabled: experiment.isEnabled !== false,
        onToggle: () =>
          updateExperiment(experiment.id, {
            isEnabled: experiment.isEnabled === false,
          }),
        onRemove: () => removeExperiment(experiment.id),
      });
    });

    return controls;
  }, [
    baselineSmartInvestPolicy,
    draftBudgetRules,
    draftMembers,
    eventPatches,
    experiments,
    locale,
    positionPatches,
    removeDraftBudgetRule,
    removeDraftMember,
    removeExperiment,
    rulePatches,
    scenario.baseCurrency,
    scenarioItems,
    smartInvestPatch,
    translate,
    updateSmartInvestPatch,
    formatSmartInvestReserveLabel,
    formatSmartInvestContributionLabel,
    smartInvestLabel,
    smartInvestTooltip,
    experimentTypeOptions,
  ]);

  const handleResetAllControls = () => {
    setBaselinePatches({
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
      smartInvestPatch: undefined,
    });
    setExperiments([]);
    setDraftMembers([]);
    setDraftBudgetRules([]);
  };

  const handleResetBaseline = () => {
    setBaselinePatches({
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
      smartInvestPatch: undefined,
    });
  };

  const handleSave = () => {
    setSaveError(null);
    const duplicated = duplicateScenario(scenario.id);
    if (!duplicated) {
      setSaveError(t("planLabSaveFailed"));
      return;
    }
    const sanitizedDuplicate = {
      ...duplicated,
      clientComputed: undefined,
      snapshots: [],
    };
    const result = materializePlanLabDraft(sanitizedDuplicate, planLabDraft, {
      scenarioId: duplicated.id,
      budgetRules,
    });
    if (result.errors.length > 0) {
      setSaveError(t("planLabSaveInvalidMonths"));
      deleteScenario(duplicated.id);
      setActiveScenario(scenario.id);
      return;
    }
    result.eventDefinitions.forEach((definition) => {
      upsertEventDefinition(definition);
    });
    result.budgetRules?.forEach((rule) => {
      updateBudgetRule(rule.id, rule);
    });
    result.addedMembers.forEach((member) => {
      createMember(member);
    });
    result.addedBudgetRules.forEach((rule) => {
      createBudgetRule(rule);
    });
    replaceScenario(result.scenario);
    setActiveScenario(result.scenario.id);
    router.push(`/${locale}${buildScenarioUrl("/dashboard", result.scenario.id)}`);
  };

  const validationMonthFields = useMemo(() => {
    const errors: string[] = [];
    Object.entries(eventPatches).forEach(([refId, patch]) => {
      if (patch.endMonth && !isStrictMonth(patch.endMonth)) {
        errors.push(refId);
      }
    });
    Object.entries(rulePatches).forEach(([ruleId, patch]) => {
      if (patch.endMonth && !isStrictMonth(patch.endMonth)) {
        errors.push(ruleId);
      }
      if (patch.patch?.startMonth && !isStrictMonth(patch.patch.startMonth)) {
        errors.push(ruleId);
      }
      if (patch.patch?.endMonth && !isStrictMonth(patch.patch.endMonth)) {
        errors.push(ruleId);
      }
    });
    draftBudgetRules.forEach((rule) => {
      if (rule.startMonth && !isStrictMonth(rule.startMonth)) {
        errors.push(rule.id);
      }
      if (rule.endMonth && !isStrictMonth(rule.endMonth)) {
        errors.push(rule.id);
      }
    });
    draftMembers.forEach((member) => {
      if (member.birthMonth && !isStrictMonth(member.birthMonth)) {
        errors.push(member.id);
      }
    });
    return errors;
  }, [draftBudgetRules, draftMembers, eventPatches, rulePatches]);

  const saveWarnings = [
    ...(validationMonthFields.length > 0 ? [t("planLabSaveInvalidMonths")] : []),
  ];

  const projectionWarningsTitle = translate(
    "planLabProjectionWarningsTitle",
    "預測警示"
  );

  const editingEventData = useMemo(() => {
    if (!editingItem || editingItem.kind !== "event" || !editingItem.eventDefinition) {
      return null;
    }
    const patch = eventPatches[editingItem.eventDefinition.id];
    const patchedDefinition = buildPatchedDefinition(editingItem.eventDefinition, patch);
    const overrides = {
      ...(editingItem.eventOverrides ?? {}),
      ...(patch?.endMonth ? { endMonth: patch.endMonth } : {}),
    };
    const patchedRef = {
      refId: editingItem.eventRefId ?? editingItem.eventDefinition.id,
      enabled: patch?.isDisabled !== undefined ? !patch.isDisabled : editingItem.enabled,
      overrides,
    };
    return buildTimelineEventFromDefinition(patchedDefinition, patchedRef, {
      baseCurrency: scenario.baseCurrency,
      fallbackMonth: scenario.assumptions.baseMonth,
    });
  }, [editingItem, eventPatches, scenario.baseCurrency, scenario.assumptions.baseMonth]);

  useEffect(() => {
    if (!editingItem || editingItem.kind !== "event" || !editingItem.eventDefinitionId) {
      setEventEndMonth("");
      setEventEndMonthError(undefined);
      return;
    }
    const patch = eventPatches[editingItem.eventDefinitionId];
    setEventEndMonth(patch?.endMonth ?? editingItem.eventRule?.endMonth ?? "");
    setEventEndMonthError(undefined);
  }, [editingItem, eventPatches]);

  const [ruleDraft, setRuleDraft] = useState<BudgetRule | null>(null);
  const [ruleBasis, setRuleBasis] = useState<"age" | "month">("age");
  const [ruleStartMonth, setRuleStartMonth] = useState("");
  const [ruleEndMonth, setRuleEndMonth] = useState("");
  const [ruleMonthErrors, setRuleMonthErrors] = useState<{
    startMonth?: string;
    endMonth?: string;
  }>({});
  const [smartInvestDraft, setSmartInvestDraft] = useState<SmartInvestPolicy | null>(
    null
  );
  const [eventEndMonth, setEventEndMonth] = useState("");
  const [eventEndMonthError, setEventEndMonthError] = useState<string | undefined>(
    undefined
  );
  const validitySectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingItem || editingItem.kind !== "rule" || !editingItem.budgetRule) {
      setRuleDraft(null);
      return;
    }
    const baseRule = editingItem.budgetRule;
    const isDraftRule = editingItem.ruleSource === "draft";
    const patch = isDraftRule ? null : rulePatches[baseRule.id];
    const patchedRule = isDraftRule
      ? baseRule
      : {
          ...baseRule,
          ...(patch?.patch ?? {}),
          startMonth: patch?.patch?.startMonth ?? baseRule.startMonth,
          endMonth: patch?.endMonth ?? patch?.patch?.endMonth ?? baseRule.endMonth,
          enabled:
            patch?.isDisabled !== undefined ? !patch.isDisabled : baseRule.enabled,
        };
    setRuleDraft(patchedRule);
    const usesMonth = Boolean(patchedRule.startMonth || patchedRule.endMonth);
    setRuleBasis(usesMonth ? "month" : "age");
    setRuleStartMonth(patchedRule.startMonth ?? "");
    setRuleEndMonth(patchedRule.endMonth ?? "");
    setRuleMonthErrors({});
  }, [editingItem, rulePatches]);

  const [positionDraft, setPositionDraft] = useState<any>(null);
  const [positionErrors, setPositionErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!editingItem || editingItem.kind !== "position" || !editingItem.position) {
      setPositionDraft(null);
      setPositionErrors({});
      return;
    }
    if (editingItem.positionKind === "smartInvest") {
      setPositionDraft(null);
      setPositionErrors({});
      return;
    }
    const patch = editingItem.positionKey ? positionPatches[editingItem.positionKey] : null;
    setPositionDraft({
      ...editingItem.position,
      ...(patch?.patch ?? {}),
    });
    setPositionErrors({});
  }, [editingItem, positionPatches]);

  useEffect(() => {
    if (
      !editingItem ||
      editingItem.kind !== "position" ||
      editingItem.positionKind !== "smartInvest" ||
      !editingItem.position
    ) {
      setSmartInvestDraft(null);
      return;
    }
    setSmartInvestDraft(editingItem.position as SmartInvestPolicy);
  }, [editingItem]);

  useEffect(() => {
    if (!editingItem || !editingFocus) {
      return;
    }
    if (editingFocus === "validity") {
      requestAnimationFrame(() => {
        validitySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [editingFocus, editingItem]);

  const handleRuleSave = () => {
    if (!ruleDraft) {
      return;
    }
    if (ruleBasis === "month") {
      const nextErrors: { startMonth?: string; endMonth?: string } = {};
      if (ruleStartMonth && !parseMonthStrict(ruleStartMonth).ok) {
        nextErrors.startMonth = monthInvalidMessage;
      }
      if (ruleEndMonth && !parseMonthStrict(ruleEndMonth).ok) {
        nextErrors.endMonth = monthInvalidMessage;
      }
      setRuleMonthErrors(nextErrors);
      if (Object.values(nextErrors).some(Boolean)) {
        return;
      }
    }
    const patch: PlanLabRulePatch = {
      patch: {
        name: ruleDraft.name,
        memberId: ruleDraft.memberId,
        category: ruleDraft.category,
        monthlyAmount: ruleDraft.monthlyAmount,
        annualGrowthPct: ruleDraft.annualGrowthPct,
        ageBand: ruleDraft.ageBand,
        startMonth: ruleBasis === "month" ? ruleStartMonth || undefined : undefined,
        endMonth: ruleBasis === "month" ? ruleEndMonth || undefined : undefined,
      },
    };
    if (editingItem?.ruleSource === "draft") {
      const nextRule: BudgetRule = {
        ...ruleDraft,
        ...patch.patch,
      };
      setDraftBudgetRules((current) => {
        const exists = current.some((rule) => rule.id === nextRule.id);
        if (exists) {
          return current.map((rule) => (rule.id === nextRule.id ? nextRule : rule));
        }
        return [...current, nextRule];
      });
    } else {
      updateRulePatch(ruleDraft.id, patch);
    }
    setEditingItem(null);
  };

  const handlePositionSave = () => {
    if (!positionDraft || !editingItem?.positionKey) {
      return;
    }
    const nextErrors = { ...positionErrors };
    ["startMonth", "endMonth", "asOfMonth"].forEach((field) => {
      const value = positionDraft?.[field];
      if (value && !parseMonthStrict(String(value)).ok) {
        nextErrors[field] = monthInvalidMessage;
      }
    });
    setPositionErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }
    updatePositionPatch(editingItem.positionKey, { patch: positionDraft });
    setEditingItem(null);
  };

  const handleSmartInvestSave = () => {
    if (!smartInvestDraft) {
      return;
    }
    updateSmartInvestPatch({
      patch: smartInvestDraft,
      isDisabled: !smartInvestDraft.enabled,
    });
    setEditingItem(null);
  };

  const handleEventSave = (result: TimelineEventFormResult) => {
    if (!editingItem?.eventDefinitionId) {
      return;
    }
    if (eventEndMonth && !parseMonthStrict(eventEndMonth).ok) {
      setEventEndMonthError(monthInvalidMessage);
      return;
    }
    const definition = buildDefinitionFromTimelineEvent(result.event);
    const nextDefinition: EventDefinition = {
      ...definition,
      rule: {
        ...definition.rule,
        mode: result.ruleMode ?? "params",
        schedule: result.ruleMode === "schedule" ? result.schedule : undefined,
        salarySteps: result.salarySteps,
      },
    };
    updateEventPatch(editingItem.eventDefinitionId, {
      patch: nextDefinition,
      endMonth: eventEndMonth || undefined,
    });
    setEditingItem(null);
  };

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs" align="center">
              <Title order={3}>{t("planLabTitle")}</Title>
              <Badge color="blue" variant="light">
                {t("planLabPreviewBadge")}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {t("planLabSubtitle")}
            </Text>
          </Stack>
          <Button size="sm" variant="light" onClick={handleSave}>
            {t("planLabSave")}
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="md" padding="sm">
        <Text size="sm">{t("planLabSandboxBanner")}</Text>
      </Card>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="xs">
            <Paper withBorder radius="lg" p="md">
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <MantineTooltip
                    label={translate(
                      "planLabScenarioEditorTooltip",
                      "調整基準情境的事件、規則與資產，這些改動只在此沙盒生效。"
                    )}
                    withArrow
                  >
                    <Text fw={600}>
                      {translate("planLabScenarioEditor", "情境編輯器")}
                    </Text>
                  </MantineTooltip>
                  <Group gap="xs" wrap="wrap">
                    <Button size="xs" variant="light" onClick={openAddMemberDrawer}>
                      {translate("planLabAddMemberAction", "新增成員")}
                    </Button>
                    <Button size="xs" variant="light" onClick={() => openAddRuleDrawer()}>
                      {translate("planLabAddRuleAction", "新增規則")}
                    </Button>
                  </Group>
                </Group>
                <Stack gap="xs">
                  <Group align="flex-end" wrap="wrap">
                    <TextInput
                      size="sm"
                      label={translate("planLabSearchLabel", "搜尋")}
                      placeholder={translate("planLabSearchPlaceholder", "搜尋項目")}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.currentTarget.value)}
                      style={{ flex: 1, minWidth: 220 }}
                    />
                    <Group gap="xs" wrap="wrap">
                      <MantineTooltip
                        label={translate(
                          "planLabFilterActiveTooltip",
                          "只顯示已啟用的項目。"
                        )}
                        withArrow
                      >
                        <Switch
                          size="sm"
                          label={translate("planLabFilterActiveLabel", "只顯示啟用")}
                          checked={activeOnly}
                          onChange={(event) => setActiveOnly(event.currentTarget.checked)}
                        />
                      </MantineTooltip>
                      <MantineTooltip
                        label={translate(
                          "planLabFilterChangedTooltip",
                          "只顯示已修改或停用的項目。"
                        )}
                        withArrow
                      >
                        <Switch
                          size="sm"
                          label={translate("planLabFilterChangedLabel", "只顯示已變更")}
                          checked={showChangedOnly}
                          onChange={(event) => setShowChangedOnly(event.currentTarget.checked)}
                        />
                      </MantineTooltip>
                      <MantineTooltip
                        label={translate(
                          "planLabFilterRiskyTooltip",
                          "只顯示可能影響風險的項目（如房屋）。"
                        )}
                        withArrow
                      >
                        <Switch
                          size="sm"
                          label={translate("planLabFilterRiskyLabel", "只顯示高風險")}
                          checked={showRiskyOnly}
                          onChange={(event) => setShowRiskyOnly(event.currentTarget.checked)}
                        />
                      </MantineTooltip>
                    </Group>
                  </Group>
                  <SegmentedControl
                    size="sm"
                    data={[
                      { value: "all", label: translate("planLabFilterAllLabel", "全部") },
                      {
                        value: "positions",
                        label: translate("planLabFilterPositionsLabel", "資產"),
                      },
                      { value: "events", label: translate("planLabFilterEventsLabel", "事件") },
                      { value: "rules", label: translate("planLabFilterRulesLabel", "規則") },
                    ]}
                    value={filterKind}
                    onChange={(value) => setFilterKind(value as typeof filterKind)}
                  />
                  <SegmentedControl
                    size="sm"
                    data={[
                      { value: "category", label: translate("planLabGroupCategoryLabel", "分類") },
                      { value: "member", label: translate("planLabGroupMemberLabel", "成員") },
                      { value: "timeline", label: translate("planLabGroupTimelineLabel", "時間") },
                    ]}
                    value={groupBy}
                    onChange={(value) => setGroupBy(value as typeof groupBy)}
                  />
                </Stack>
                {groupedItems.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {translate("planLabFilterEmpty", "沒有符合條件的項目。")}
                  </Text>
                ) : (
                  <ScrollArea.Autosize mah={420} offsetScrollbars>
                    <Stack gap="xs">
                      {groupedItems.map(([group, items]) => (
                        <Stack key={group} gap="xs">
                          <Text size="xs" fw={600} c="dimmed">
                            {group}
                          </Text>
                          <Accordion variant="separated" radius="md" multiple>
                            {items.map((item) => {
                              const menuItems: PlanLabRowMenuItem[] = [];
                              if (item.kind === "event" || item.kind === "rule") {
                                menuItems.push({
                                  label: translate("planLabActionEnd", "設定結束月份"),
                                  onClick: () => openEditingItem(item, "validity"),
                                });
                              }
                              if (item.kind === "rule" && item.ruleSource === "draft") {
                                menuItems.push({
                                  label: translate("planLabAppliedRemove", "移除"),
                                  onClick: () => removeDraftBudgetRule(item.ruleId ?? item.id),
                                });
                              }
                              return (
                                <PlanLabAccordionRow
                                  key={item.id}
                                  id={item.id}
                                  title={item.title}
                                  badges={getScenarioItemBadges(item)}
                                  summary={getScenarioItemSummary(item)}
                                  enabled={item.enabled}
                                  onToggle={() => {
                                    if (item.kind === "event" && item.eventDefinitionId) {
                                      updateEventPatch(item.eventDefinitionId, {
                                        isDisabled: item.enabled,
                                      });
                                    }
                                    if (item.kind === "rule" && item.ruleId) {
                                      if (item.ruleSource === "draft") {
                                        setDraftBudgetRules((current) =>
                                          current.map((rule) =>
                                            rule.id === item.ruleId
                                              ? { ...rule, enabled: !rule.enabled }
                                              : rule
                                          )
                                        );
                                      } else {
                                        updateRulePatch(item.ruleId, {
                                          isDisabled: item.enabled,
                                        });
                                      }
                                    }
                                    if (item.kind === "position" && item.positionKey) {
                                      if (item.positionKind === "smartInvest") {
                                        updateSmartInvestPatch({ isDisabled: item.enabled });
                                      } else {
                                        updatePositionPatch(item.positionKey, {
                                          isDisabled: item.enabled,
                                        });
                                      }
                                    }
                                  }}
                                  onEdit={() => openEditingItem(item)}
                                  menuItems={menuItems}
                                  panel={
                                    <Text size="xs" c="dimmed">
                                      {getScenarioItemSummary(item) || "—"}
                                    </Text>
                                  }
                                />
                              );
                            })}
                          </Accordion>
                        </Stack>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="lg" p="md">
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <MantineTooltip
                    label={translate(
                      "planLabExperimentsTooltip",
                      "新增假設來觀察財務走勢變化。"
                    )}
                    withArrow
                  >
                    <Text fw={600}>{t("planLabExperimentsTitle")}</Text>
                  </MantineTooltip>
                  <Button size="sm" onClick={openAddExperimentDrawer}>
                    {translate("planLabExperimentsAddAction", "新增實驗")}
                  </Button>
                </Group>
                {experiments.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("planLabExperimentsEmpty")}
                  </Text>
                ) : (
                  <ScrollArea.Autosize mah={320} offsetScrollbars>
                    <Accordion variant="separated" radius="md" multiple>
                      {experiments.map((experiment) => {
                        const label =
                          experimentTypeOptions.find(
                            (option) => option.value === experiment.type
                          )?.label ?? translate("planLabExperimentFallback", "實驗");
                        const badges: PlanLabRowBadge[] = [
                          { label: translate("planLabBadgeExperiment", "實驗"), color: "blue" },
                        ];
                        if (experiment.isEnabled === false) {
                          badges.push({
                            label: translate("planLabBadgeDisabled", "已停用"),
                            color: "red",
                          });
                        }
                        const menuItems: PlanLabRowMenuItem[] = [
                          {
                            label: translate("planLabActionDuplicate", "複製"),
                            onClick: () => duplicateExperiment(experiment),
                          },
                          {
                            label: translate("planLabAppliedRemove", "移除"),
                            onClick: () => removeExperiment(experiment.id),
                          },
                        ];
                        return (
                          <PlanLabAccordionRow
                            key={experiment.id}
                            id={`experiment-${experiment.id}`}
                            title={label}
                            badges={badges}
                            summary={getExperimentSummary(experiment)}
                            enabled={experiment.isEnabled !== false}
                            onToggle={() =>
                              updateExperiment(experiment.id, {
                                isEnabled: experiment.isEnabled === false,
                              })
                            }
                            onEdit={() => openEditExperimentDrawer(experiment)}
                            menuItems={menuItems}
                            panel={
                              <Text size="xs" c="dimmed">
                                {getExperimentSummary(experiment)}
                              </Text>
                            }
                          />
                        );
                      })}
                    </Accordion>
                  </ScrollArea.Autosize>
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="lg" p="md">
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <MantineTooltip
                    label={translate(
                      "planLabAppliedControlsTooltip",
                      "快速檢視目前啟用的改動，並可逐一關閉。"
                    )}
                    withArrow
                  >
                    <Text fw={600}>
                      {t("planLabAppliedControlsTitle")} ({appliedControls.length})
                    </Text>
                  </MantineTooltip>
                  <Group gap="xs" wrap="wrap">
                    <Switch
                      size="xs"
                      label={translate("planLabFilterChangedLabel", "只看已修改")}
                      checked={showChangedOnly}
                      onChange={(event) => setShowChangedOnly(event.currentTarget.checked)}
                    />
                    <Button size="xs" variant="light" onClick={handleResetBaseline}>
                      {translate("planLabAppliedRevertBaseline", "還原基準調整")}
                    </Button>
                    <Button size="xs" variant="light" onClick={handleResetAllControls}>
                      {translate("planLabAppliedResetAll", "全部重設")}
                    </Button>
                  </Group>
                </Group>
                {appliedControls.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("planLabAppliedControlsEmpty")}
                  </Text>
                ) : (
                  <ScrollArea.Autosize mah={180} offsetScrollbars>
                    <Group gap="xs" wrap="wrap">
                      {appliedControls.map((control) => {
                        const chip = (
                          <Badge
                            key={control.id}
                            size="sm"
                            radius="xl"
                            variant="light"
                            color={control.isEnabled ? "blue" : "gray"}
                            rightSection={
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  control.onRemove();
                                }}
                              >
                                <Text size="xs">×</Text>
                              </ActionIcon>
                            }
                          >
                            {control.label}
                          </Badge>
                        );
                        if (control.tooltip) {
                          return (
                            <MantineTooltip key={control.id} label={control.tooltip} withArrow>
                              {chip}
                            </MantineTooltip>
                          );
                        }
                        return chip;
                      })}
                    </Group>
                  </ScrollArea.Autosize>
                )}
              </Stack>
            </Paper>

            <Card withBorder radius="md" padding="md">
              <Stack gap="xs">
                <WarningsPanel
                  warnings={planLabProjection.projectionWarnings}
                  title={projectionWarningsTitle}
                  defaultOpen={false}
                />
                <Text fw={600}>{t("planLabWarningsTitle")}</Text>
                {saveWarnings.length === 0 && !saveError && (
                  <Text size="sm" c="dimmed">
                    {t("planLabWarningsPlaceholder")}
                  </Text>
                )}
                {saveWarnings.map((warning) => (
                  <Text key={warning} size="sm" c="orange">
                    {warning}
                  </Text>
                ))}
                {saveError && (
                  <Text size="sm" c="red">
                    {saveError}
                  </Text>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <div style={{ position: "sticky", top: 88 }}>
            <Stack gap="lg">
              <Card withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Text fw={600}>{t("planLabScorecardTitle")}</Text>
                  <Stack gap="xs">
                    <Text fw={600}>{t("planLabScorecardFirstBucketTitle")}</Text>
                    <NumberInput
                      label={t("planLabScorecardTargetAmount")}
                      value={firstBucketTargetAmount}
                      min={0}
                      onChange={(value) =>
                        setFirstBucketTargetAmount(typeof value === "number" ? value : "")
                      }
                    />
                    {firstBucketTargetValue === null ? (
                      <Text size="sm" c="dimmed">
                        {t("planLabScorecardTargetPrompt")}
                      </Text>
                    ) : !planLabProjection.projection ? (
                      <Text size="sm" c="dimmed">
                        {t("planLabScorecardDisabled")}
                      </Text>
                    ) : (
                      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                        <Card withBorder radius="md" padding="sm">
                          <Stack gap={4}>
                            <Text size="sm" fw={600}>
                              {t("planLabScorecardAchievedMonth")}
                            </Text>
                            {firstBucketResult?.achievedMonth ? (
                              <Text size="sm">
                                {t("monthLabel", {
                                  month: firstBucketResult.achievedMonth,
                                })}
                              </Text>
                            ) : (
                              <Text size="sm" c="dimmed">
                                {t("planLabScorecardTargetNotReached")}
                              </Text>
                            )}
                          </Stack>
                        </Card>
                        <Card withBorder radius="md" padding="sm">
                          <Stack gap={4}>
                            <Text size="sm" fw={600}>
                              {t("planLabScorecardMinCash")}
                            </Text>
                            {firstBucketResult?.achievedMonth ? (
                              <>
                                <Text size="sm">
                                  {formatCurrency(
                                    firstBucketResult.minCash.value,
                                    scenario.baseCurrency,
                                    locale
                                  )}
                                </Text>
                                {firstBucketResult.minCash.month && (
                                  <Text size="xs" c="dimmed">
                                    {t("monthLabel", {
                                      month: firstBucketResult.minCash.month,
                                    })}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text size="sm" c="dimmed">
                                {t("planLabScorecardValueUnavailable")}
                              </Text>
                            )}
                          </Stack>
                        </Card>
                        <Card withBorder radius="md" padding="sm">
                          <Stack gap={4}>
                            <Text size="sm" fw={600}>
                              {t("planLabScorecardDeltaLabel")}
                            </Text>
                            {firstBucketDeltaMonths === null ? (
                              <Text size="sm" c="dimmed">
                                {t("planLabScorecardDeltaUnavailable")}
                              </Text>
                            ) : firstBucketDeltaMonths === 0 ? (
                              <Text size="sm">{t("planLabScorecardDeltaSame")}</Text>
                            ) : firstBucketDeltaMonths > 0 ? (
                              <Text size="sm">
                                {t("planLabScorecardDeltaFaster", {
                                  months: firstBucketDeltaMonths,
                                })}
                              </Text>
                            ) : (
                              <Text size="sm">
                                {t("planLabScorecardDeltaSlower", {
                                  months: Math.abs(firstBucketDeltaMonths),
                                })}
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      </SimpleGrid>
                    )}
                  </Stack>
                </Stack>
              </Card>

              {cashRiskScorecard && (
                <PlanLabCashRiskScorecard
                  result={cashRiskScorecard}
                  baseCurrency={scenario.baseCurrency}
                  locale={locale}
                />
              )}

              <Card withBorder radius="md" padding="md">
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
                        <RechartsTooltip
                          formatter={(value) =>
                            formatCurrency(Number(value), undefined, locale)
                          }
                          labelFormatter={(label) => t("monthLabel", { month: label })}
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
              </Card>
            </Stack>
          </div>
        </Grid.Col>
      </Grid>

      <Drawer
        opened={memberDrawerOpen}
        onClose={() => setMemberDrawerOpen(false)}
        position="right"
        size="lg"
        title={translate("planLabMemberDrawerTitle", "新增成員")}
      >
        {memberDraft && (
          <Stack gap="sm">
            <TextInput
              label={translate("planLabMemberNameLabel", "名稱")}
              value={memberDraft.name}
              error={memberDraftErrors.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setMemberDraft((current) =>
                  current ? { ...current, name: value } : current
                );
                setMemberDraftErrors((current) => ({ ...current, name: undefined }));
              }}
            />
            <Select
              label={translate("planLabMemberKindLabel", "類型")}
              data={[
                { value: "person", label: translate("planLabMemberKindPerson", "人") },
                { value: "pet", label: translate("planLabMemberKindPet", "寵物") },
              ]}
              value={memberDraft.kind}
              onChange={(value) =>
                setMemberDraft((current) =>
                  current
                    ? { ...current, kind: (value as ScenarioMemberKind) ?? "person" }
                    : current
                )
              }
            />
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <TextInput
                label={translate("planLabMemberBirthMonthLabel", "出生月份")}
                placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                value={memberDraft.birthMonth}
                error={
                  memberDraftErrors.birthMonth ??
                  (memberDraft.birthMonth
                    ? getMonthError(memberDraft.birthMonth, monthInvalidMessage)
                    : undefined)
                }
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setMemberDraft((current) =>
                    current ? { ...current, birthMonth: value } : current
                  );
                  setMemberDraftErrors((current) => ({
                    ...current,
                    birthMonth: undefined,
                  }));
                }}
              />
              <NumberInput
                label={translate("planLabMemberAgeLabel", "基準月年齡")}
                value={memberDraft.ageAtBaseMonth}
                min={0}
                onChange={(value) =>
                  setMemberDraft((current) =>
                    current
                      ? {
                          ...current,
                          ageAtBaseMonth: typeof value === "number" ? value : "",
                        }
                      : current
                  )
                }
              />
            </SimpleGrid>
            {isChildDraft && childTemplateOptions.length > 0 && (
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  {translate("planLabChildTemplatesTitle", "育兒/教育預設規則")}
                </Text>
                {childTemplateOptions.map((template, index) => (
                  <Checkbox
                    key={`child-template-${index}`}
                    label={template.name}
                    checked={childTemplateSelections[String(index)] ?? false}
                    onChange={(event) =>
                      setChildTemplateSelections((current) => ({
                        ...current,
                        [String(index)]: event.currentTarget.checked,
                      }))
                    }
                  />
                ))}
              </Stack>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setMemberDrawerOpen(false)}>
                {translate("planLabActionCancel", "取消")}
              </Button>
              <Button onClick={handleMemberSave}>
                {translate("planLabActionAddMember", "新增成員")}
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>

      <Drawer
        opened={experimentDrawerOpen}
        onClose={() => setExperimentDrawerOpen(false)}
        position="right"
        size="md"
        title={
          experimentDrawerMode === "add"
            ? translate("planLabExperimentDrawerAddTitle", "新增實驗")
            : translate("planLabExperimentDrawerEditTitle", "編輯實驗")
        }
      >
        <Stack gap="md">
          {experimentDrawerMode === "add" && (
            <Stack gap="sm">
              <Text fw={600}>
                {translate("planLabExperimentTypeSelect", "選擇實驗類型")}
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                {experimentTypeCards.map((card) => {
                  const isActive = experimentDraft?.type === card.type;
                  return (
                    <Paper
                      key={card.type}
                      withBorder
                      radius="md"
                      p="sm"
                      onClick={() => {
                        setExperimentDraft(buildExperimentDefaults(card.type));
                        setExperimentDraftErrors({});
                      }}
                      style={{
                        cursor: "pointer",
                        borderColor: isActive ? "var(--mantine-color-blue-6)" : undefined,
                        backgroundColor: isActive
                          ? "var(--mantine-color-blue-light)"
                          : undefined,
                      }}
                    >
                      <Text fw={600} size="sm">
                        {card.label}
                      </Text>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Stack>
          )}

          {!experimentDraft && (
            <Text size="sm" c="dimmed">
              {translate("planLabExperimentTypeHint", "請先選擇實驗類型。")}
            </Text>
          )}

          {experimentDraft && (
            <Stack gap="sm">
              <Text fw={600}>{translate("planLabDrawerSectionBasic", "基本")}</Text>
              {experimentDraft.type === "oneOffExpense" && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.month ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ month: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({ ...current, month: undefined }));
                    }}
                    error={experimentDraftErrors.month}
                  />
                  <NumberInput
                    size="sm"
                    label={t("planLabExperimentAmount")}
                    value={experimentDraft.amount ?? ""}
                    min={0}
                    onChange={(value) =>
                      updateExperimentDraft({
                        amount: typeof value === "number" ? value : undefined,
                      })
                    }
                  />
                </SimpleGrid>
              )}

              {experimentDraft.type === "rangeExpense" && (
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentStartMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.startMonth ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ startMonth: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({
                        ...current,
                        startMonth: undefined,
                      }));
                    }}
                    error={experimentDraftErrors.startMonth}
                  />
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentEndMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.endMonth ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ endMonth: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({ ...current, endMonth: undefined }));
                    }}
                    error={experimentDraftErrors.endMonth}
                  />
                  <NumberInput
                    size="sm"
                    label={t("planLabExperimentMonthlyAmount")}
                    value={experimentDraft.monthlyAmount ?? ""}
                    min={0}
                    onChange={(value) =>
                      updateExperimentDraft({
                        monthlyAmount: typeof value === "number" ? value : undefined,
                      })
                    }
                  />
                </SimpleGrid>
              )}

              {experimentDraft.type === "homeBuy" && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentPurchaseMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.purchaseMonth ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ purchaseMonth: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({
                        ...current,
                        purchaseMonth: undefined,
                      }));
                    }}
                    error={experimentDraftErrors.purchaseMonth}
                  />
                  <NumberInput
                    size="sm"
                    label={t("planLabExperimentPurchasePrice")}
                    value={experimentDraft.purchasePrice ?? ""}
                    min={0}
                    onChange={(value) =>
                      updateExperimentDraft({
                        purchasePrice: typeof value === "number" ? value : undefined,
                      })
                    }
                  />
                </SimpleGrid>
              )}

              {experimentDraft.type === "carPlan" && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentPurchaseMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.purchaseMonth ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ purchaseMonth: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({
                        ...current,
                        purchaseMonth: undefined,
                      }));
                    }}
                    error={experimentDraftErrors.purchaseMonth}
                  />
                  <NumberInput
                    size="sm"
                    label={t("planLabExperimentCarPrice")}
                    value={experimentDraft.purchasePrice ?? ""}
                    min={0}
                    onChange={(value) =>
                      updateExperimentDraft({
                        purchasePrice: typeof value === "number" ? value : undefined,
                      })
                    }
                  />
                </SimpleGrid>
              )}

              {experimentDraft.type === "incomeAdjust" && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentStartMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.startMonth ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ startMonth: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({
                        ...current,
                        startMonth: undefined,
                      }));
                    }}
                    error={experimentDraftErrors.startMonth}
                  />
                  <NumberInput
                    size="sm"
                    label={t("planLabExperimentMonthlyAmount")}
                    value={experimentDraft.monthlyAmount ?? ""}
                    min={0}
                    onChange={(value) =>
                      updateExperimentDraft({
                        monthlyAmount: typeof value === "number" ? value : undefined,
                      })
                    }
                  />
                </SimpleGrid>
              )}

              {experimentDraft.type === "travelAnnual" && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    size="sm"
                    label={t("planLabExperimentStartMonth")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={experimentDraft.startMonth ?? ""}
                    onChange={(event) => {
                      updateExperimentDraft({ startMonth: event.currentTarget.value });
                      setExperimentDraftErrors((current) => ({
                        ...current,
                        startMonth: undefined,
                      }));
                    }}
                    error={experimentDraftErrors.startMonth}
                  />
                  <NumberInput
                    size="sm"
                    label={t("planLabExperimentAnnualAmount")}
                    value={experimentDraft.annualAmount ?? ""}
                    min={0}
                    onChange={(value) =>
                      updateExperimentDraft({
                        annualAmount: typeof value === "number" ? value : undefined,
                      })
                    }
                  />
                </SimpleGrid>
              )}

              {experimentDraft.type === "smartInvestAdjust" && (
                <Text size="sm" c="dimmed">
                  {translate(
                    "planLabExperimentSmartInvestHint",
                    "智能投資調整請先建立實驗，再於詳情中調整。"
                  )}
                </Text>
              )}
            </Stack>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setExperimentDrawerOpen(false)}>
              {translate("planLabActionCancel", "取消")}
            </Button>
            <Button onClick={applyExperimentDraft} disabled={!experimentDraft}>
              {translate("planLabActionApply", "套用")}
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={Boolean(editingItem)}
        onClose={() => {
          setEditingItem(null);
          setEditingFocus(null);
          setRuleMonthErrors({});
          setEventEndMonthError(undefined);
        }}
        position="right"
        size="lg"
        title={
          editingItem
            ? translate(
                "planLabDrawerEditTitle",
                `編輯 ${editingItem.title}`,
                { title: editingItem.title }
              )
            : translate("planLabDrawerEditTitleFallback", "編輯")
        }
      >
        {editingItem?.kind === "event" && editingEventData && (
          <Stack gap="sm">
            <Stack gap="xs" ref={validitySectionRef}>
              <Text fw={600} size="sm">
                {translate("planLabDrawerSectionValidity", "有效期限")}
              </Text>
              <TextInput
                size="sm"
                label={translate("planLabEventEndMonthLabel", "結束月份")}
                placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                value={eventEndMonth}
                onChange={(event) => {
                  setEventEndMonth(event.currentTarget.value);
                  setEventEndMonthError(undefined);
                }}
                error={
                  eventEndMonthError ??
                  (eventEndMonth ? getMonthError(eventEndMonth, monthInvalidMessage) : undefined)
                }
              />
            </Stack>
            <TimelineEventForm
              event={editingEventData}
              baseCurrency={scenario.baseCurrency}
              members={combinedMembers}
              assumptions={{
                baseMonth: scenario.assumptions.baseMonth,
                horizonMonths: scenario.assumptions.horizonMonths,
              }}
              ruleMode={editingItem.eventRule?.mode ?? "params"}
              schedule={editingItem.eventRule?.schedule}
              salarySteps={editingItem.eventRule?.salarySteps}
              onCancel={() => setEditingItem(null)}
              onSave={handleEventSave}
              submitLabel={translate("planLabActionApply", "套用")}
            />
          </Stack>
        )}

        {editingItem?.kind === "rule" && ruleDraft && (
          <Stack gap="sm">
            <Text fw={600} size="sm">
              {translate("planLabDrawerSectionBasic", "基本")}
            </Text>
            <TextInput
              label={translate("planLabRuleNameLabel", "名稱")}
              value={ruleDraft.name}
              onChange={(event) =>
                setRuleDraft((current) =>
                  current ? { ...current, name: event.currentTarget.value } : current
                )
              }
            />
            <Select
              label={translate("planLabRuleMemberLabel", "成員")}
              data={[
                {
                  value: "",
                  label: translate("planLabRuleMemberAllOption", "全部"),
                },
                ...scenarioMembers.map((member) => ({
                  value: member.id,
                  label: member.name,
                })),
              ]}
              value={ruleDraft.memberId ?? ""}
              onChange={(value) =>
                setRuleDraft((current) =>
                  current ? { ...current, memberId: value || undefined } : current
                )
              }
            />
            <Select
              label={translate("planLabRuleCategoryLabel", "分類")}
              data={[
                {
                  value: "health",
                  label: translate("planLabRuleCategoryHealth", "健康"),
                },
                {
                  value: "baseline",
                  label: translate("planLabRuleCategoryBaseline", "基準"),
                },
                {
                  value: "childcare",
                  label: translate("planLabRuleCategoryChildcare", "育兒"),
                },
                {
                  value: "education",
                  label: translate("planLabRuleCategoryEducation", "教育"),
                },
                {
                  value: "eldercare",
                  label: translate("planLabRuleCategoryEldercare", "長者照顧"),
                },
                {
                  value: "petcare",
                  label: translate("planLabRuleCategoryPetcare", "寵物照顧"),
                },
              ]}
              value={ruleDraft.category}
              onChange={(value) =>
                setRuleDraft((current) =>
                  current ? { ...current, category: value as BudgetRule["category"] } : current
                )
              }
            />
            <Text fw={600} size="sm">
              {translate("planLabDrawerSectionAmount", "金額與頻率")}
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <NumberInput
                label={translate("planLabRuleMonthlyAmountLabel", "每月金額")}
                value={ruleDraft.monthlyAmount}
                min={0}
                onChange={(value) =>
                  setRuleDraft((current) =>
                    current
                      ? {
                          ...current,
                          monthlyAmount: typeof value === "number" ? value : current.monthlyAmount,
                        }
                      : current
                  )
                }
              />
              <NumberInput
                label={translate("planLabRuleAnnualGrowthLabel", "年增長率 %")}
                value={ruleDraft.annualGrowthPct ?? ""}
                min={0}
                decimalScale={2}
                onChange={(value) =>
                  setRuleDraft((current) =>
                    current
                      ? {
                          ...current,
                          annualGrowthPct: typeof value === "number" ? value : undefined,
                        }
                      : current
                  )
                }
              />
            </SimpleGrid>
            <Stack gap="xs" ref={validitySectionRef}>
              <Text fw={600} size="sm">
                {translate("planLabDrawerSectionValidity", "有效期限")}
              </Text>
              <SegmentedControl
                data={[
                  { value: "age", label: translate("planLabRuleAgeBandLabel", "年齡區間") },
                  { value: "month", label: translate("planLabRuleMonthRangeLabel", "月份範圍") },
                ]}
                value={ruleBasis}
                onChange={(value) => {
                  setRuleBasis(value as "age" | "month");
                  setRuleMonthErrors({});
                }}
              />
              {ruleBasis === "age" ? (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <NumberInput
                    label={translate("planLabRuleAgeFromLabel", "起始年齡")}
                    value={ruleDraft.ageBand.fromYears}
                    min={0}
                    onChange={(value) =>
                      setRuleDraft((current) =>
                        current
                          ? {
                              ...current,
                              ageBand: {
                                ...current.ageBand,
                                fromYears:
                                  typeof value === "number" ? value : current.ageBand.fromYears,
                              },
                            }
                          : current
                      )
                    }
                  />
                  <NumberInput
                    label={translate("planLabRuleAgeToLabel", "結束年齡")}
                    value={ruleDraft.ageBand.toYears}
                    min={0}
                    onChange={(value) =>
                      setRuleDraft((current) =>
                        current
                          ? {
                              ...current,
                              ageBand: {
                                ...current.ageBand,
                                toYears:
                                  typeof value === "number" ? value : current.ageBand.toYears,
                              },
                            }
                          : current
                      )
                    }
                  />
                </SimpleGrid>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <TextInput
                    label={translate("planLabRuleStartMonthLabel", "開始月份")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={ruleStartMonth}
                    onChange={(event) => {
                      setRuleStartMonth(event.currentTarget.value);
                      setRuleMonthErrors((current) => ({ ...current, startMonth: undefined }));
                    }}
                    error={
                      ruleMonthErrors.startMonth ??
                      (ruleStartMonth ? getMonthError(ruleStartMonth, monthInvalidMessage) : undefined)
                    }
                  />
                  <TextInput
                    label={translate("planLabRuleEndMonthLabel", "結束月份")}
                    placeholder={translate("planLabMonthPlaceholder", "YYYY-MM")}
                    value={ruleEndMonth}
                    onChange={(event) => {
                      setRuleEndMonth(event.currentTarget.value);
                      setRuleMonthErrors((current) => ({ ...current, endMonth: undefined }));
                    }}
                    error={
                      ruleMonthErrors.endMonth ??
                      (ruleEndMonth ? getMonthError(ruleEndMonth, monthInvalidMessage) : undefined)
                    }
                  />
                </SimpleGrid>
              )}
            </Stack>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditingItem(null)}>
                {translate("planLabActionCancel", "取消")}
              </Button>
              <Button onClick={handleRuleSave}>
                {translate("planLabActionApply", "套用")}
              </Button>
            </Group>
          </Stack>
        )}

        {editingItem?.kind === "position" &&
          editingItem.positionKind === "smartInvest" &&
          smartInvestDraft && (
            <Stack gap="sm">
              <SmartInvestForm
                policy={smartInvestDraft}
                onChange={setSmartInvestDraft}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setEditingItem(null)}>
                  {translate("planLabActionCancel", "取消")}
                </Button>
                <Button onClick={handleSmartInvestSave}>
                  {translate("planLabActionApply", "套用")}
                </Button>
              </Group>
            </Stack>
          )}

        {editingItem?.kind === "position" && positionDraft && (
          <Stack gap="sm">
            {editingItem.positionKind === "home" && (
              <>
                <TextInput
                  label={translate("planLabPositionPurchaseMonthLabel", "購買月份")}
                  value={positionDraft.purchaseMonth ?? ""}
                  disabled
                />
                <NumberInput
                  label={translate("planLabPositionPurchasePriceLabel", "購買價格")}
                  value={positionDraft.purchasePrice ?? ""}
                  disabled
                />
                <NumberInput
                  label={translate("planLabPositionHoldingCostLabel", "每月持有成本")}
                  value={positionDraft.holdingCostMonthly ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      holdingCostMonthly: typeof value === "number" ? value : current.holdingCostMonthly,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionAppreciationLabel", "年升值率 %")}
                  value={positionDraft.annualAppreciationPct ?? ""}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      annualAppreciationPct:
                        typeof value === "number" ? value : current.annualAppreciationPct,
                    }))
                  }
                />
              </>
            )}
            {editingItem.positionKind === "car" && (
              <>
                <TextInput
                  label={translate("planLabPositionPurchaseMonthLabel", "購買月份")}
                  value={positionDraft.purchaseMonth ?? ""}
                  disabled
                />
                <NumberInput
                  label={translate("planLabPositionCarHoldingCostLabel", "每月持有成本")}
                  value={positionDraft.holdingCostMonthly ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      holdingCostMonthly: typeof value === "number" ? value : current.holdingCostMonthly,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionCarHoldingGrowthLabel", "持有成本增長 %")}
                  value={positionDraft.holdingCostAnnualGrowthPct ?? ""}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      holdingCostAnnualGrowthPct:
                        typeof value === "number" ? value : current.holdingCostAnnualGrowthPct,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionCarDepreciationLabel", "年折舊率 %")}
                  value={positionDraft.annualDepreciationRatePct ?? ""}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      annualDepreciationRatePct:
                        typeof value === "number" ? value : current.annualDepreciationRatePct,
                    }))
                  }
                />
              </>
            )}
            {editingItem.positionKind === "investment" && (
              <>
                <Stack gap="xs" ref={validitySectionRef}>
                  <Text fw={600} size="sm">
                    {translate("planLabDrawerSectionValidity", "有效期限")}
                  </Text>
                  <TextInput
                    label={translate("planLabPositionStartMonthLabel", "開始月份")}
                    value={positionDraft.startMonth ?? ""}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setPositionDraft((current: any) => ({ ...current, startMonth: nextValue }));
                      setPositionErrors((current) => ({
                        ...current,
                        startMonth: getMonthError(nextValue, monthInvalidMessage),
                      }));
                    }}
                    error={positionErrors.startMonth}
                  />
                </Stack>
                <Text fw={600} size="sm">
                  {translate("planLabDrawerSectionAmount", "金額與頻率")}
                </Text>
                <NumberInput
                  label={translate("planLabPositionInitialValueLabel", "初始金額")}
                  value={positionDraft.initialValue ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      initialValue: typeof value === "number" ? value : current.initialValue,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionMonthlyContributionLabel", "每月供款")}
                  value={positionDraft.monthlyContribution ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      monthlyContribution:
                        typeof value === "number" ? value : current.monthlyContribution,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionMonthlyWithdrawalLabel", "每月提取")}
                  value={positionDraft.monthlyWithdrawal ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      monthlyWithdrawal:
                        typeof value === "number" ? value : current.monthlyWithdrawal,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionReturnLabel", "預期年回報率 %")}
                  value={positionDraft.expectedAnnualReturnPct ?? ""}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      expectedAnnualReturnPct:
                        typeof value === "number" ? value : current.expectedAnnualReturnPct,
                    }))
                  }
                />
              </>
            )}
            {editingItem.positionKind === "insurance" && (
              <>
                <Stack gap="xs" ref={validitySectionRef}>
                  <Text fw={600} size="sm">
                    {translate("planLabDrawerSectionValidity", "有效期限")}
                  </Text>
                  <TextInput
                    label={translate("planLabPositionStartMonthLabel", "開始月份")}
                    value={positionDraft.startMonth ?? ""}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setPositionDraft((current: any) => ({ ...current, startMonth: nextValue }));
                      setPositionErrors((current) => ({
                        ...current,
                        startMonth: getMonthError(nextValue, monthInvalidMessage),
                      }));
                    }}
                    error={positionErrors.startMonth}
                  />
                  <TextInput
                    label={translate("planLabPositionEndMonthLabel", "結束月份")}
                    value={positionDraft.endMonth ?? ""}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setPositionDraft((current: any) => ({ ...current, endMonth: nextValue }));
                      setPositionErrors((current) => ({
                        ...current,
                        endMonth: getMonthError(nextValue, monthInvalidMessage),
                      }));
                    }}
                    error={positionErrors.endMonth}
                  />
                </Stack>
                <Text fw={600} size="sm">
                  {translate("planLabDrawerSectionAmount", "金額與頻率")}
                </Text>
                <NumberInput
                  label={translate("planLabPositionPremiumMonthlyLabel", "每月保費")}
                  value={positionDraft.premiumMonthly ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      premiumMonthly:
                        typeof value === "number" ? value : current.premiumMonthly,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionPremiumGrowthLabel", "保費增長 %")}
                  value={positionDraft.premiumAnnualGrowthPct ?? ""}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      premiumAnnualGrowthPct:
                        typeof value === "number" ? value : current.premiumAnnualGrowthPct,
                    }))
                  }
                />
              </>
            )}
            {editingItem.positionKind === "loan" && (
              <>
                <Stack gap="xs" ref={validitySectionRef}>
                  <Text fw={600} size="sm">
                    {translate("planLabDrawerSectionValidity", "有效期限")}
                  </Text>
                  <TextInput
                    label={translate("planLabPositionStartMonthLabel", "開始月份")}
                    value={positionDraft.startMonth ?? ""}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setPositionDraft((current: any) => ({ ...current, startMonth: nextValue }));
                      setPositionErrors((current) => ({
                        ...current,
                        startMonth: getMonthError(nextValue, monthInvalidMessage),
                      }));
                    }}
                    error={positionErrors.startMonth}
                  />
                </Stack>
                <Text fw={600} size="sm">
                  {translate("planLabDrawerSectionAmount", "金額與頻率")}
                </Text>
                <NumberInput
                  label={translate("planLabPositionPrincipalLabel", "本金")}
                  value={positionDraft.principal ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      principal: typeof value === "number" ? value : current.principal,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionInterestRateLabel", "年利率 %")}
                  value={positionDraft.annualInterestRatePct ?? ""}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      annualInterestRatePct:
                        typeof value === "number" ? value : current.annualInterestRatePct,
                    }))
                  }
                />
                <NumberInput
                  label={translate("planLabPositionTermYearsLabel", "年期（年）")}
                  value={positionDraft.termYears ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      termYears: typeof value === "number" ? value : current.termYears,
                    }))
                  }
                />
              </>
            )}
            {editingItem.positionKind === "cash" && (
              <>
                <Stack gap="xs" ref={validitySectionRef}>
                  <Text fw={600} size="sm">
                    {translate("planLabDrawerSectionValidity", "有效期限")}
                  </Text>
                  <TextInput
                    label={translate("planLabPositionAsOfMonthLabel", "月份")}
                    value={positionDraft.asOfMonth ?? ""}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setPositionDraft((current: any) => ({ ...current, asOfMonth: nextValue }));
                      setPositionErrors((current) => ({
                        ...current,
                        asOfMonth: getMonthError(nextValue, monthInvalidMessage),
                      }));
                    }}
                    error={positionErrors.asOfMonth}
                  />
                </Stack>
                <Text fw={600} size="sm">
                  {translate("planLabDrawerSectionAmount", "金額與頻率")}
                </Text>
                <NumberInput
                  label={translate("planLabPositionBalanceLabel", "餘額")}
                  value={positionDraft.balance ?? ""}
                  min={0}
                  onChange={(value) =>
                    setPositionDraft((current: any) => ({
                      ...current,
                      balance: typeof value === "number" ? value : current.balance,
                    }))
                  }
                />
              </>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditingItem(null)}>
                {translate("planLabActionCancel", "取消")}
              </Button>
              <Button onClick={handlePositionSave}>
                {translate("planLabActionApply", "套用")}
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
