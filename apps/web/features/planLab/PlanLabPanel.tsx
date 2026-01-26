"use client";

import {
  Badge,
  Button,
  Card,
  Drawer,
  Grid,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
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
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { useScenarioStore } from "../../src/store/scenarioStore";
import { applyPlanLabDraftToScenario } from "../../src/domain/planLab/applyPlanLabDraftToScenario";
import { normalizeMonthInput, normalizeMonthStrict } from "../../src/utils/month";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import type { TimeSeriesPoint } from "../overview/types";
import WarningsPanel from "../../components/WarningsPanel";
import { computeFirstBucket } from "../../src/domain/planLab/computeFirstBucket";
import { buildScenarioEventViews, buildTimelineEventFromDefinition, buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import TimelineEventForm, { type TimelineEventFormResult } from "../../components/timeline/TimelineEventForm";
import { getEventMeta } from "../../src/events/eventCatalog";


type ChartType = "netWorth" | "cash" | "netCashflow";

type ScenarioItemKind = "event" | "rule" | "position";

type PositionKind = "home" | "car" | "investment" | "insurance" | "loan" | "cash";

type ScenarioEditorItem = {
  id: string;
  kind: ScenarioItemKind;
  title: string;
  category: string;
  memberId?: string | null;
  startMonth?: string;
  endMonth?: string | null;
  enabled: boolean;
  risky?: boolean;
  eventRefId?: string;
  eventDefinitionId?: string;
  ruleId?: string;
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

const isStrictMonth = (value: string) => normalizeMonthStrict(value).ok;

const getGroupLabel = (groupBy: string, item: ScenarioEditorItem, members: ScenarioMember[]) => {
  if (groupBy === "member") {
    if (!item.memberId) {
      return "Unassigned";
    }
    return members.find((member) => member.id === item.memberId)?.name ?? "Unassigned";
  }
  if (groupBy === "timeline") {
    return item.startMonth ?? "No date";
  }
  return item.category;
};

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

const buildPositionTitle = (kind: PositionKind, position: any, index: number) => {
  if (kind === "home") {
    return position?.name ?? "Home";
  }
  if (kind === "car") {
    return position?.name ?? `Car ${index + 1}`;
  }
  if (kind === "investment") {
    return position?.name ?? `Investment ${index + 1}`;
  }
  if (kind === "insurance") {
    return position?.name ?? `Insurance ${index + 1}`;
  }
  if (kind === "loan") {
    return position?.name ?? `Loan ${index + 1}`;
  }
  if (kind === "cash") {
    return position?.name ?? `Cash bucket ${index + 1}`;
  }
  return `Position ${index + 1}`;
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
  const router = useRouter();
  const duplicateScenario = useScenarioStore((state) => state.duplicateScenario);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const upsertEventDefinition = useScenarioStore((state) => state.upsertEventDefinition);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);

  const [chartType, setChartType] = useState<ChartType>("netWorth");
  const [baselinePatches, setBaselinePatches] = useState<PlanLabDraft["baselinePatches"]>({
    eventPatches: {},
    rulePatches: {},
    positionPatches: {},
  });
  const [experiments, setExperiments] = useState<PlanLabExperiment[]>([]);
  const [newExperimentType, setNewExperimentType] =
    useState<PlanLabExperimentType | null>(null);
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

  const monthInvalidMessage = t("planLabMonthInvalid");

  const eventPatches = baselinePatches?.eventPatches ?? {};
  const rulePatches = baselinePatches?.rulePatches ?? {};
  const positionPatches = baselinePatches?.positionPatches ?? {};

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
      const next = { ...(current.positionPatches ?? {}) };
      delete next[id];
      return { ...current, positionPatches: next };
    });
  };

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
    return {
      id: nanoid(),
      type: "travelAnnual",
      startMonth: baseMonth,
      annualAmount: 20000,
      isEnabled: true,
    };
  };

  const addExperiment = () => {
    if (!newExperimentType) {
      return;
    }
    setExperiments((current) => [...current, buildExperimentDefaults(newExperimentType)]);
    setNewExperimentType(null);
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

  const scenarioItems = useMemo<ScenarioEditorItem[]>(() => {
    const items: ScenarioEditorItem[] = [];
    const eventViews = buildScenarioEventViews(scenario, eventLibrary);
    eventViews.forEach((view) => {
      const patch = eventPatches[view.definition.id];
      const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : view.ref.enabled;
      const category = eventTypeLabel(view.definition);
      const title = view.definition.title;
      const rule = view.rule;
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

    budgetRules.forEach((rule) => {
      const patch = rulePatches[rule.id];
      const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : rule.enabled;
      items.push({
        id: `rule:${rule.id}`,
        kind: "rule",
        title: rule.name,
        category: rule.category,
        memberId: rule.memberId ?? null,
        startMonth: patch?.endMonth ? rule.startMonth : rule.startMonth,
        endMonth: patch?.endMonth ?? rule.endMonth ?? null,
        enabled: isEnabled,
        ruleId: rule.id,
        budgetRule: rule,
      });
    });

    const positions = scenario.positions;
    if (positions?.home) {
      const key = "home:primary";
      const patch = positionPatches[key];
      const isEnabled = patch?.isDisabled !== undefined ? !patch.isDisabled : true;
      items.push({
        id: `position:${key}`,
        kind: "position",
        title: positions.home.name ?? "Home",
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
          title: buildPositionTitle("home", home, index),
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
          title: buildPositionTitle("car", car, index),
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
          title: buildPositionTitle("investment", investment, index),
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
          title: buildPositionTitle("insurance", insurance, index),
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
          title: buildPositionTitle("loan", loan, index),
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
          title: buildPositionTitle("cash", bucket, index),
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
    budgetRules,
    eventLibrary,
    eventPatches,
    positionPatches,
    rulePatches,
    scenario,
  ]);

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
          const patch = rulePatches[item.ruleId];
          if (!patch || (!patch.isDisabled && !patch.endMonth && !patch.patch)) {
            return false;
          }
        }
        if (item.kind === "position" && item.positionKey) {
          const patch = positionPatches[item.positionKey];
          if (!patch || (!patch.isDisabled && !patch.patch)) {
            return false;
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
  ]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ScenarioEditorItem[]>();
    filteredItems.forEach((item) => {
      const groupKey = getGroupLabel(groupBy, item, members);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems, groupBy, members]);

  const planLabDraft: PlanLabDraft = useMemo(
    () => ({
      baselinePatches,
      experiments,
      scorecardSettings: {
        firstBucketTargetAmount:
          typeof firstBucketTargetAmount === "number" ? firstBucketTargetAmount : undefined,
      },
    }),
    [baselinePatches, experiments, firstBucketTargetAmount]
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

  const experimentTypeOptions = useMemo(
    () => [
      {
        value: "oneOffExpense",
        label: t.has("planLabExperimentOneOff")
          ? t("planLabExperimentOneOff")
          : "One-off expense",
      },
      {
        value: "rangeExpense",
        label: t.has("planLabExperimentRange")
          ? t("planLabExperimentRange")
          : "Range expense",
      },
      {
        value: "homeBuy",
        label: t.has("planLabExperimentHomeBuy")
          ? t("planLabExperimentHomeBuy")
          : "Home buy",
      },
      {
        value: "carPlan",
        label: t.has("planLabExperimentCarPlan")
          ? t("planLabExperimentCarPlan")
          : "Car plan",
      },
      {
        value: "incomeAdjust",
        label: t.has("planLabExperimentIncomeAdjust")
          ? t("planLabExperimentIncomeAdjust")
          : "Income adjust",
      },
      {
        value: "travelAnnual",
        label: t.has("planLabExperimentTravelAnnual")
          ? t("planLabExperimentTravelAnnual")
          : "Annual travel",
      },
    ],
    [t]
  );

  const appliedControls = useMemo(() => {
    const controls: Array<{
      id: string;
      label: string;
      isEnabled: boolean;
      onToggle: () => void;
      onRemove: () => void;
    }> = [];

    Object.entries(eventPatches).forEach(([refId, patch]) => {
      const item = scenarioItems.find((entry) => entry.eventDefinitionId === refId);
      const title = item?.title ?? refId;
      const hasChange = patch.isDisabled || patch.endMonth || patch.patch;
      if (!hasChange) {
        return;
      }
      const labelParts = [];
      if (patch.isDisabled) {
        labelParts.push(`Disabled ${title}`);
      }
      if (patch.patch) {
        labelParts.push(`Edited ${title}`);
      }
      if (patch.endMonth) {
        labelParts.push(`Ends ${title} at ${patch.endMonth}`);
      }
      controls.push({
        id: `event-${refId}`,
        label: labelParts.join(" · ") || `Updated ${title}`,
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
      const labelParts = [];
      if (patch.isDisabled) {
        labelParts.push(`Disabled ${title}`);
      }
      if (patch.patch) {
        labelParts.push(`Edited ${title}`);
      }
      if (patch.endMonth) {
        labelParts.push(`Ends ${title} at ${patch.endMonth}`);
      }
      controls.push({
        id: `rule-${ruleId}`,
        label: labelParts.join(" · ") || `Updated ${title}`,
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
      const labelParts = [];
      if (patch.isDisabled) {
        labelParts.push(`Disabled ${title}`);
      }
      if (patch.patch) {
        labelParts.push(`Edited ${title}`);
      }
      controls.push({
        id: `position-${key}`,
        label: labelParts.join(" · ") || `Updated ${title}`,
        isEnabled: !patch.isDisabled,
        onToggle: () => updatePositionPatch(key, { isDisabled: !patch.isDisabled }),
        onRemove: () => removePatch("position", key),
      });
    });

    experiments.forEach((experiment) => {
      const currency = scenario.baseCurrency;
      let label = "";
      if (experiment.type === "oneOffExpense") {
        label = t("planLabAppliedExperimentOneOff", {
          month: experiment.month ?? "",
          amount: formatCurrency(experiment.amount ?? 0, currency, locale),
        });
      } else if (experiment.type === "rangeExpense") {
        label = t("planLabAppliedExperimentRange", {
          start: experiment.startMonth ?? "",
          end: experiment.endMonth ?? "",
          amount: formatCurrency(experiment.monthlyAmount ?? 0, currency, locale),
        });
      } else if (experiment.type === "homeBuy") {
        label = t("planLabAppliedExperimentHomeBuy", {
          month: experiment.purchaseMonth ?? "",
        });
      } else if (experiment.type === "carPlan") {
        label = t("planLabAppliedExperimentCarPlan", {
          month: experiment.purchaseMonth ?? "",
        });
      } else if (experiment.type === "incomeAdjust") {
        label = t("planLabAppliedExperimentIncome", {
          month: experiment.startMonth ?? "",
          amount: formatCurrency(experiment.monthlyAmount ?? 0, currency, locale),
        });
      } else {
        label = t("planLabAppliedExperimentTravel", {
          month: experiment.startMonth ?? "",
          amount: formatCurrency(experiment.annualAmount ?? 0, currency, locale),
        });
      }

      controls.push({
        id: `experiment-${experiment.id}`,
        label,
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
    eventPatches,
    experiments,
    locale,
    positionPatches,
    removeExperiment,
    rulePatches,
    scenario.baseCurrency,
    scenarioItems,
    t,
  ]);

  const handleResetAllControls = () => {
    setBaselinePatches({ eventPatches: {}, rulePatches: {}, positionPatches: {} });
    setExperiments([]);
  };

  const handleResetBaseline = () => {
    setBaselinePatches({ eventPatches: {}, rulePatches: {}, positionPatches: {} });
  };

  const getStrictMonthError = (value: string) => {
    if (!value) {
      return t("planLabMonthRequired");
    }
    if (!isStrictMonth(value)) {
      return monthInvalidMessage;
    }
    return undefined;
  };

  const handleSave = () => {
    setSaveError(null);
    const validation = applyPlanLabDraftToScenario(scenario, planLabDraft, {
      scenarioId: scenario.id,
      budgetRules,
    });
    if (validation.errors.length > 0) {
      setSaveError(t("planLabSaveInvalidMonths"));
      return;
    }
    const duplicated = duplicateScenario(scenario.id);
    if (!duplicated) {
      setSaveError(t("planLabSaveFailed"));
      return;
    }
    const result = applyPlanLabDraftToScenario(duplicated, planLabDraft, {
      scenarioId: duplicated.id,
      budgetRules,
    });
    if (result.errors.length > 0) {
      setSaveError(t("planLabSaveInvalidMonths"));
      return;
    }
    result.eventDefinitions.forEach((definition) => {
      upsertEventDefinition(definition);
    });
    result.budgetRules?.forEach((rule) => {
      updateBudgetRule(rule.id, rule);
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
    return errors;
  }, [eventPatches, rulePatches]);

  const saveWarnings = [
    ...(validationMonthFields.length > 0 ? [t("planLabSaveInvalidMonths")] : []),
  ];

  const projectionWarningsTitle = t.has("planLabProjectionWarningsTitle")
    ? t("planLabProjectionWarningsTitle")
    : "Projection warnings";

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

  const [ruleDraft, setRuleDraft] = useState<BudgetRule | null>(null);
  const [ruleBasis, setRuleBasis] = useState<"age" | "month">("age");
  const [ruleStartMonth, setRuleStartMonth] = useState("");
  const [ruleEndMonth, setRuleEndMonth] = useState("");

  useEffect(() => {
    if (!editingItem || editingItem.kind !== "rule" || !editingItem.budgetRule) {
      setRuleDraft(null);
      return;
    }
    const baseRule = editingItem.budgetRule;
    const patch = rulePatches[baseRule.id];
    const patchedRule = {
      ...baseRule,
      ...(patch?.patch ?? {}),
      startMonth: patch?.patch?.startMonth ?? baseRule.startMonth,
      endMonth: patch?.endMonth ?? patch?.patch?.endMonth ?? baseRule.endMonth,
      enabled: patch?.isDisabled !== undefined ? !patch.isDisabled : baseRule.enabled,
    };
    setRuleDraft(patchedRule);
    const usesMonth = Boolean(patchedRule.startMonth || patchedRule.endMonth);
    setRuleBasis(usesMonth ? "month" : "age");
    setRuleStartMonth(patchedRule.startMonth ?? "");
    setRuleEndMonth(patchedRule.endMonth ?? "");
  }, [editingItem, rulePatches]);

  const [positionDraft, setPositionDraft] = useState<any>(null);
  const [positionErrors, setPositionErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!editingItem || editingItem.kind !== "position" || !editingItem.position) {
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

  const handleRuleSave = () => {
    if (!ruleDraft) {
      return;
    }
    if (ruleBasis === "month") {
      const startError = ruleStartMonth ? getMonthError(ruleStartMonth, monthInvalidMessage) : undefined;
      const endError = ruleEndMonth ? getMonthError(ruleEndMonth, monthInvalidMessage) : undefined;
      if (startError || endError) {
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
    updateRulePatch(ruleDraft.id, patch);
    setEditingItem(null);
  };

  const handlePositionSave = () => {
    if (!positionDraft || !editingItem?.positionKey) {
      return;
    }
    if (positionErrors && Object.values(positionErrors).some(Boolean)) {
      return;
    }
    updatePositionPatch(editingItem.positionKey, { patch: positionDraft });
    setEditingItem(null);
  };

  const handleEventSave = (result: TimelineEventFormResult) => {
    if (!editingItem?.eventDefinitionId) {
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
      endMonth: undefined,
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
          <Stack gap="lg">
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Text fw={600}>Scenario Editor</Text>
                  <Group gap="xs">
                    <Switch
                      size="sm"
                      label="Active only"
                      checked={activeOnly}
                      onChange={(event) => setActiveOnly(event.currentTarget.checked)}
                    />
                    <Switch
                      size="sm"
                      label="Has changes"
                      checked={showChangedOnly}
                      onChange={(event) => setShowChangedOnly(event.currentTarget.checked)}
                    />
                    <Switch
                      size="sm"
                      label="Risky"
                      checked={showRiskyOnly}
                      onChange={(event) => setShowRiskyOnly(event.currentTarget.checked)}
                    />
                  </Group>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <TextInput
                    label="Search"
                    placeholder="Search items"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  />
                  <SegmentedControl
                    data={[
                      { value: "all", label: "All" },
                      { value: "positions", label: "Positions" },
                      { value: "events", label: "Events" },
                      { value: "rules", label: "Rules" },
                    ]}
                    value={filterKind}
                    onChange={(value) => setFilterKind(value as typeof filterKind)}
                  />
                  <SegmentedControl
                    data={[
                      { value: "category", label: "Category" },
                      { value: "member", label: "Member" },
                      { value: "timeline", label: "Timeline" },
                    ]}
                    value={groupBy}
                    onChange={(value) => setGroupBy(value as typeof groupBy)}
                  />
                </SimpleGrid>
                {groupedItems.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No items match the filters.
                  </Text>
                ) : (
                  groupedItems.map(([group, items]) => (
                    <Stack key={group} gap="xs">
                      <Text size="sm" fw={600} c="dimmed">
                        {group}
                      </Text>
                      {items.map((item) => (
                        <Card key={item.id} withBorder radius="md" padding="sm">
                          <Group justify="space-between" align="center" wrap="wrap">
                            <Stack gap={2}>
                              <Text fw={600} size="sm">
                                {item.title}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {item.startMonth ?? "—"}
                                {item.endMonth ? ` → ${item.endMonth}` : ""}
                              </Text>
                            </Stack>
                            <Group gap="xs">
                              <Switch
                                size="sm"
                                checked={item.enabled}
                                onChange={() => {
                                  if (item.kind === "event" && item.eventDefinitionId) {
                                    updateEventPatch(item.eventDefinitionId, {
                                      isDisabled: item.enabled,
                                    });
                                  }
                                  if (item.kind === "rule" && item.ruleId) {
                                    updateRulePatch(item.ruleId, {
                                      isDisabled: item.enabled,
                                    });
                                  }
                                  if (item.kind === "position" && item.positionKey) {
                                    updatePositionPatch(item.positionKey, {
                                      isDisabled: item.enabled,
                                    });
                                  }
                                }}
                              />
                              {(item.kind === "event" || item.kind === "rule") && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => setEditingItem(item)}
                                >
                                  End
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="subtle"
                                onClick={() => setEditingItem(item)}
                              >
                                Edit
                              </Button>
                            </Group>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  ))
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="lg">
                <Text fw={600}>{t("planLabExperimentsTitle")}</Text>
                <Group align="flex-end" wrap="wrap">
                  <Select
                    label={t("planLabExperimentsAddLabel")}
                    placeholder={t("planLabExperimentsSelectPlaceholder")}
                    data={experimentTypeOptions}
                    value={newExperimentType}
                    onChange={(value) =>
                      setNewExperimentType(value as PlanLabExperimentType | null)
                    }
                    clearable
                  />
                  <Button
                    size="sm"
                    variant="light"
                    onClick={addExperiment}
                    disabled={!newExperimentType}
                  >
                    {t("planLabExperimentsAddAction")}
                  </Button>
                </Group>
                {experiments.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("planLabExperimentsEmpty")}
                  </Text>
                ) : (
                  <Stack gap="md">
                    {experiments.map((experiment) => {
                      const monthError =
                        experiment.type === "oneOffExpense"
                          ? getStrictMonthError(experiment.month ?? "")
                          : experiment.type === "rangeExpense"
                            ? getStrictMonthError(experiment.startMonth ?? "")
                            : experiment.type === "incomeAdjust"
                              ? getStrictMonthError(experiment.startMonth ?? "")
                              : experiment.type === "travelAnnual"
                                ? getStrictMonthError(experiment.startMonth ?? "")
                                : experiment.type === "homeBuy"
                                  ? getStrictMonthError(experiment.purchaseMonth ?? "")
                                  : getStrictMonthError(experiment.purchaseMonth ?? "");
                      const endMonthError =
                        experiment.type === "rangeExpense"
                          ? getStrictMonthError(experiment.endMonth ?? "")
                          : undefined;
                      return (
                        <Card key={experiment.id} withBorder radius="md" padding="sm">
                          <Stack gap="sm">
                            <Group justify="space-between" align="center" wrap="wrap">
                              <Text fw={600} size="sm">
                                {
                                  experimentTypeOptions.find(
                                    (option) => option.value === experiment.type
                                  )?.label
                                }
                              </Text>
                              <Group gap="xs">
                                <Switch
                                  size="sm"
                                  checked={experiment.isEnabled !== false}
                                  onChange={() =>
                                    updateExperiment(experiment.id, {
                                      isEnabled: experiment.isEnabled === false,
                                    })
                                  }
                                />
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  onClick={() => removeExperiment(experiment.id)}
                                >
                                  {t("planLabAppliedRemove")}
                                </Button>
                              </Group>
                            </Group>

                            {experiment.type === "oneOffExpense" && (
                              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                                <TextInput
                                  label={t("planLabExperimentMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.month ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      month: event.currentTarget.value,
                                    })
                                  }
                                  error={monthError}
                                />
                                <NumberInput
                                  label={t("planLabExperimentAmount")}
                                  value={experiment.amount ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      amount: typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </SimpleGrid>
                            )}

                            {experiment.type === "rangeExpense" && (
                              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                                <TextInput
                                  label={t("planLabExperimentStartMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.startMonth ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      startMonth: event.currentTarget.value,
                                    })
                                  }
                                  error={monthError}
                                />
                                <TextInput
                                  label={t("planLabExperimentEndMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.endMonth ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      endMonth: event.currentTarget.value,
                                    })
                                  }
                                  error={endMonthError}
                                />
                                <NumberInput
                                  label={t("planLabExperimentMonthlyAmount")}
                                  value={experiment.monthlyAmount ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      monthlyAmount:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </SimpleGrid>
                            )}

                            {experiment.type === "homeBuy" && (
                              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                                <TextInput
                                  label={t("planLabExperimentPurchaseMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.purchaseMonth ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      purchaseMonth: event.currentTarget.value,
                                    })
                                  }
                                  error={monthError}
                                />
                                <NumberInput
                                  label={t("planLabExperimentPurchasePrice")}
                                  value={experiment.purchasePrice ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      purchasePrice:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentDownPaymentAmount")}
                                  value={experiment.downPaymentAmount ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      downPaymentAmount:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentDownPaymentPct")}
                                  value={experiment.downPaymentPct ?? ""}
                                  min={0}
                                  max={100}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      downPaymentPct:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentMortgageRate")}
                                  value={experiment.mortgageRatePct ?? ""}
                                  min={0}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      mortgageRatePct:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentMortgageTerm")}
                                  value={experiment.termYears ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      termYears:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentOneOffFees")}
                                  value={experiment.oneTimeFees ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      oneTimeFees:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentHoldingCost")}
                                  value={experiment.holdingCostMonthly ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      holdingCostMonthly:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentAppreciation")}
                                  value={experiment.annualAppreciationPct ?? ""}
                                  min={0}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      annualAppreciationPct:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </SimpleGrid>
                            )}

                            {experiment.type === "carPlan" && (
                              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                                <TextInput
                                  label={t("planLabExperimentPurchaseMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.purchaseMonth ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      purchaseMonth: event.currentTarget.value,
                                    })
                                  }
                                  error={monthError}
                                />
                                <NumberInput
                                  label={t("planLabExperimentCarPrice")}
                                  value={experiment.purchasePrice ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      purchasePrice:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentCarDownPayment")}
                                  value={experiment.downPayment ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      downPayment:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentCarDepreciation")}
                                  value={experiment.annualDepreciationRatePct ?? ""}
                                  min={0}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      annualDepreciationRatePct:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentCarHoldingCost")}
                                  value={experiment.holdingCostMonthly ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      holdingCostMonthly:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                                <NumberInput
                                  label={t("planLabExperimentCarHoldingGrowth")}
                                  value={experiment.holdingCostAnnualGrowthPct ?? ""}
                                  min={0}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      holdingCostAnnualGrowthPct:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </SimpleGrid>
                            )}

                            {experiment.type === "incomeAdjust" && (
                              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                                <TextInput
                                  label={t("planLabExperimentStartMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.startMonth ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      startMonth: event.currentTarget.value,
                                    })
                                  }
                                  error={monthError}
                                />
                                <NumberInput
                                  label={t("planLabExperimentMonthlyAmount")}
                                  value={experiment.monthlyAmount ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      monthlyAmount:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </SimpleGrid>
                            )}

                            {experiment.type === "travelAnnual" && (
                              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                                <TextInput
                                  label={t("planLabExperimentStartMonth")}
                                  placeholder="YYYY-MM"
                                  value={experiment.startMonth ?? ""}
                                  onChange={(event) =>
                                    updateExperiment(experiment.id, {
                                      startMonth: event.currentTarget.value,
                                    })
                                  }
                                  error={monthError}
                                />
                                <NumberInput
                                  label={t("planLabExperimentAnnualAmount")}
                                  value={experiment.annualAmount ?? ""}
                                  min={0}
                                  onChange={(value) =>
                                    updateExperiment(experiment.id, {
                                      annualAmount:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </SimpleGrid>
                            )}
                          </Stack>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Text fw={600}>Applied Controls</Text>
                  <Group gap="xs">
                    <Button size="xs" variant="light" onClick={handleResetBaseline}>
                      Reset baseline edits
                    </Button>
                    <Button size="xs" variant="light" onClick={handleResetAllControls}>
                      Reset all
                    </Button>
                  </Group>
                </Group>
                {appliedControls.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("planLabAppliedControlsEmpty")}
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {appliedControls.map((control) => (
                      <Group key={control.id} justify="space-between" align="center">
                        <Text size="sm">{control.label}</Text>
                        <Group gap="xs">
                          <Switch
                            size="sm"
                            checked={control.isEnabled}
                            onChange={control.onToggle}
                          />
                          <Button size="xs" variant="subtle" onClick={control.onRemove}>
                            {t("planLabAppliedRemove")}
                          </Button>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>

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
                        <Tooltip
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
        opened={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        position="right"
        size="lg"
        title={editingItem ? `Edit ${editingItem.title}` : "Edit"}
      >
        {editingItem?.kind === "event" && editingEventData && (
          <TimelineEventForm
            event={editingEventData}
            baseCurrency={scenario.baseCurrency}
            members={members}
            assumptions={{
              baseMonth: scenario.assumptions.baseMonth,
              horizonMonths: scenario.assumptions.horizonMonths,
            }}
            ruleMode={editingItem.eventRule?.mode ?? "params"}
            schedule={editingItem.eventRule?.schedule}
            salarySteps={editingItem.eventRule?.salarySteps}
            onCancel={() => setEditingItem(null)}
            onSave={handleEventSave}
            submitLabel="Apply"
          />
        )}

        {editingItem?.kind === "rule" && ruleDraft && (
          <Stack gap="sm">
            <TextInput
              label="Name"
              value={ruleDraft.name}
              onChange={(event) =>
                setRuleDraft((current) =>
                  current ? { ...current, name: event.currentTarget.value } : current
                )
              }
            />
            <Select
              label="Member"
              data={[{ value: "", label: "All" }, ...members.map((member) => ({ value: member.id, label: member.name }))]}
              value={ruleDraft.memberId ?? ""}
              onChange={(value) =>
                setRuleDraft((current) =>
                  current ? { ...current, memberId: value || undefined } : current
                )
              }
            />
            <Select
              label="Category"
              data={[
                { value: "health", label: "Health" },
                { value: "baseline", label: "Baseline" },
                { value: "childcare", label: "Childcare" },
                { value: "education", label: "Education" },
                { value: "eldercare", label: "Eldercare" },
                { value: "petcare", label: "Petcare" },
              ]}
              value={ruleDraft.category}
              onChange={(value) =>
                setRuleDraft((current) =>
                  current ? { ...current, category: value as BudgetRule["category"] } : current
                )
              }
            />
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <NumberInput
                label="Monthly amount"
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
                label="Annual growth %"
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
            <SegmentedControl
              data={[
                { value: "age", label: "Age band" },
                { value: "month", label: "Month range" },
              ]}
              value={ruleBasis}
              onChange={(value) => setRuleBasis(value as "age" | "month")}
            />
            {ruleBasis === "age" ? (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                <NumberInput
                  label="Age from"
                  value={ruleDraft.ageBand.fromYears}
                  min={0}
                  onChange={(value) =>
                    setRuleDraft((current) =>
                      current
                        ? {
                            ...current,
                            ageBand: {
                              ...current.ageBand,
                              fromYears: typeof value === "number" ? value : current.ageBand.fromYears,
                            },
                          }
                        : current
                    )
                  }
                />
                <NumberInput
                  label="Age to"
                  value={ruleDraft.ageBand.toYears}
                  min={0}
                  onChange={(value) =>
                    setRuleDraft((current) =>
                      current
                        ? {
                            ...current,
                            ageBand: {
                              ...current.ageBand,
                              toYears: typeof value === "number" ? value : current.ageBand.toYears,
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
                  label="Start month"
                  placeholder="YYYY-MM"
                  value={ruleStartMonth}
                  onChange={(event) => setRuleStartMonth(event.currentTarget.value)}
                  error={ruleStartMonth ? getMonthError(ruleStartMonth, monthInvalidMessage) : undefined}
                />
                <TextInput
                  label="End month"
                  placeholder="YYYY-MM"
                  value={ruleEndMonth}
                  onChange={(event) => setRuleEndMonth(event.currentTarget.value)}
                  error={ruleEndMonth ? getMonthError(ruleEndMonth, monthInvalidMessage) : undefined}
                />
              </SimpleGrid>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button onClick={handleRuleSave}>Apply</Button>
            </Group>
          </Stack>
        )}

        {editingItem?.kind === "position" && positionDraft && (
          <Stack gap="sm">
            {editingItem.positionKind === "home" && (
              <>
                <TextInput
                  label="Purchase month"
                  value={positionDraft.purchaseMonth ?? ""}
                  disabled
                />
                <NumberInput
                  label="Purchase price"
                  value={positionDraft.purchasePrice ?? ""}
                  disabled
                />
                <NumberInput
                  label="Monthly holding cost"
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
                  label="Annual appreciation %"
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
                <TextInput label="Purchase month" value={positionDraft.purchaseMonth ?? ""} disabled />
                <NumberInput
                  label="Holding cost monthly"
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
                  label="Holding cost growth %"
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
                  label="Annual depreciation %"
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
                <TextInput
                  label="Start month"
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
                <NumberInput
                  label="Initial value"
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
                  label="Monthly contribution"
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
                  label="Monthly withdrawal"
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
                  label="Expected annual return %"
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
                <TextInput
                  label="Start month"
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
                  label="End month"
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
                <NumberInput
                  label="Premium monthly"
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
                  label="Premium growth %"
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
                <TextInput
                  label="Start month"
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
                <NumberInput
                  label="Principal"
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
                  label="Annual interest rate %"
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
                  label="Term years"
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
                <TextInput
                  label="As of month"
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
                <NumberInput
                  label="Balance"
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
                Cancel
              </Button>
              <Button onClick={handlePositionSave}>Apply</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
