"use client";

import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Drawer,
  Grid,
  Group,
  Menu,
  Notification,
  NumberInput,
  Modal,
  MultiSelect,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Pill,
  Title,
  Tooltip as MantineTooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { type Locale } from "../../src/i18n/routing";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { monthIndex, type EventGroup, type EventType } from "@north-star/engine";
import {
  Legend as RechartsLegend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PlanLabAffectedEntity,
  PlanLabDecisionTemplateId,
  PlanLabDraft,
  PlanLabExperiment,
  PlanLabExperimentGroupKind,
  PlanLabExperimentType,
  PlanLabPositionPatch,
  PlanLabRulePatch,
  Plan,
  PlanLabSnapshot,
  PlanSnapshot,
} from "../../src/domain/planLab/types";
import type {
  EventDefinition,
  EventRule,
  EventRuleOverrides,
  ScenarioEventRef,
} from "../../src/domain/events/types";
import type {
  BudgetRule,
  Scenario,
  ScenarioAsset,
  ScenarioAssumptions,
  ScenarioLiability,
  PersonaFocus,
  ScenarioMember,
  ScenarioMemberKind,
} from "../../src/store/scenarioStore";
import {
  createBudgetRuleId,
  createMemberId,
  isScenarioV2,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import type { BundleInstanceRecord } from "../../src/store/scenarioStore";
import type {
  AdjustmentEvent,
  CashflowEvent,
  HousingEvent,
  InsuranceEvent,
  LoanEvent,
  ScenarioEvent,
  ScenarioEventDraft as ScenarioV2EventDraft,
} from "../../src/domain/scenarioV2/events";
import { ScenarioEventSchema } from "../../src/domain/scenarioV2/events";
import { normalizeMonthInput, parseMonthStrict } from "../../src/utils/month";
import { ageToYYYYMM, yyyymmToAge } from "../../src/utils/ageMonth";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import {
  computeProjectionWithSmartInvest,
  useProjectionWithLedger,
} from "../../src/engine/useProjectionWithLedger";
import {
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioSettingsPath,
} from "../../lib/routes/appRoutes";
import { useScenarioContext } from "../../src/hooks/useScenarioContext";
import { useUiStore } from "../../src/store/uiStore";
import type { TimeSeriesPoint } from "../overview/types";
import WarningsPanel from "../../components/WarningsPanel";
import MonthField from "../../components/MonthField";
import MonthlyBreakdownModalHost from "../../components/MonthlyBreakdownModalHost";
import { computePlanLabKpis, diffPlanLabKpis } from "../../src/domain/planLab/kpis";
import {
  computeCashRiskScorecard,
  computeBufferThresholdFromLedger,
} from "../../src/domain/planLab/scorecard/cashRisk";
import { PlanLabCashRiskScorecard } from "../../components/PlanLabCashRiskScorecard";
import AddFlowDrawer from "../../components/add-flow/AddFlowDrawer";
import type { TemplateCategory, TemplateDef, TemplateId } from "../../src/domain/eventTemplates/types";
import BundleWizardDrawer from "../../components/eventTemplates/bundles/BundleWizardDrawer";
import { buildTemplateDrawerDraftOverrides } from "../../src/domain/eventTemplates/presets";
import { buildScenarioEventViews, buildTimelineEventFromDefinition, buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import TimelineEventForm, { type TimelineEventFormResult } from "../../components/timeline/TimelineEventForm";
import { getEventMeta } from "../../src/events/eventCatalog";
import {
  createEventDefinitionFromTemplate,
  createScenarioEventRef,
  getEventFilterOptions,
  getEventLabel,
  getEventTypeDisplay,
  listEventTypesForGroup,
} from "../../components/timeline/utils";
import SmartInvestForm from "../../components/SmartInvestForm";
import ScenarioAssumptionsOverrideForm, {
  SCENARIO_ASSUMPTION_OVERRIDE_KEYS,
  type ScenarioAssumptionsOverride,
} from "../../components/ScenarioAssumptionsOverrideForm";
import { buildDefaultSmartInvestPolicy } from "../../src/domain/smartInvest/defaultPolicy";
import type { SmartInvestPolicy } from "../../src/domain/smartInvest/types";
import { applySmartInvestPatch } from "../../src/domain/planLab/smartInvestAdjust";
import { appliesToScenario } from "../../src/domain/applyScope";
import { buildChildBudgetRuleTemplates } from "../../src/domain/planLab/childBudgetTemplates";
import {
  buildScenarioDraftFromPlanLab,
  materializePlanLabDraft,
} from "../../src/domain/planLab/materializePlanLabDraft";
import { submitScenarioDraft } from "../../src/domain/scenarioDraft/submitScenarioDraft";
import { submitPlanLabScenarioDraft } from "../../src/domain/planLab/submissionFacade";
import { recordScenarioMigrationEvent } from "../../src/lib/telemetry/scenarioMigrationTelemetry";
import { getMemberAgeYears } from "../../src/domain/members/age";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";
import { PlanLibraryDrawer } from "./PlanLibraryDrawer";
import { SavePlanModal } from "./SavePlanModal";
import { ENV_ASSUMPTION_LABELS } from "./assumptionLabels";
import ExperimentTemplatesDrawer from "./ExperimentTemplatesDrawer";
import MortgageDetailDrawer, {
  type MortgageDetailTab,
} from "../moneyFlow/MortgageDetailDrawer";
import {
  buildPlanPatchesFromSnapshot,
  validatePlanPatches,
} from "../../src/domain/planLab/planPatches";
import { applyPlanPatches } from "../../src/domain/planLab/applyPlanPatches";
import {
  buildSnapshotPayload,
  computeBaselineFingerprint,
  hasMeaningfulPatch,
} from "../../src/domain/planLab/snapshotPayload";
import { buildScenarioV2FromScenario } from "../../src/domain/planLab/scenarioV2Bridge";
import { detectDoubleCountingWarnings } from "../../src/domain/planLab/guardrails";
import {
  applyPlanLabScenarioV2Patches,
  emptyPlanLabScenarioV2Patches,
  type PlanLabScenarioV2Patches,
} from "../../src/domain/planLab/scenarioV2Patches";
import type {
  BundleWizardInput,
  HomePurchaseBundleInput,
  NewBabyPlanInput,
  RentalPlanBundleInput,
} from "../../src/domain/eventTemplates/bundles";
import type { LedgerRow } from "../../src/engine/scenarioV2Compiler";
import { getTemplateDef } from "../../src/domain/eventTemplates/registry";
import CashflowEventDrawer, {
  type CashflowEventDraft,
  type ScenarioEventDraft as PlanLabScenarioEventDraft,
} from "../moneyFlow/CashflowEventDrawer";
import { buildCashflowGrowthPayload } from "../moneyFlow/growthMode";
import HousingEventDrawer, {
  type HousingEventDraft,
} from "../moneyFlow/HousingEventDrawer";
import LoanEventDrawer, { type LoanEventDraft } from "../moneyFlow/LoanEventDrawer";
import InsuranceEventDrawer, {
  type InsuranceEventDraft,
} from "../moneyFlow/InsuranceEventDrawer";
import {
  collectPatchItemIds,
  collectUngroupedPatchItemIds,
  createSingleItemExperimentGroup,
  deriveEnvOverrideAffectedEntities,
  filterScenarioV2PatchesByExperimentGroups,
  removeExperimentGroupItemsFromPatches,
  resolveExperimentGroupTitle,
  resolveSingleItemExperimentTitle,
  type PlanLabExperimentRemovedItemMeta,
  type PlanLabExperimentGroup,
} from "./experimentGroups";
import { deriveExperimentTargets } from "./deriveExperimentTargets";
import { computeBundleCashflowSummary } from "../../src/features/money/bundleSummary";
import {
  buildEventOverridePatch,
  type EventOverrideExperimentSpec,
} from "../../src/domain/planLab/eventOverrideExperiment";
import {
  formatExperimentChanges,
  formatExperimentSummary,
  formatScenarioAssumptionChange,
  formatScenarioAssumptionSummary,
  getScenarioAssumptionOverrideEntries,
} from "./experimentSummary";
import PlanLabTimelinePreview from "./PlanLabTimelinePreview";
import { buildTimelineItemsForPreview } from "./timelinePreview";
import { buildEventExperimentChanges, normalizeYYYYMM } from "./eventExperimentAdapter";
import {
  buildBundleWizardInputForDecisionTemplate,
  buildIncomeShockDefaultPayload,
  buildPlanLabDecisionTemplateOptions,
  type PlanLabCostProfileTier,
} from "./decisionTemplates";
import { buildPlanLabDecisionSummary } from "./decisionSummary";
import { buildMonthScale } from "../../lib/chart/monthScale";
import MoneyMetaTags from "../../src/features/money/MoneyMetaTags";
import type { MoneyTagItem } from "../../src/features/money/moneyTagConfig";
import { compareMonthKey } from "../../src/utils/monthKey";
import {
  adaptPlanLabRowMeta,
  type PlanLabMetaTagAdapterInput,
} from "./planLabMetaTagAdapter";
import {
  buildPlanLabGroups,
  type PlanLabGroupBy,
} from "./planLabGrouping";
import {
  deriveEffectiveRangesForAdjustableGroup,
  getSalaryAdjustmentParentId,
} from "../../src/domain/scenarioV2/salaryEffectiveRanges";
import {
  computeDisplaySegments,
  getEventBaseEventId,
  getEventStartMonth,
} from "../../src/domain/scenarioV2/eventSegments";
import type { SharedViewSource } from "../../src/domain/events/eventTaxonomy";

export const resolvePlanLabMoneyEditHref = (
  params: { caseId: string; scenarioId: string; eventId?: string | null; category?: string | null }
) => {
  if (!params.caseId || !params.scenarioId || !params.eventId) {
    return null;
  }
  const tab = params.category === "income" ? "income" : "expenses";
  return `${scenarioMoneyPath(params.caseId, params.scenarioId)}?tab=${tab}&editEventId=${params.eventId}`;
};

export const resolvePlanLabSettingsMembersHref = (
  params: { caseId: string; scenarioId: string; eventId?: string | null }
) => {
  if (!params.caseId || !params.scenarioId) {
    return null;
  }
  const query = params.eventId ? `?focusEventId=${params.eventId}` : "";
  return `${scenarioSettingsPath(params.caseId, params.scenarioId)}${query}#members`;
};

const isMortgageHousingEvent = (event: ScenarioEvent): event is HousingEvent =>
  event.type === "housing" && event.kind === "mortgage";

const PERSONA_FOCUS_KEYS: PersonaFocus[] = ["family", "fertility", "education", "retirement"];

const PERSONA_KPI_PRIORITY: Record<PersonaFocus, string[]> = {
  family: ["minCash", "negativeCash", "assetLinkedExpenseRatio", "targetMonthNetWorth"],
  fertility: ["assetLinkedExpenseRatio", "negativeCash", "minCash", "targetMonth"],
  education: ["educationExpensePressure", "assetLinkedExpenseRatio", "minCash", "negativeCash"],
  retirement: ["passiveIncomeCoverage", "targetMonthNetWorth", "minCash", "targetMonth"],
};

type ChartType = "netWorth" | "cash" | "netCashflow";


type ScenarioV2DrawerType =
  | "cashflow"
  | "adjustment"
  | "housing"
  | "loan"
  | "insurance";

type ScenarioItemKind = "event" | "rule" | "position";

type PositionKind =
  | "home"
  | "car"
  | "investment"
  | "insurance"
  | "loan"
  | "cash"
  | "smartInvest"
  | "asset"
  | "liability";

type ScenarioEditorItem = {
  id: string;
  kind: ScenarioItemKind;
  title: string;
  category: string;
  memberId?: string | null;
  memberName?: string | null;
  defaultMemberId?: string | null;
  startMonth?: string;
  endMonth?: string | null;
  enabled: boolean;
  changed?: boolean;
  risky?: boolean;
  amount?: number | null;
  frequency?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths" | "schedule";
  intervalMonths?: number | null;
  sourceEventId?: string | null;
  bundleInstanceId?: string | null;
  bundleTitle?: string | null;
  bundleTemplateId?: string | null;
  eventId?: string;
  eventRefId?: string;
  eventDefinitionId?: string;
  ruleId?: string;
  ruleSource?: "baseline" | "draft";
  assetId?: string;
  liabilityId?: string;
  positionKey?: string;
  positionKind?: PositionKind;
  position?: any;
  budgetRule?: BudgetRule;
  eventDefinition?: EventDefinition;
  eventRule?: EventRule;
  eventOverrides?: EventRuleOverrides;
  eventSource?: "baseline" | "draft";
  adjustmentCount?: number;
  adjustmentNextMonth?: string | null;
  adjustmentNextAmount?: number | null;
  adjustmentSegments?: Array<{
    eventId: string;
    from: string | null;
    to: string | null;
    amount: number;
    isBase: boolean;
  }>;
  linkState?: "linked" | "orphaned";
  source?: SharedViewSource;
};

type EventExperimentDraft = {
  targetEventId: string | null;
  amountMode: "delta" | "set";
  deltaUnit: "percent" | "hkd";
  amountValue: number;
  setAmountValue: number | null;
  startMonthMode: "offset" | "month" | "age";
  startAgeYears: number;
  startAgeMonths: number;
  startShiftMonths: number;
  startMonthValue: string;
  endMonthMode: "offset" | "month" | "age";
  endAgeYears: number;
  endAgeMonths: number;
  endShiftMonths: number;
  endMonthValue: string;
  clearEndMonth: boolean;
  growthMode: "unchanged" | "assumption" | "custom" | "none";
  growthRate: number;
};

type EventExperimentAction = "edit" | "add_adjustment" | "remove";

type EventExperimentTargetContext = {
  eventId: string;
  isChild: boolean;
  parentEventId?: string;
};

type PlanLabDraftEventAddition = {
  definition: EventDefinition;
  ref: ScenarioEventRef;
};

type CreationIntent = "plan" | "item";
type CreationItemCategory = "income" | "expenses" | "assets" | "liabilities";

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
  initialMode?: "edit" | "compare";
};

type PlanLabToast = {
  id: string;
  color: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};
type PlanLabDriverSource = "event" | "rule" | "position" | "experiment";
type BundleDrawerSection = "summary" | "cashflow" | "mortgage";

type PlanLabTopDriver = {
  id: string;
  itemId: string;
  source: PlanLabDriverSource;
  title: string;
  contribution: number;
  bundleInstanceId?: string;
};

const TOP_DRIVER_COUNT = 5;
const PLANLAB_MAX_MONTHS = 360;

const pickScenarioAssumptionOverrides = (
  assumptions: ScenarioAssumptions
): ScenarioAssumptionsOverride => ({
  inflationRate: assumptions.inflationRate,
  salaryGrowthRate: assumptions.salaryGrowthRate,
  emergencyFundMonths: assumptions.emergencyFundMonths,
  rentAnnualGrowthPct: assumptions.rentAnnualGrowthPct,
  propertyAppreciationPct: assumptions.propertyAppreciationPct,
  cashYieldPct: assumptions.cashYieldPct,
  carDepreciationRatePct: assumptions.carDepreciationRatePct,
});

export const GROUP_LABEL: Record<string, string> = {
  income: "收入",
  expense: "支出",
  expenses: "支出",
  asset: "資產",
  assets: "資產",
  liability: "負債",
  liabilities: "負債",
  cash: "現金",
  housing: "住房",
  mortgage: "按揭",
};

export const buildScenarioItemMetaParts = ({
  item,
  currency,
  locale,
  frequencyLabels,
  householdLabel,
}: {
  item: ScenarioEditorItem;
  currency: string;
  locale: string;
  frequencyLabels: Record<NonNullable<ScenarioEditorItem["frequency"]>, string>;
  householdLabel: string;
}) => {
  const parts: string[] = [];
  if (item.frequency) {
    if (item.frequency === "everyNMonths" && item.intervalMonths && item.intervalMonths > 0) {
      parts.push(`每 ${item.intervalMonths} 個月`);
    } else {
      parts.push(frequencyLabels[item.frequency]);
    }
  }
  if (typeof item.amount === "number") {
    parts.push(formatCurrency(item.amount, currency, locale));
  }
  if (item.startMonth || item.endMonth) {
    const start = item.startMonth ?? "—";
    parts.push(item.endMonth ? `${start} 至 ${item.endMonth}` : `${start} 起`);
  }
  if (item.memberName) {
    parts.push(item.memberName);
  } else if (item.memberId) {
    parts.push(item.memberId === "household" ? householdLabel : item.memberId);
  }
  if (item.positionKind === "asset") {
    const currentValue = item.position?.currentValue;
    if (typeof currentValue === "number") {
      parts.push(`現值 ${formatCurrency(currentValue, currency, locale)}`);
    }
  }
  if (item.positionKind === "liability") {
    const outstanding = item.position?.principalOutstanding;
    const rate = item.position?.annualInterestRatePct;
    if (typeof outstanding === "number") {
      parts.push(`結餘 ${formatCurrency(outstanding, currency, locale)}`);
    }
    if (typeof rate === "number") {
      parts.push(`利率 ${rate}%`);
    }
  }
  return parts;
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

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const addMonthsToMonth = (baseMonth: string, months: number) => {
  const [year, month] = baseMonth.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return baseMonth;
  }
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonthFriendly = (month: string | null | undefined) => {
  if (!month || !parseMonthStrict(month).ok) {
    return "";
  }
  const [year, monthValue] = month.split("-").map(Number);
  return `${year}年${monthValue}月`;
};

const isMemberLinkedEvent = (event: ScenarioEvent | null) => Boolean(event?.memberId);

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

const buildBundleRowId = (bundleId: string) => `bundle:${bundleId}`;

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

const defaultAssetLabel = (asset: ScenarioAsset) =>
  asset.label ??
  (asset.kind === "home"
    ? "住宅"
    : asset.kind === "investment"
    ? "投資"
    : asset.kind === "cash"
    ? "現金"
    : asset.kind === "car"
    ? "車輛"
    : asset.kind === "policy"
    ? "保單"
    : "資產");

const defaultLiabilityLabel = (liability: ScenarioLiability) =>
  liability.label ??
  (liability.kind === "mortgage"
    ? "按揭"
    : liability.kind === "carLoan"
    ? "車貸"
    : liability.kind === "credit"
    ? "信用卡"
    : liability.kind === "loan"
    ? "貸款"
    : "負債");

const deriveInputsFromScenarioV2 = (params: {
  scenario: ReturnType<typeof buildScenarioV2FromScenario>;
  members: ScenarioMember[];
  rules: BudgetRule[];
  changed: {
    events: Set<string>;
    assets: Set<string>;
    liabilities: Set<string>;
    rules: Set<string>;
    addedEvents: Set<string>;
  };
}): ScenarioEditorItem[] => {
  const { scenario, members, rules, changed } = params;
  const memberLookup = new Map(members.map((member) => [member.id, member.name]));
  const eventLookup = new Map(
    (scenario.events ?? []).map((event) => [event.id, event])
  );
  const resolveBundleSource = (eventId?: string | null) => {
    if (!eventId) {
      return {
        bundleInstanceId: null,
        bundleTitle: null,
        bundleTemplateId: null,
      };
    }
    const source = eventLookup.get(eventId)?.source;
    return {
      bundleInstanceId: source?.bundleInstanceId ?? null,
      bundleTitle: source?.bundleTitle ?? null,
      bundleTemplateId: source?.templateId ?? null,
    };
  };
  const items: ScenarioEditorItem[] = [];

  const eventsByBaseEventId = new Map<string, ScenarioEvent[]>();
  (scenario.events ?? []).forEach((event) => {
    const baseEventId = getEventBaseEventId(event);
    const bucket = eventsByBaseEventId.get(baseEventId) ?? [];
    bucket.push(event);
    eventsByBaseEventId.set(baseEventId, bucket);
  });

  const eventSegmentByBase = new Map<string, ReturnType<typeof computeDisplaySegments>>();
  eventsByBaseEventId.forEach((groupEvents, baseEventId) => {
    eventSegmentByBase.set(baseEventId, computeDisplaySegments(groupEvents));
  });

  const currentMonth = scenario.assumptions.baseMonth;

  (scenario.events ?? []).forEach((event) => {
    const baseEventId = getEventBaseEventId(event);
    if (baseEventId !== event.id) {
      return;
    }

    const memberName = event.memberId ? memberLookup.get(event.memberId) ?? null : null;
    const title = event.label ?? event.type;
    const startMonth =
      event.type === "cashflow"
        ? event.cadence === "oneOff"
          ? event.occurrenceMonth
          : event.startMonth
        : event.type === "adjustment"
        ? event.month
        : event.startMonth;
    const endMonth =
      event.type === "cashflow"
        ? event.endMonth ?? null
        : event.type === "housing" || event.type === "insurance"
        ? event.endMonth ?? null
        : null;
    const amount =
      event.type === "cashflow"
        ? event.amount
        : event.type === "adjustment"
        ? event.amount
        : null;
    const bundleSource = resolveBundleSource(event.id);

    let adjustmentCount = 0;
    let adjustmentNextMonth: string | null = null;
    let adjustmentNextAmount: number | null = null;
    let adjustmentSegments: ScenarioEditorItem["adjustmentSegments"];

    const segmentRanges = eventSegmentByBase.get(event.id) ?? [];
    if (segmentRanges.length > 1) {
      adjustmentCount = segmentRanges.length - 1;
      adjustmentSegments = segmentRanges
        .filter((segment) => segment.event.type === "cashflow")
        .map((segment) => ({
          eventId: segment.event.id,
          from: segment.effectiveStart,
          to: segment.effectiveEnd,
          amount: segment.event.type === "cashflow" ? segment.event.amount : 0,
          isBase: segment.event.id === event.id,
        }));
      const futureSegment = segmentRanges.find(
        (segment) => segment.event.id !== event.id && Boolean(segment.effectiveStart)
      );
      if (futureSegment && futureSegment.event.type === "cashflow") {
        adjustmentNextMonth = futureSegment.effectiveStart;
        adjustmentNextAmount = futureSegment.event.amount;
      }
    }

    const currentEffective =
      currentMonth && segmentRanges.length > 0
        ? [...segmentRanges]
            .reverse()
            .find((segment) => {
              if (compareMonthKey(segment.effectiveStart, currentMonth) > 0) {
                return false;
              }
              if (segment.effectiveEnd && compareMonthKey(segment.effectiveEnd, currentMonth) < 0) {
                return false;
              }
              return true;
            })
        : null;
    const displayAmount =
      currentEffective?.event.type === "cashflow"
        ? currentEffective.event.amount
        : amount;

    items.push({
      id: `event:${event.id}`,
      kind: "event",
      title,
      category:
        event.type === "cashflow"
          ? event.tags?.[0] ?? event.kind
          : event.type,
      memberId: event.memberId ?? null,
      memberName,
      startMonth: startMonth ?? undefined,
      endMonth,
      enabled: true,
      changed: changed.events.has(event.id),
      eventId: event.id,
      sourceEventId: event.id,
      bundleInstanceId: bundleSource.bundleInstanceId,
      bundleTitle: bundleSource.bundleTitle,
      bundleTemplateId: bundleSource.bundleTemplateId,
      eventSource: changed.addedEvents.has(event.id) ? "draft" : "baseline",
      risky: event.type === "housing" || event.type === "loan",
      amount: displayAmount,
      frequency: event.type === "cashflow" ? event.cadence : undefined,
      intervalMonths:
        event.type === "cashflow" && event.cadence === "everyNMonths"
          ? event.everyNMonths ?? null
          : null,
      adjustmentCount,
      adjustmentNextMonth,
      adjustmentNextAmount,
      adjustmentSegments,
      linkState: "linked",
    });
  });

  (scenario.assets ?? []).forEach((asset) => {
    const memberName = asset.ownerMemberId
      ? memberLookup.get(asset.ownerMemberId) ?? null
      : null;
    const bundleSource = resolveBundleSource(asset.createdByEventId ?? null);
    items.push({
      id: `asset:${asset.id}`,
      kind: "position",
      title: defaultAssetLabel(asset),
      category: asset.kind,
      memberId: asset.ownerMemberId ?? null,
      memberName,
      startMonth: asset.startMonth ?? undefined,
      endMonth: null,
      enabled: true,
      changed:
        changed.assets.has(asset.id) ||
        (asset.createdByEventId ? changed.addedEvents.has(asset.createdByEventId) : false),
      amount: asset.currentValue ?? null,
      assetId: asset.id,
      positionKey: asset.id,
      positionKind: "asset",
      position: asset,
      sourceEventId: asset.createdByEventId ?? null,
      bundleInstanceId: bundleSource.bundleInstanceId,
      bundleTitle: bundleSource.bundleTitle,
      bundleTemplateId: bundleSource.bundleTemplateId,
      linkState: "linked",
    });
  });

  (scenario.liabilities ?? []).forEach((liability) => {
    const memberName = liability.ownerMemberId
      ? memberLookup.get(liability.ownerMemberId) ?? null
      : null;
    const bundleSource = resolveBundleSource(liability.createdByEventId ?? null);
    items.push({
      id: `liability:${liability.id}`,
      kind: "position",
      title: defaultLiabilityLabel(liability),
      category: liability.kind,
      memberId: liability.ownerMemberId ?? null,
      memberName,
      startMonth: liability.startMonth ?? undefined,
      endMonth: null,
      enabled: true,
      changed:
        changed.liabilities.has(liability.id) ||
        (liability.createdByEventId
          ? changed.addedEvents.has(liability.createdByEventId)
          : false),
      amount: liability.principalOutstanding ?? null,
      liabilityId: liability.id,
      positionKey: liability.id,
      positionKind: "liability",
      position: liability,
      sourceEventId: liability.createdByEventId ?? null,
      bundleInstanceId: bundleSource.bundleInstanceId,
      bundleTitle: bundleSource.bundleTitle,
      bundleTemplateId: bundleSource.bundleTemplateId,
      linkState: "linked",
    });
  });

  rules.forEach((rule) => {
    const memberName = rule.memberId ? memberLookup.get(rule.memberId) ?? null : null;
    const bundleSource = resolveBundleSource(rule.generatedByEventId ?? null);
    items.push({
      id: `rule:${rule.id}`,
      kind: "rule",
      title: rule.name,
      category: rule.category,
      memberId: rule.memberId ?? null,
      memberName,
      startMonth: rule.startMonth ?? undefined,
      endMonth: rule.endMonth ?? null,
      enabled: rule.enabled,
      changed: changed.rules.has(rule.id),
      amount: rule.monthlyAmount ?? null,
      ruleId: rule.id,
      ruleSource: "baseline",
      budgetRule: rule,
      sourceEventId: rule.generatedByEventId ?? null,
      bundleInstanceId: bundleSource.bundleInstanceId,
      bundleTitle: bundleSource.bundleTitle,
      bundleTemplateId: bundleSource.bundleTemplateId,
      linkState: "linked",
    });
  });

  return items;
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

type PlanLabRowAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
};

type PlanLabAccordionRowProps = {
  id: string;
  title: string;
  badges: PlanLabRowBadge[];
  summary?: string;
  metaTags?: MoneyTagItem[];
  enabled?: boolean;
  highlighted?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onClick?: () => void;
  primaryAction?: PlanLabRowAction;
  secondaryAction?: PlanLabRowAction;
  menuItems?: PlanLabRowMenuItem[];
  panel?: ReactNode;
};

const PlanLabAccordionRow = memo(
  forwardRef<HTMLDivElement, PlanLabAccordionRowProps>(function PlanLabAccordionRow(
    {
      id,
      title,
      badges,
      summary,
      metaTags,
      enabled,
      highlighted,
      onToggle,
      onEdit,
      onClick,
      primaryAction,
      secondaryAction,
      menuItems,
      panel,
    },
    ref
  ) {
    const t = useTranslations("common");
    return (
      <Box
        ref={ref}
        style={{
          borderRadius: 12,
          outline: highlighted ? "2px solid rgba(18, 184, 134, 0.7)" : "none",
          outlineOffset: 2,
          cursor: onClick ? "pointer" : "default",
          marginBottom: 8,
        }}
      >
        <Accordion.Item value={id}>
          <Accordion.Control onClick={onClick}>
            <Group justify="space-between" align="center" wrap="nowrap" w="100%">
              <Stack gap={4} miw={0}>
                <Text fw={600} size="sm" lineClamp={1}>
                  {title}
                </Text>
                {metaTags && metaTags.length > 0 ? <MoneyMetaTags tags={metaTags} /> : null}
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
                  <Button
                    size="xs"
                    variant="light"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit();
                    }}
                  >
                    {t("actionEdit")}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    size="xs"
                    variant="light"
                    color={primaryAction.color}
                    disabled={primaryAction.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      primaryAction.onClick();
                    }}
                  >
                    {primaryAction.label}
                  </Button>
                )}
                {secondaryAction && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color={secondaryAction.color}
                    disabled={secondaryAction.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      secondaryAction.onClick();
                    }}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {menuItems && menuItems.length > 0 && (
                  <Menu withinPortal position="bottom-end">
                    <Menu.Target>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        aria-label={t("actionMore")}
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
      </Box>
    );
  })
);

PlanLabAccordionRow.displayName = "PlanLabAccordionRow";

type PlanLabBundleItemRowProps = {
  title: string;
  badges: PlanLabRowBadge[];
  metaTags?: MoneyTagItem[];
  highlighted?: boolean;
};

const PlanLabBundleItemRow = ({
  title,
  badges,
  metaTags,
  highlighted,
}: PlanLabBundleItemRowProps) => (
  <Paper
    withBorder
    radius="xs"
    p="sm"
    style={{
      outline: highlighted ? "2px solid rgba(18, 184, 134, 0.7)" : "none",
      outlineOffset: 2,
    }}
  >
    <Group justify="space-between" align="center" wrap="nowrap">
      <Stack gap={4} miw={0}>
        <Text fw={600} size="sm" lineClamp={1}>
          {title}
        </Text>
        {metaTags && metaTags.length > 0 ? <MoneyMetaTags tags={metaTags} /> : null}
        <Group gap={4} wrap="wrap">
          {badges.map((badge, index) => (
            <Badge
              key={`${title}-${badge.label}-${index}`}
              size="xs"
              variant="light"
              color={badge.color}
            >
              {badge.label}
            </Badge>
          ))}
        </Group>
      </Stack>
    </Group>
  </Paper>
);

const useDebouncedValue = <T,>(value: T, delayMs = 200) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
};
const sortTopDriversByMagnitude = (drivers: PlanLabTopDriver[]) =>
  drivers
    .map((driver) => ({
      ...driver,
      contribution: Number(driver.contribution.toFixed(2)),
    }))
    .filter((driver) => driver.contribution !== 0)
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, TOP_DRIVER_COUNT);


export default function PlanLabPanel({
  scenario,
  eventLibrary,
  members,
  budgetRules,
  displayMode,
  deflateSeries,
  baselineSeries,
  initialMode,
}: PlanLabPanelProps) {
  const t = useTranslations("overview");
  const moneyT = useTranslations("money");
  const warningsT = useTranslations();
  const timeline = useTranslations("timeline");
  const locale = useLocale();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const openModal = useUiStore((state) => state.openModal);
  const router = useRouter();
  const scenarioContext = useScenarioContext();
  const caseId = scenarioContext?.caseId ?? "";
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const updateScenarioMeta = useScenarioStore((state) => state.updateScenarioMeta);
  const upsertEventDefinition = useScenarioStore((state) => state.upsertEventDefinition);
  const createMember = useScenarioStore((state) => state.createMember);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);

  const translate = useCallback(
    (
      key: string,
      fallback: string,
      values?: Record<string, string | number>
    ) => {
      if (t.has(key)) return t(key, values);
      if (!values) return fallback;
      return fallback.replace(/\{(\w+)\}/g, (_, name) => {
        const v = values[name as string];
        return v === undefined || v === null ? `{${name}}` : String(v);
      });
    },
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
  const resolveBundleTitle = useCallback(
    (bundle: { templateId?: string; bundleTitle?: string }) => {
      const templateName = bundle.templateId
        ? moneyT(`templates.${bundle.templateId}.name`)
        : moneyT("bundleTitleFallback");
      if (bundle.bundleTitle) {
        return moneyT("bundleTitleWithName", {
          template: templateName,
          name: bundle.bundleTitle,
        });
      }
      return templateName;
    },
    [moneyT]
  );
  const resolveBundleExperimentTitle = useCallback(
    (wizardInput: BundleWizardInput | null | undefined, fallback?: string) => {
      if (!wizardInput) {
        return fallback ?? translate("planLabBundleExperimentFallback", "Life event bundle");
      }
      const bundleTitle =
        wizardInput.templateId === "life_home_purchase" ||
        wizardInput.templateId === "life_rental_plan"
          ? wizardInput.input.label
          : undefined;
      return resolveBundleTitle({
        templateId: wizardInput.templateId,
        bundleTitle,
      });
    },
    [resolveBundleTitle, translate]
  );

  const [chartType, setChartType] = useState<ChartType>("netWorth");
  const [mode, setMode] = useState<"edit" | "compare">(initialMode ?? "edit");
  const [groupBy, setGroupBy] = useState<PlanLabGroupBy>(
    (initialMode ?? "edit") === "compare" ? "member" : "domain"
  );
  const [planLibraryOpen, setPlanLibraryOpen] = useState(false);
  const [savePlanOpen, setSavePlanOpen] = useState(false);
  const [savePlanNotes, setSavePlanNotes] = useState<string | undefined>(undefined);
  const [savePlanTags, setSavePlanTags] = useState<string[] | undefined>(undefined);
  const [planToast, setPlanToast] = useState<string | null>(null);
  const planToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [experimentToast, setExperimentToast] = useState<PlanLabToast | null>(null);
  const experimentToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planAId, setPlanAId] = useState<string | null>(null);
  const [planBId, setPlanBId] = useState<string | null>(null);
  const [planLibrary, setPlanLibrary] = useState<PlanSnapshot[]>([]);
  const [otherPlans, setOtherPlans] = useState<PlanSnapshot[]>([]);
  const [lastSyncedWorkspaceSignature, setLastSyncedWorkspaceSignature] = useState<string>("{}");
  const scenarioIsV2 = isScenarioV2(scenario);
  const [baselinePatches, setBaselinePatches] = useState<PlanLabDraft["baselinePatches"]>({
    eventPatches: {},
    rulePatches: {},
    positionPatches: {},
    smartInvestPatch: undefined,
  });
  const [scenarioV2Patches, setScenarioV2Patches] = useState<PlanLabScenarioV2Patches>(() =>
    emptyPlanLabScenarioV2Patches()
  );
  const [experimentGroups, setExperimentGroups] = useState<PlanLabExperimentGroup[]>([]);
  const [draftMembers, setDraftMembers] = useState<ScenarioMember[]>([]);
  const [draftBudgetRules, setDraftBudgetRules] = useState<BudgetRule[]>([]);
  const [draftEvents, setDraftEvents] = useState<PlanLabDraftEventAddition[]>([]);
  const [experiments, setExperiments] = useState<PlanLabExperiment[]>([]);
  const [experimentTemplatesOpen, setExperimentTemplatesOpen] = useState(false);
  const [envAssumptionsDrawerOpen, setEnvAssumptionsDrawerOpen] = useState(false);
  const [envAssumptionsViewGroupId, setEnvAssumptionsViewGroupId] = useState<string | null>(null);
  const [envAssumptionOverridesDraft, setEnvAssumptionOverridesDraft] = useState<ScenarioAssumptionsOverride>({});
  const [experimentTemplateContext, setExperimentTemplateContext] = useState<{
    title: string;
    primaryEventId?: string;
  } | null>(null);
  const [experimentRenameDraft, setExperimentRenameDraft] = useState<{
    kind: "group" | "legacy";
    id: string;
    title: string;
  } | null>(null);
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
  const [controlsAccordionValue, setControlsAccordionValue] = useState<string | null>(
    "experiments"
  );
  const [targetMonthInput, setTargetMonthInput] = useState("");
  const [chartPreviewOpen, setChartPreviewOpen] = useState(false);
  useEffect(() => {
    setGroupBy(mode === "compare" ? "member" : "domain");
  }, [mode]);

  const [hoverMonthIdx, setHoverMonthIdx] = useState<number | null>(null);
  const [lockedMonthIdx, setLockedMonthIdx] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScenarioEditorItem | null>(null);
  const [editingFocus, setEditingFocus] = useState<"validity" | null>(null);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberDrawerMode, setMemberDrawerMode] = useState<"add" | "edit">("add");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
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
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [eventDrawerMode, setEventDrawerMode] = useState<"add" | "edit">("add");
  const [eventDraftDefinition, setEventDraftDefinition] = useState<EventDefinition | null>(
    null
  );
  const [eventDraftRef, setEventDraftRef] = useState<ScenarioEventRef | null>(null);
  const [eventDraftGroup, setEventDraftGroup] = useState<EventGroup | null>(null);
  const [eventDraftType, setEventDraftType] = useState<EventType | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerCategory, setTemplatePickerCategory] =
    useState<TemplateCategory>("popular");
  const [templatePickerIntent, setTemplatePickerIntent] =
    useState<CreationIntent | null>(null);
  const [templatePickerItemCategory, setTemplatePickerItemCategory] =
    useState<CreationItemCategory | null>(null);
  const [templatePlanUnsupportedNotice, setTemplatePlanUnsupportedNotice] = useState<string | null>(null);
  const [bundleExperimentCta, setBundleExperimentCta] = useState<
    {
      title: string;
      itemCount: number;
      itemIds: string[];
      source: "bundle" | "single";
      primaryItemId?: string;
      primaryItemLabel?: string;
    } | null
  >(null);
  const [bundleWizardOpen, setBundleWizardOpen] = useState(false);
  const [bundleWizardMode, setBundleWizardMode] = useState<"create" | "edit">("create");
  const [bundleWizardInstanceId, setBundleWizardInstanceId] = useState<string | null>(null);
  const [bundleWizardInitialInput, setBundleWizardInitialInput] =
    useState<BundleWizardInput | null>(null);
  const [bundleWizardExperimentMode, setBundleWizardExperimentMode] = useState(false);
  const [bundleViewId, setBundleViewId] = useState<string | null>(null);
  const [bundleInstanceOverrides, setBundleInstanceOverrides] = useState<
    BundleInstanceRecord[]
  >([]);
  const [confirmRemoveGroupId, setConfirmRemoveGroupId] = useState<string | null>(null);
  const [confirmRemoveExperimentId, setConfirmRemoveExperimentId] = useState<string | null>(null);
  const [undoRemovalRevision, setUndoRemovalRevision] = useState(0);
  const [bundleTemplate, setBundleTemplate] = useState<TemplateDef | null>(null);
  const [templateCashflowDraft, setTemplateCashflowDraft] =
    useState<Partial<CashflowEventDraft> | null>(null);
  const [templateHousingDraft, setTemplateHousingDraft] =
    useState<Partial<HousingEventDraft> | null>(null);
  const [templateLoanDraft, setTemplateLoanDraft] =
    useState<Partial<LoanEventDraft> | null>(null);
  const [templateInsuranceDraft, setTemplateInsuranceDraft] =
    useState<Partial<InsuranceEventDraft> | null>(null);
  const [v2EventDrawerOpen, setV2EventDrawerOpen] = useState(false);
  const [v2EventDrawerMode, setV2EventDrawerMode] = useState<"create" | "edit">(
    "create"
  );
  const [v2EventDrawerType, setV2EventDrawerType] =
    useState<ScenarioV2DrawerType | null>(null);
  const [editingV2EventId, setEditingV2EventId] = useState<string | null>(null);
  const [v2EventDefaultKind, setV2EventDefaultKind] =
    useState<CashflowEvent["kind"]>("income");
  const [salaryAdjustmentParentEventId, setSalaryAdjustmentParentEventId] = useState<string | null>(null);
  const [eventExperimentLandingOpen, setEventExperimentLandingOpen] = useState(false);
  const [eventExperimentLandingTarget, setEventExperimentLandingTarget] =
    useState<EventExperimentTargetContext | null>(null);
  const [eventExperimentLandingPresetAction, setEventExperimentLandingPresetAction] =
    useState<EventExperimentAction | null>(null);
  const [eventExperimentDrawerOpen, setEventExperimentDrawerOpen] = useState(false);
  const [eventExperimentDraft, setEventExperimentDraft] = useState<EventExperimentDraft>({
    targetEventId: null,
    amountMode: "delta",
    deltaUnit: "percent",
    amountValue: 0,
    setAmountValue: null,
    startMonthMode: "offset",
    startShiftMonths: 0,
    startMonthValue: scenario.assumptions.baseMonth ?? "",
    startAgeYears: 0,
    startAgeMonths: 0,
    endMonthMode: "offset",
    endShiftMonths: 0,
    endMonthValue: "",
    endAgeYears: 0,
    endAgeMonths: 0,
    clearEndMonth: false,
    growthMode: "unchanged",
    growthRate: 0,
  });
  const [assetDrawerItem, setAssetDrawerItem] = useState<ScenarioAsset | null>(null);
  const [liabilityDrawerItem, setLiabilityDrawerItem] =
    useState<ScenarioLiability | null>(null);
  const [mortgageDetail, setMortgageDetail] = useState<{
    eventId: string;
    tab: MortgageDetailTab;
    bundleId: string;
  } | null>(null);
  const [bundleDrawerFocus, setBundleDrawerFocus] =
    useState<BundleDrawerSection | null>(null);
  const [lastBundleDrawerState, setLastBundleDrawerState] = useState<{
    bundleId: string;
    focusSection: BundleDrawerSection | null;
  } | null>(null);
  const [viewScenarioItem, setViewScenarioItem] = useState<ScenarioEditorItem | null>(
    null
  );

  const monthInvalidMessage = t("planLabMonthInvalid");
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());
  const bundleIdByItemIdRef = useRef(new Map<string, string>());
  const bundleSummaryRef = useRef<HTMLDivElement | null>(null);
  const bundleCashflowRef = useRef<HTMLDivElement | null>(null);
  const bundleMortgageRef = useRef<HTMLDivElement | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const registerItemRef = useCallback((id: string, node: HTMLDivElement | null) => {
    itemRefs.current.set(id, node);
  }, [scenario.assumptions.baseMonth]);

  const closeAllPlanLabDrawers = useCallback(() => {
    setMemberDrawerOpen(false);
    setMemberDrawerMode("add");
    setEditingMemberId(null);
    setMemberDraft(null);
    setMemberDraftErrors({});
    setChildTemplateSelections({});
    setExperimentDrawerOpen(false);
    setExperimentDraft(null);
    setExperimentDraftErrors({});
    setExperimentDrawerMode("add");
    setExperimentTemplatesOpen(false);
    setEnvAssumptionsDrawerOpen(false);
    setEnvAssumptionsViewGroupId(null);
    setEnvAssumptionOverridesDraft({});
    setExperimentTemplateContext(null);
    setEventDrawerOpen(false);
    setEventDrawerMode("add");
    setEventDraftDefinition(null);
    setEventDraftRef(null);
    setEventDraftGroup(null);
    setEventDraftType(null);
    setTemplatePickerOpen(false);
    setTemplatePickerCategory("popular");
    setTemplatePickerIntent(null);
    setTemplatePickerItemCategory(null);
    setTemplatePlanUnsupportedNotice(null);
    setBundleViewId(null);
    setBundleDrawerFocus(null);
    setBundleWizardOpen(false);
    setBundleWizardMode("create");
    setBundleWizardInstanceId(null);
    setBundleWizardInitialInput(null);
    setBundleWizardExperimentMode(false);
    setBundleTemplate(null);
    setMortgageDetail(null);
    setLastBundleDrawerState(null);
    setV2EventDrawerOpen(false);
    setV2EventDrawerMode("create");
    setV2EventDrawerType(null);
    setEditingV2EventId(null);
    setV2EventDefaultKind("income");
    setSalaryAdjustmentParentEventId(null);
    setEventExperimentLandingOpen(false);
    setEventExperimentLandingTarget(null);
    setEventExperimentLandingPresetAction(null);
    setEventExperimentDrawerOpen(false);
    setEventExperimentDraft({
      targetEventId: null,
      amountMode: "delta",
      deltaUnit: "percent",
      amountValue: 0,
      setAmountValue: null,
      startMonthMode: "offset",
      startShiftMonths: 0,
      startMonthValue: scenario.assumptions.baseMonth ?? "",
      startAgeYears: 0,
      startAgeMonths: 0,
      endMonthMode: "offset",
      endShiftMonths: 0,
      endMonthValue: "",
      endAgeYears: 0,
      endAgeMonths: 0,
      clearEndMonth: false,
      growthMode: "unchanged",
      growthRate: 0,
    });
    setTemplateCashflowDraft(null);
    setTemplateHousingDraft(null);
    setTemplateLoanDraft(null);
    setTemplateInsuranceDraft(null);
    setAssetDrawerItem(null);
    setLiabilityDrawerItem(null);
    setEditingItem(null);
    setEditingFocus(null);
    setViewScenarioItem(null);
  }, []);
  
  const openScenarioItemView = useCallback(
    (item: ScenarioEditorItem) => {
      closeAllPlanLabDrawers();
      setViewScenarioItem(item);
    },
    [closeAllPlanLabDrawers]
  );

  const handleLocateItem = useCallback((id: string) => {
    const bundleId = bundleIdByItemIdRef.current.get(id);
    const resolvedId = bundleId ? buildBundleRowId(bundleId) : id;
    const node = itemRefs.current.get(resolvedId);
    if (!node) {
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedItemId((current) =>
      current === resolvedId ? current : resolvedId
    );
  }, []);

  const handleLocateControl = useCallback(
    (controlId: string) => {
      setControlsAccordionValue("experiments");
      const node = itemRefs.current.get(controlId);
      if (!node) {
        return;
      }
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedItemId((current) =>
        current === controlId ? current : controlId
      );
    },
    []
  );

  useEffect(() => {
    if (!highlightedItemId) {
      return;
    }
    const timeout = setTimeout(() => setHighlightedItemId(null), 2000);
    return () => clearTimeout(timeout);
  }, [highlightedItemId]);

  const drawerStyles = useMemo(
    () => ({
      body: {
        minHeight: 0,
        overscrollBehavior: "contain" as const,
        WebkitOverflowScrolling: "touch" as const,
        touchAction: "pan-y" as const,
        paddingBottom:
          "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)",
      },
    }),
    []
  );

  const baselineScenarioV2 = useMemo(
    () => buildScenarioV2FromScenario(scenario, eventLibrary),
    [eventLibrary, scenario]
  );
  const baselineBundleEventIdsByBundleId = useMemo(() => {
    const map = new Map<string, string[]>();
    (baselineScenarioV2.events ?? []).forEach((event) => {
      const bundleId = event.source?.bundleInstanceId;
      if (!bundleId) {
        return;
      }
      const existing = map.get(bundleId) ?? [];
      existing.push(event.id);
      map.set(bundleId, existing);
    });
    return map;
  }, [baselineScenarioV2.events]);
  const baselineSignature = useMemo(
    () => computeBaselineFingerprint(baselineScenarioV2, budgetRules),
    [baselineScenarioV2, budgetRules]
  );

  useEffect(() => {
    if (!scenarioIsV2) {
      return;
    }
    setScenarioV2Patches(emptyPlanLabScenarioV2Patches());
    setBaselinePatches({
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
      smartInvestPatch: undefined,
    });
    setDraftMembers([]);
    setDraftBudgetRules([]);
    setDraftEvents([]);
    setExperiments([]);
    setExperimentGroups([]);
    setBundleExperimentCta(null);
    setExperimentTemplateContext(null);
    setExperimentRenameDraft(null);
    setBundleWizardExperimentMode(false);
    setLastSyncedWorkspaceSignature("{}");
  }, [scenario.id, scenarioIsV2]);

  const persistPlanLibrary = useCallback(
    (nextPlans: PlanSnapshot[], nextSelectedPlanId?: string | null) => {
      updateScenarioMeta(scenario.id, {
        planLab: {
          ...(scenario.meta?.planLab ?? {}),
          planLibrary: nextPlans,
          lastSelectedPlanId:
            nextSelectedPlanId === undefined
              ? scenario.meta?.planLab?.lastSelectedPlanId
              : nextSelectedPlanId ?? undefined,
        },
      });
    },
    [scenario.id, scenario.meta?.planLab, updateScenarioMeta]
  );

  const refreshPlanLibrary = useCallback(() => {
    const plans = [...(scenario.meta?.planLab?.planLibrary ?? [])]
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
    setPlanLibrary(plans);
    setOtherPlans([]);
  }, [scenario.meta?.planLab?.planLibrary]);

  useEffect(() => {
    refreshPlanLibrary();
  }, [refreshPlanLibrary]);

  useEffect(() => {
    const lastSelectedPlanId = scenario.meta?.planLab?.lastSelectedPlanId;
    if (!lastSelectedPlanId) {
      return;
    }
    if (!planLibrary.some((plan) => plan.id === lastSelectedPlanId)) {
      return;
    }
    setActivePlanId((current) => current ?? lastSelectedPlanId);
  }, [planLibrary, scenario.meta?.planLab?.lastSelectedPlanId]);

  useEffect(() => {
    if (!planToast) {
      return;
    }
    if (planToastTimeoutRef.current) {
      clearTimeout(planToastTimeoutRef.current);
    }
    planToastTimeoutRef.current = setTimeout(() => {
      setPlanToast(null);
      planToastTimeoutRef.current = null;
    }, 3000);
    return () => {
      if (planToastTimeoutRef.current) {
        clearTimeout(planToastTimeoutRef.current);
      }
    };
  }, [planToast]);

  useEffect(() => {
    if (!experimentToast) {
      return;
    }
    if (experimentToastTimeoutRef.current) {
      clearTimeout(experimentToastTimeoutRef.current);
    }
    experimentToastTimeoutRef.current = setTimeout(() => {
      setExperimentToast(null);
      experimentToastTimeoutRef.current = null;
    }, 8000);
    return () => {
      if (experimentToastTimeoutRef.current) {
        clearTimeout(experimentToastTimeoutRef.current);
      }
    };
  }, [experimentToast, undoRemovalRevision]);

  const eventPatches = baselinePatches?.eventPatches ?? {};
  const rulePatches = baselinePatches?.rulePatches ?? {};
  const positionPatches = baselinePatches?.positionPatches ?? {};
  const smartInvestPatch = baselinePatches?.smartInvestPatch;
  const defaultSmartInvestPolicy = useMemo(
    () => buildDefaultSmartInvestPolicy("Smart Invest"),
    []
  );
  const baselineSmartInvestPolicy = scenario.assumptions.smartInvest;
  const plans = planLibrary;
  const planCount = plans.length;
  const defaultPlanName = translate("planLabPlanDefaultName", "方案 {index}", {
    index: planCount + 1,
  });
  const statusPillLabel = useMemo(() => {
    if (mode === "compare") {
      return translate("planLabFlowStepComparing", "Comparing");
    }
    if (activePlanId) {
      return translate("planLabFlowStepReadyToSave", "Ready to Save");
    }
    return translate("planLabFlowStepDraft", "Draft");
  }, [activePlanId, mode, translate]);

  const comparePlanOptions = useMemo(
    () => [
      {
        value: "baseline",
        label: t("planLabBaselineLabel"),
      },
      ...plans.map((plan) => ({
        value: plan.id,
        label: plan.name,
      })),
    ],
    [plans, t]
  );

  const handleModeToggle = useCallback(() => {
    const nextMode = mode === "edit" ? "compare" : "edit";
    setMode(nextMode);
    setPlanToast(
      nextMode === "compare"
        ? translate("planLabModeToggleCompareToast", "已進入比較模式。")
        : translate("planLabModeToggleEditToast", "已返回編輯模式。")
    );
  }, [mode, translate]);

  useEffect(() => {
    if (plans.length === 0) {
      if (planAId) {
        setPlanAId(null);
      }
      if (planBId) {
        setPlanBId(null);
      }
      if (activePlanId) {
        setActivePlanId(null);
      }
      return;
    }
    const validPlanIds = new Set(plans.map((plan) => plan.id));
    if (!planAId || (!validPlanIds.has(planAId) && planAId !== "baseline")) {
      setPlanAId("baseline");
    }
    if (!planBId || (!validPlanIds.has(planBId) && planBId !== "baseline")) {
      setPlanBId(plans[0]?.id ?? "baseline");
    }
    if (activePlanId && !plans.some((plan) => plan.id === activePlanId)) {
      setActivePlanId(null);
    }
  }, [activePlanId, planAId, planBId, plans]);
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
  const draftEventDefinitions = useMemo(
    () => draftEvents.map((event) => event.definition),
    [draftEvents]
  );
  const draftEventRefs = useMemo(() => draftEvents.map((event) => event.ref), [draftEvents]);

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
      if (scenarioIsV2 && item.memberName) {
        return item.memberName;
      }
      return (
        combinedMembers.find((member) => member.id === item.memberId)?.name ??
        translate("planLabGroupUnassigned", "未指定")
      );
    }
    if (groupKey === "timeline") {
      return item.startMonth ?? translate("planLabGroupNoDate", "未設定月份");
    }
    const normalizedKey = item.category?.toLowerCase();
    const mappedLabel = normalizedKey ? GROUP_LABEL[normalizedKey] : undefined;
    return mappedLabel ?? categoryLabels[item.category] ?? item.category;
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
      closeAllPlanLabDrawers();
      setEditingItem(item);
      setEditingFocus(focus);
    },
    [closeAllPlanLabDrawers]
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

  const eventGroupOptions = useMemo(
    () => getEventFilterOptions(timeline).filter((option) => option.value !== "all"),
    [timeline]
  );
  const eventTypeOptions = useMemo(
    () =>
      eventDraftGroup
        ? listEventTypesForGroup(eventDraftGroup).map((type) => ({
            value: type,
            label: getEventLabel(timeline, type),
          }))
        : [],
    [eventDraftGroup, timeline]
  );

  const updateExperiment = (id: string, patch: Partial<PlanLabExperiment>) => {
    setExperiments((current) =>
      current.map((experiment) =>
        experiment.id === id ? { ...experiment, ...patch } : experiment
      )
    );
  };

  const moveExperiment = useCallback((id: string, direction: "up" | "down") => {
    setExperiments((current) => {
      const index = current.findIndex((experiment) => experiment.id === id);
      if (index === -1) {
        return current;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }, []);

  const moveExperimentGroup = useCallback(
    (id: string, direction: "up" | "down") => {
      setExperimentGroups((current) => {
        const index = current.findIndex((group) => group.experimentId === id);
        if (index === -1) {
          return current;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.length) {
          return current;
        }
        const next = [...current];
        const temp = next[index];
        next[index] = next[targetIndex];
        next[targetIndex] = temp;
        return next;
      });
    },
    []
  );

  const removeExperiment = (id: string) => {
    setExperiments((current) => current.filter((experiment) => experiment.id !== id));
  };

  const applyExperiment = useCallback((experimentId: string) => {
    setExperimentGroups((current) =>
      current.map((group) =>
        group.experimentId === experimentId ? { ...group, isEnabled: true } : group
      )
    );
  }, []);

  const unapplyExperiment = useCallback((experimentId: string) => {
    setExperimentGroups((current) =>
      current.map((group) =>
        group.experimentId === experimentId ? { ...group, isEnabled: false } : group
      )
    );
  }, []);

  const deleteExperiment = useCallback(
    (experimentId: string) => {
      const targetGroup =
        experimentGroups.find((group) => group.experimentId === experimentId) ?? null;
      if (!targetGroup) {
        return;
      }
      setExperimentGroups((current) =>
        current.filter((group) => group.experimentId !== experimentId)
      );
      const baselineEventIds = new Set((baselineScenarioV2.events ?? []).map((event) => event.id));
      setScenarioV2Patches((current) => {
        const next = removeExperimentGroupItemsFromPatches(current, targetGroup);
        if (process.env.NODE_ENV !== "production") {
          const currentBaselineRemovals = current.events.remove.filter((id) => baselineEventIds.has(id));
          const nextBaselineRemovals = next.events.remove.filter((id) => baselineEventIds.has(id));
          if (nextBaselineRemovals.length > currentBaselineRemovals.length) {
            console.error("Plan Lab experiment delete attempted to remove baseline events", {
              experimentId,
              addedBaselineRemovals: nextBaselineRemovals.filter(
                (id) => !currentBaselineRemovals.includes(id)
              ),
            });
            return current;
          }
        }
        return next;
      });
      if (targetGroup.bundleInstanceId) {
        setBundleInstanceOverrides((current) =>
          current.filter((record) => record.id !== targetGroup.bundleInstanceId)
        );
      }
    },
    [baselineScenarioV2.events, experimentGroups]
  );

  const removeBundleExperimentGroup = useCallback(
    (group: PlanLabExperimentGroup) => {
      deleteExperiment(group.experimentId);
    },
    [deleteExperiment]
  );

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
    closeAllPlanLabDrawers();
    setExperimentDrawerMode("add");
    setExperimentDraft(null);
    setExperimentDraftErrors({});
    setExperimentDrawerOpen(true);
  };

  const openExperimentTemplatesDrawer = () => {
    closeAllPlanLabDrawers();
    setExperimentTemplatesOpen(true);
  };

  const openPlanLabAddFlowDrawer = useCallback(
    (options?: {
      templateCategory?: TemplateCategory;
      intent?: CreationIntent;
      itemCategory?: CreationItemCategory;
    }) => {
      closeAllPlanLabDrawers();
      setExperimentTemplatesOpen(false);
      setTemplatePickerCategory(options?.templateCategory ?? "popular");
      setTemplatePickerIntent(options?.intent ?? null);
      setTemplatePickerItemCategory(options?.itemCategory ?? null);
      setTemplatePickerOpen(true);
    },
    [closeAllPlanLabDrawers]
  );

  const handleAddExperimentAction = useCallback(() => {
    if (scenarioIsV2) {
      openExperimentTemplatesDrawer();
      return;
    }
    openAddExperimentDrawer();
  }, [openAddExperimentDrawer, openExperimentTemplatesDrawer, scenarioIsV2]);

  const baselineAssumptionOverrides = useMemo(
    () => pickScenarioAssumptionOverrides(scenario.assumptions),
    [scenario.assumptions]
  );

  const openEnvAssumptionsExperimentDrawer = useCallback(
    (group?: PlanLabExperimentGroup | null) => {
      closeAllPlanLabDrawers();
      setExperimentTemplatesOpen(false);
      setEnvAssumptionsViewGroupId(group?.experimentId ?? null);
      setEnvAssumptionOverridesDraft(group ? { ...baselineAssumptionOverrides, ...(group.envOverrides ?? {}) } : baselineAssumptionOverrides);
      setEnvAssumptionsDrawerOpen(true);
    },
    [baselineAssumptionOverrides, closeAllPlanLabDrawers]
  );

  const handleSelectEnvironmentTemplate = useCallback((_envKey: string) => {
    openEnvAssumptionsExperimentDrawer(null);
  }, [openEnvAssumptionsExperimentDrawer]);


  const openEditExperimentDrawer = (experiment: PlanLabExperiment) => {
    closeAllPlanLabDrawers();
    setExperimentDrawerMode("edit");
    setExperimentDraft({ ...experiment });
    setExperimentDraftErrors({});
    setExperimentDrawerOpen(true);
  };

  const openRenameExperiment = (experiment: PlanLabExperiment) => {
    setExperimentRenameDraft({
      kind: "legacy",
      id: experiment.id,
      title: experiment.title ?? "",
    });
  };

  const openRenameExperimentGroup = (group: PlanLabExperimentGroup) => {
    setExperimentRenameDraft({
      kind: "group",
      id: group.experimentId,
      title: group.title ?? "",
    });
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

  const applyExperimentRename = () => {
    if (!experimentRenameDraft) {
      return;
    }
    const trimmed = experimentRenameDraft.title.trim();
    if (experimentRenameDraft.kind === "legacy") {
      updateExperiment(experimentRenameDraft.id, {
        title: trimmed ? trimmed : undefined,
      });
    } else {
      setExperimentGroups((current) =>
        current.map((group) =>
          group.experimentId === experimentRenameDraft.id
            ? { ...group, title: trimmed || "未命名實驗" }
            : group
        )
      );
    }
    setExperimentRenameDraft(null);
  };

  const openAddMemberDrawer = () => {
    closeAllPlanLabDrawers();
    setMemberDrawerMode("add");
    setEditingMemberId(null);
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

  const openEditMemberDrawer = (member: ScenarioMember) => {
    closeAllPlanLabDrawers();
    setMemberDrawerMode("edit");
    setEditingMemberId(member.id);
    setMemberDraft({
      name: member.name,
      kind: member.kind,
      birthMonth: member.birthMonth ?? "",
      ageAtBaseMonth: member.ageAtBaseMonth ?? "",
    });
    setMemberDraftErrors({});
    setChildTemplateSelections({});
    setMemberDrawerOpen(true);
  };

  const openEditEventDrawer = (addition: PlanLabDraftEventAddition) => {
    closeAllPlanLabDrawers();
    setEventDrawerMode("edit");
    setEventDraftGroup(getEventMeta(addition.definition.type).group as EventGroup);
    setEventDraftType(addition.definition.type);
    setEventDraftDefinition(addition.definition);
    setEventDraftRef(addition.ref);
    setEventDrawerOpen(true);
  };

  const handleTemplateSelect = (
    template: TemplateDef,
    options?: { initialWizardInput?: BundleWizardInput | null }
  ) => {
    closeAllPlanLabDrawers();
    if (template.isBundle) {
      setTemplatePlanUnsupportedNotice(null);
      setBundleTemplate(template);
      setBundleWizardMode("create");
      setBundleWizardInstanceId(null);
      setBundleWizardInitialInput(options?.initialWizardInput ?? null);
      setBundleWizardExperimentMode(false);
      setBundleWizardOpen(true);
      return;
    }
    const label = moneyT(`templates.${template.id}.name`);
    const draftOverrides = buildTemplateDrawerDraftOverrides(template.id, {
      baseMonth: scenario.assumptions.baseMonth,
      label,
    });

    setTemplatePlanUnsupportedNotice(null);
    setTemplateCashflowDraft(null);
    setTemplateHousingDraft(null);
    setTemplateLoanDraft(null);
    setTemplateInsuranceDraft(null);

    if (draftOverrides.drawerType === "cashflow") {
      setV2EventDefaultKind(draftOverrides.cashflow?.kind ?? "income");
      setTemplateCashflowDraft(draftOverrides.cashflow ?? null);
      openV2EventDrawer("create", "cashflow");
      return;
    }
    if (draftOverrides.drawerType === "housing") {
      setTemplateHousingDraft(draftOverrides.housing ?? null);
      openV2EventDrawer("create", "housing");
      return;
    }
    if (draftOverrides.drawerType === "loan") {
      setTemplateLoanDraft(draftOverrides.loan ?? null);
      openV2EventDrawer("create", "loan");
      return;
    }
    if (draftOverrides.drawerType === "insurance") {
      setTemplateInsuranceDraft(draftOverrides.insurance ?? null);
      openV2EventDrawer("create", "insurance");
      return;
    }
  };

  const createExperimentGroup = useCallback(
    (params: {
      title: string;
      itemIds: string[];
      bundleInstanceId?: string;
      templateId?: string;
      primaryEventId?: string;
      kind?: PlanLabExperimentGroupKind;
      envOverrides?: ScenarioAssumptionsOverride;
      changes?: string[];
      affectedEntities?: PlanLabAffectedEntity[];
    }) => {
      if (params.itemIds.length === 0 && params.kind !== "ENV_OVERRIDE") {
        return;
      }
      setExperimentGroups((current) => [
        ...current,
        {
          experimentId: `exp_group_${nanoid(8)}`,
          title: resolveExperimentGroupTitle(params.title),
          kind:
            params.kind ??
            (params.bundleInstanceId ? "BUNDLE_EXPERIMENT" : "ADD_EVENT"),
          isEnabled: true,
          itemIds: params.itemIds,
          bundleInstanceId: params.bundleInstanceId,
          templateId: params.templateId,
          primaryEventId: params.primaryEventId,
          createdAt: Date.now(),
          envOverrides: params.envOverrides,
          changes: params.changes,
          affectedEntities: params.affectedEntities,
        },
      ]);
    },
    []
  );

  const buildEnvOverrideAffectedEntities = useCallback(
    (nextOverrides: ScenarioAssumptionsOverride): PlanLabAffectedEntity[] =>
      deriveEnvOverrideAffectedEntities(
        {
          assumptions: scenario.assumptions,
          events: scenario.events,
          assets: scenario.assets,
          liabilities: scenario.liabilities,
        },
        nextOverrides,
        ENV_ASSUMPTION_LABELS
      ),
    [scenario.assets, scenario.assumptions, scenario.events, scenario.liabilities]
  );

  const saveEnvAssumptionsExperiment = useCallback(() => {
    const nextOverrides = SCENARIO_ASSUMPTION_OVERRIDE_KEYS.reduce<ScenarioAssumptionsOverride>(
      (acc, key) => {
        const draftValue = envAssumptionOverridesDraft[key];
        const baselineValue = baselineAssumptionOverrides[key];
        if (draftValue !== baselineValue) {
          acc[key] = draftValue;
        }
        return acc;
      },
      {}
    );
    if (Object.keys(nextOverrides).length === 0) {
      setEnvAssumptionsDrawerOpen(false);
      return;
    }
    const changeLines = getScenarioAssumptionOverrideEntries(nextOverrides).map(([key, value]) =>
      formatScenarioAssumptionChange(ENV_ASSUMPTION_LABELS[key], baselineAssumptionOverrides[key], value)
    );
    const affected = buildEnvOverrideAffectedEntities(nextOverrides);

    if (envAssumptionsViewGroupId) {
      setExperimentGroups((current) =>
        current.map((group) =>
          group.experimentId === envAssumptionsViewGroupId
            ? {
                ...group,
                envOverrides: nextOverrides,
                changes: changeLines,
                affectedEntities: affected,
                isEnabled: true,
                createdAt: Date.now(),
              }
            : group
        )
      );
    } else {
      createExperimentGroup({
        title: `環境假設（${formatScenarioAssumptionSummary(changeLines)}）`,
        itemIds: [],
        kind: "ENV_OVERRIDE",
        envOverrides: nextOverrides,
        changes: changeLines,
        affectedEntities: affected,
      });
    }
    setEnvAssumptionsDrawerOpen(false);
    setEnvAssumptionsViewGroupId(null);
  }, [
    baselineAssumptionOverrides,
    buildEnvOverrideAffectedEntities,
    createExperimentGroup,
    envAssumptionOverridesDraft,
    envAssumptionsViewGroupId,
  ]);

  const applyExperimentTemplateToEvent = useCallback(
    (eventId: string) => {
      if (!experimentTemplateContext) {
        return false;
      }
      createExperimentGroup({
        title: experimentTemplateContext.title,
        itemIds: [`events:${eventId}`],
        primaryEventId: eventId,
      });
      setExperimentTemplateContext(null);
      return true;
    },
    [createExperimentGroup, experimentTemplateContext]
  );

  const showSingleItemPackPrompt = useCallback((itemId: string, itemLabel?: string | null) => {
    setBundleExperimentCta({
      source: "single",
      title: resolveSingleItemExperimentTitle(itemLabel),
      itemCount: 1,
      itemIds: [itemId],
      primaryItemId: itemId,
      primaryItemLabel: itemLabel ?? undefined,
    });
  }, []);

  const handleApplyBundleEvents = useCallback(
    (
      events: ScenarioV2EventDraft[],
      options?: { packAsExperiment?: boolean; experimentTitle?: string },
      _context?: { bundleInstanceId: string; wizardInput: BundleWizardInput }
    ) => {
      if (!scenarioIsV2 || events.length === 0) {
        return { ok: false, error: translate("bundleApplyFailed", "Failed to create plan bundle.") };
      }
      const prevIds = new Set(collectPatchItemIds(scenarioV2Patches));
      const parsedEvents = events
        .map((event) => {
          const candidate = {
            ...event,
            id: event.id ?? `evt_v2_bundle_${nanoid(8)}`,
          };
          const parsed = ScenarioEventSchema.safeParse(candidate);
          if (!parsed.success) {
            return null;
          }
          return parsed.data;
        })
        .filter((event): event is ScenarioEvent => Boolean(event));
      if (parsedEvents.length !== events.length) {
        return { ok: false, error: translate("bundleApplyFailed", "Failed to create plan bundle.") };
      }

      const bundleInstanceId = _context?.bundleInstanceId ?? null;
      const baselineBundleEventIds = bundleInstanceId
        ? baselineBundleEventIdsByBundleId.get(bundleInstanceId) ?? []
        : [];
      const nextItemIds = parsedEvents.map((event) => `events:${event.id}`);
      const shouldPack =
        bundleWizardExperimentMode || options?.packAsExperiment !== false;
      const experimentTitle = resolveBundleExperimentTitle(
        _context?.wizardInput,
        options?.experimentTitle
      );

      setScenarioV2Patches((current) => {
        if (!bundleInstanceId) {
          return {
            ...current,
            events: {
              add: [...current.events.add, ...parsedEvents],
              update: current.events.update,
              remove: current.events.remove.filter(
                (id) => !parsedEvents.some((event) => event.id === id)
              ),
            },
          };
        }
        const removedIds = new Set(
          current.events.add
            .filter((event) => event.source?.bundleInstanceId === bundleInstanceId)
            .map((event) => event.id)
        );
        const filteredAdd = current.events.add.filter(
          (event) => event.source?.bundleInstanceId !== bundleInstanceId
        );
        const filteredUpdate = { ...current.events.update };
        removedIds.forEach((id) => delete filteredUpdate[id]);
        const filteredRemove = current.events.remove.filter((id) => !removedIds.has(id));
        const nextRemove = new Set(filteredRemove);
        baselineBundleEventIds.forEach((id) => {
          if (!parsedEvents.some((event) => event.id === id)) {
            nextRemove.add(id);
          }
        });
        return {
          ...current,
          events: {
            add: [...filteredAdd, ...parsedEvents],
            update: filteredUpdate,
            remove: Array.from(nextRemove).filter(
              (id) => !parsedEvents.some((event) => event.id === id)
            ),
          },
        };
      });

      const newItemIds = bundleInstanceId
        ? nextItemIds
        : nextItemIds.filter((itemId) => !prevIds.has(itemId));

      if (shouldPack) {
        setExperimentGroups((current) => {
          if (!bundleInstanceId) {
            return [
              ...current,
              {
                experimentId: `exp_group_${nanoid(8)}`,
                title: resolveExperimentGroupTitle(experimentTitle),
                isEnabled: true,
                itemIds: nextItemIds,
                createdAt: Date.now(),
                templateId: _context?.wizardInput?.templateId,
              },
            ];
          }
          const existingIndex = current.findIndex(
            (group) => group.bundleInstanceId === bundleInstanceId
          );
          if (existingIndex === -1) {
            return [
              ...current,
              {
                experimentId: `exp_group_${nanoid(8)}`,
                title: resolveExperimentGroupTitle(experimentTitle),
                isEnabled: true,
                itemIds: nextItemIds,
                bundleInstanceId,
                templateId: _context?.wizardInput?.templateId,
                createdAt: Date.now(),
              },
            ];
          }
          const next = [...current];
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            title: resolveExperimentGroupTitle(experimentTitle),
            itemIds: nextItemIds,
            removedItems: [],
            bundleInstanceId,
            templateId: _context?.wizardInput?.templateId ?? existing.templateId,
          };
          return next;
        });
      } else {
        setBundleExperimentCta({
          source: "bundle",
          title: experimentTitle,
          itemCount: newItemIds.length,
          itemIds: newItemIds,
        });
      }

      if (_context?.bundleInstanceId && _context?.wizardInput) {
        setBundleInstanceOverrides((current) => {
          const next = new Map(current.map((record) => [record.id, record]));
          next.set(_context.bundleInstanceId, {
            id: _context.bundleInstanceId,
            wizardInput: _context.wizardInput as BundleWizardInput,
            updatedAt: Date.now(),
          });
          return Array.from(next.values());
        });
      }

      setPlanToast(
        translate(
          "planLabBundleAppliedToast",
          "已新增「{title}」（{count}項）",
          {
            title: experimentTitle,
            count: newItemIds.length,
          }
        )
      );

      const firstEventId = parsedEvents[0]?.id;
      setBundleWizardOpen(false);
      setBundleTemplate(null);
      setBundleWizardMode("create");
      setBundleWizardInstanceId(null);
      setBundleWizardInitialInput(null);
      setBundleWizardExperimentMode(false);
      if (firstEventId) {
        handleLocateItem(`event:${firstEventId}`);
      }
      return { ok: true };
    },
    [
      baselineBundleEventIdsByBundleId,
      handleLocateItem,
      resolveBundleExperimentTitle,
      bundleWizardExperimentMode,
      scenarioIsV2,
      scenarioV2Patches,
      t,
    ]
  );

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

    const nextMember: ScenarioMember = {
      id: editingMemberId ?? createMemberId(),
      name: memberDraft.name.trim(),
      kind: memberDraft.kind,
      birthMonth: memberDraft.birthMonth || undefined,
      ageAtBaseMonth:
        typeof memberDraft.ageAtBaseMonth === "number"
          ? memberDraft.ageAtBaseMonth
          : undefined,
    };

    if (memberDrawerMode === "edit" && editingMemberId) {
      setDraftMembers((current) =>
        current.map((member) => (member.id === editingMemberId ? nextMember : member))
      );
    } else {
      setDraftMembers((current) => [...current, nextMember]);

      if (isChildDraft && childTemplateOptions.length > 0) {
        const selectedIndexes = Object.entries(childTemplateSelections)
          .filter(([, selected]) => selected)
          .map(([index]) => Number(index))
          .filter((index) => Number.isFinite(index));
        if (selectedIndexes.length > 0) {
          const templates = buildChildBudgetRuleTemplates({
            memberId: nextMember.id,
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
    }

    setMemberDrawerOpen(false);
  };

  const handleEventDraftTypeChange = (value: string | null) => {
    if (!value) {
      setEventDraftType(null);
      setEventDraftDefinition(null);
      setEventDraftRef(null);
      return;
    }
    const type = value as EventType;
    setEventDraftType(type);
    const definition = createEventDefinitionFromTemplate(type, timeline, {
      baseCurrency: scenario.baseCurrency,
      baseMonth: scenario.assumptions.baseMonth,
      memberId: scenarioMembers[0]?.id,
    });
    setEventDraftDefinition(definition);
    setEventDraftRef(createScenarioEventRef(definition.id));
  };

  const handleEventDraftSave = (result: TimelineEventFormResult) => {
    if (!eventDraftDefinition) {
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
    const nextRef = eventDraftRef ?? createScenarioEventRef(nextDefinition.id);
    if (eventDrawerMode === "edit") {
      setDraftEvents((current) =>
        current.map((event) =>
          event.definition.id === nextDefinition.id
            ? { definition: nextDefinition, ref: nextRef }
            : event
        )
      );
    } else {
      setDraftEvents((current) => [...current, { definition: nextDefinition, ref: nextRef }]);
    }
    setEventDrawerOpen(false);
  };

  const scenarioV2Changed = useMemo(() => {
    const buildSet = <T extends { id: string }>(patches: {
      add: T[];
      update: Record<string, Partial<T>>;
    }) =>
      new Set<string>([
        ...patches.add.map((item) => item.id),
        ...Object.keys(patches.update),
      ]);
    return {
      events: buildSet(scenarioV2Patches.events),
      assets: buildSet(scenarioV2Patches.assets),
      liabilities: buildSet(scenarioV2Patches.liabilities),
      rules: buildSet(scenarioV2Patches.rules),
      addedEvents: new Set(scenarioV2Patches.events.add.map((event) => event.id)),
    };
  }, [scenarioV2Patches]);

  const hasScenarioV2Edits = useMemo(() => {
    const patchSets = [
      scenarioV2Patches.events,
      scenarioV2Patches.assets,
      scenarioV2Patches.liabilities,
      scenarioV2Patches.members,
      scenarioV2Patches.rules,
    ];
    return (
      patchSets.some(
        (patch) =>
          patch.add.length > 0 ||
          patch.remove.length > 0 ||
          Object.keys(patch.update).length > 0
      ) ||
      Object.keys(scenarioV2Patches.assumptions).length > 0 ||
      experimentGroups.some((group) => group.kind === "ENV_OVERRIDE")
    );
  }, [experimentGroups, scenarioV2Patches]);

  const upsertScenarioV2Event = useCallback(
    (event: ScenarioEvent, mode: "create" | "edit") => {
      setScenarioV2Patches((current) => {
        const events = current.events;
        const isDraft = events.add.some((item) => item.id === event.id);
        const nextAdd = isDraft
          ? events.add.map((item) => (item.id === event.id ? event : item))
          : mode === "create"
          ? [...events.add, event]
          : events.add;
        const nextUpdate = { ...events.update };
        if (!isDraft && mode === "edit") {
          nextUpdate[event.id] = event;
        } else {
          delete nextUpdate[event.id];
        }
        const nextRemove = events.remove.filter((id) => id !== event.id);
        return {
          ...current,
          events: {
            add: nextAdd,
            update: nextUpdate,
            remove: nextRemove,
          },
        };
      });
    },
    []
  );

  const removeScenarioV2Event = useCallback((eventId: string) => {
    setScenarioV2Patches((current) => {
      const events = current.events;
      const isDraft = events.add.some((item) => item.id === eventId);
      const nextAdd = isDraft
        ? events.add.filter((item) => item.id !== eventId)
        : events.add;
      const nextUpdate = { ...events.update };
      delete nextUpdate[eventId];
      const nextRemove = isDraft
        ? events.remove
        : Array.from(new Set([...events.remove, eventId]));
      return {
        ...current,
        events: {
          add: nextAdd,
          update: nextUpdate,
          remove: nextRemove,
        },
      };
    });
  }, []);

  const ensureScenarioV2EventId = (eventId?: string) =>
    eventId ?? `evt_v2_${nanoid(8)}`;

  const handleSaveV2Event = (draft: PlanLabScenarioEventDraft) => {
    if (!scenarioIsV2) {
      return;
    }
    if (draft.id) {
      if (draft.type === "adjustment") {
        const payload: AdjustmentEvent = {
          id: ensureScenarioV2EventId(draft.id),
          type: "adjustment",
          label: draft.label.trim() || undefined,
          kind: draft.kind,
          amount: Number(draft.amount),
          month: draft.month,
          memberId: draft.memberId || undefined,
          tags: draft.tags && draft.tags.length > 0 ? draft.tags : ["adjustment"],
        };
        upsertScenarioV2Event(payload, "edit");
      } else {
        const growthPayload = buildCashflowGrowthPayload({
          kind: draft.kind,
          cadence: draft.cadence,
          growthMode: draft.growthMode,
          customGrowthRatePct:
            draft.growthMode === "custom" ? Number(draft.customGrowthRatePct) : undefined,
          tags: draft.tags,
          growthSource: draft.growthSource,
        });
        const payload: CashflowEvent = {
          id: ensureScenarioV2EventId(draft.id),
          type: "cashflow",
          label: draft.label.trim() || undefined,
          kind: draft.kind,
          cadence: draft.cadence,
          amount: Number(draft.amount),
          ...growthPayload,
          startMonth: draft.cadence === "oneOff" ? undefined : draft.startMonth || undefined,
          endMonth: draft.cadence === "oneOff" ? undefined : draft.endMonth || undefined,
          occurrenceMonth: draft.cadence === "oneOff" ? draft.occurrenceMonth : undefined,
          everyNMonths:
            draft.cadence === "everyNMonths" ? Number(draft.everyNMonths) : undefined,
          memberId: draft.memberId || undefined,
          tags: draft.tags && draft.tags.length > 0 ? draft.tags : undefined,
        };
        upsertScenarioV2Event(payload, "edit");
      }
      closeV2EventDrawer();
      handleLocateItem(`event:${draft.id}`);
      return;
    }

    const createdEventId = ensureScenarioV2EventId(draft.id);
    if (draft.type === "adjustment") {
      const payload: AdjustmentEvent = {
        id: createdEventId,
        type: "adjustment",
        label: draft.label.trim() || undefined,
        kind: draft.kind,
        amount: Number(draft.amount),
        month: draft.month,
        memberId: draft.memberId || undefined,
        tags: draft.tags && draft.tags.length > 0 ? draft.tags : ["adjustment"],
      };
      upsertScenarioV2Event(payload, "create");
      if (!applyExperimentTemplateToEvent(payload.id)) {
        showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
      }
      closeV2EventDrawer();
      handleLocateItem(`event:${payload.id}`);
      return;
    }

    const growthPayload = buildCashflowGrowthPayload({
      kind: draft.kind,
      cadence: draft.cadence,
      growthMode: draft.growthMode,
      customGrowthRatePct:
        draft.growthMode === "custom" ? Number(draft.customGrowthRatePct) : undefined,
      tags: draft.tags,
      growthSource: draft.growthSource,
    });
    const payload: CashflowEvent = {
      id: createdEventId,
      type: "cashflow",
      label: draft.label.trim() || undefined,
      kind: draft.kind,
      cadence: draft.cadence,
      amount: Number(draft.amount),
      ...growthPayload,
      startMonth: draft.cadence === "oneOff" ? undefined : draft.startMonth || undefined,
      endMonth: draft.cadence === "oneOff" ? undefined : draft.endMonth || undefined,
      occurrenceMonth: draft.cadence === "oneOff" ? draft.occurrenceMonth : undefined,
      everyNMonths: draft.cadence === "everyNMonths" ? Number(draft.everyNMonths) : undefined,
      memberId: draft.memberId || undefined,
      parentEventId: salaryAdjustmentParentEventId ?? undefined,
      groupRole: salaryAdjustmentParentEventId ? "adjustment" : undefined,
      effectiveMonth:
        salaryAdjustmentParentEventId && draft.cadence !== "oneOff"
          ? draft.startMonth || undefined
          : undefined,
      meta: salaryAdjustmentParentEventId
        ? {
            kind: "adjustment",
            adjustsEventId: salaryAdjustmentParentEventId,
            parentEventId: salaryAdjustmentParentEventId,
            relationType: "adjustment",
            adjustableKey: "salary",
          }
        : undefined,
      tags:
        draft.tags && draft.tags.length > 0
          ? draft.tags
          : salaryAdjustmentParentEventId
          ? ["salary_adjustment", `salary_parent:${salaryAdjustmentParentEventId}`]
          : undefined,
    };
    upsertScenarioV2Event(payload, "create");
    if (!applyExperimentTemplateToEvent(payload.id)) {
      showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
    }
    closeV2EventDrawer();
    handleLocateItem(`event:${payload.id}`);
  };

  const handleSaveHousingEvent = (draft: HousingEventDraft) => {
    if (!scenarioIsV2) {
      return;
    }
    const payload: HousingEvent = {
      id: ensureScenarioV2EventId(draft.id),
      type: "housing",
      label: draft.label.trim() || undefined,
      kind: draft.kind,
      startMonth: draft.startMonth,
      endMonth: draft.endMonth || undefined,
      rentMonthly: draft.kind === "rent" ? Number(draft.rentMonthly) : undefined,
      rentAnnualGrowthPct:
        draft.kind === "rent" && draft.rentAnnualGrowthPct
          ? Number(draft.rentAnnualGrowthPct)
          : undefined,
      propertyGrowthMode:
        draft.kind === "mortgage" ? draft.propertyGrowthMode : undefined,
      propertyAnnualGrowthPct:
        draft.kind === "mortgage" && draft.propertyGrowthMode === "custom"
          ? Number(draft.propertyAnnualGrowthPct || 0)
          : undefined,
      purchasePrice: draft.kind === "mortgage" ? Number(draft.purchasePrice) : undefined,
      downPaymentMode: draft.kind === "mortgage" ? draft.downPaymentMode : undefined,
      downPaymentPercent:
        draft.kind === "mortgage" && draft.downPaymentPercent
          ? Number(draft.downPaymentPercent)
          : undefined,
      downPaymentAmount:
        draft.kind === "mortgage" && draft.downPaymentAmount
          ? Number(draft.downPaymentAmount)
          : undefined,
      mortgageRatePct:
        draft.kind === "mortgage" ? Number(draft.mortgageRatePct) : undefined,
      mortgageTermYears:
        draft.kind === "mortgage" ? Number(draft.mortgageTermYears) : undefined,
      mortgagePayment:
        draft.kind === "mortgage" && draft.mortgagePayment
          ? Number(draft.mortgagePayment)
          : undefined,
      mortgagePaymentIsEstimated:
        draft.kind === "mortgage" && !draft.mortgagePayment ? true : undefined,
      feesOneOff:
        draft.kind === "mortgage"
          ? draft.feesOneOff.map((fee) => ({
              id: fee.id,
              label: fee.label.trim() || undefined,
              amount: Number(fee.amount),
              month: fee.month,
            }))
          : undefined,
      ongoingCosts:
        draft.kind === "mortgage"
          ? draft.ongoingCosts.map((cost) => ({
              id: cost.id,
              label: cost.label.trim() || undefined,
              amount: Number(cost.amount),
              startMonth: cost.startMonth,
              endMonth: cost.endMonth || undefined,
            }))
          : undefined,
      rental:
        draft.kind === "mortgage" && draft.rental.enabled
          ? {
              enabled: draft.rental.enabled,
              rentMonthly: Number(draft.rental.rentMonthly),
              startMonth: draft.rental.startMonth,
              endMonth: draft.rental.endMonth || undefined,
              vacancyRatePct: draft.rental.vacancyRatePct
                ? Number(draft.rental.vacancyRatePct)
                : undefined,
              rentGrowthMode: draft.rental.rentGrowthMode,
              rentAnnualGrowthPct:
                draft.rental.rentGrowthMode === "custom"
                  ? Number(draft.rental.rentAnnualGrowthPct || 0)
                  : undefined,
            }
          : undefined,
      propertyAssetId: draft.kind === "mortgage" ? draft.propertyAssetId : undefined,
      mortgageLiabilityId:
        draft.kind === "mortgage" ? draft.mortgageLiabilityId : undefined,
      memberId: draft.memberId || undefined,
    };
    upsertScenarioV2Event(payload, draft.id ? "edit" : "create");
    if (!draft.id) {
      showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
    }
    closeV2EventDrawer();
  };

  const handleSaveLoanEvent = (draft: LoanEventDraft) => {
    if (!scenarioIsV2) {
      return;
    }
    const payload: LoanEvent = {
      id: ensureScenarioV2EventId(draft.id),
      type: "loan",
      label: draft.label.trim() || undefined,
      loanKind: draft.loanKind,
      startMonth: draft.startMonth,
      principal: Number(draft.principal),
      annualInterestRatePct: Number(draft.annualInterestRatePct),
      termYears: Number(draft.termYears),
      monthlyPayment: draft.monthlyPayment ? Number(draft.monthlyPayment) : undefined,
      paymentMethod: draft.paymentMethod,
      paymentIsEstimated: draft.paymentIsEstimated,
      purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
      downPaymentMode: draft.downPaymentMode,
      downPaymentPercent: draft.downPaymentPercent
        ? Number(draft.downPaymentPercent)
        : undefined,
      downPaymentAmount: draft.downPaymentAmount
        ? Number(draft.downPaymentAmount)
        : undefined,
      liabilityId: draft.liabilityId,
      memberId: draft.memberId || undefined,
    };
    upsertScenarioV2Event(payload, draft.id ? "edit" : "create");
    if (!draft.id) {
      showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
    }
    closeV2EventDrawer();
  };

  const handleSaveInsuranceEvent = (draft: InsuranceEventDraft) => {
    if (!scenarioIsV2) {
      return;
    }
    const payload: InsuranceEvent = {
      id: ensureScenarioV2EventId(draft.id),
      type: "insurance",
      label: draft.label.trim() || undefined,
      mode: draft.mode,
      startMonth: draft.mode === "quick" ? draft.startMonth : undefined,
      endMonth: draft.mode === "quick" ? draft.endMonth || undefined : undefined,
      premiumMonthly:
        draft.mode === "quick" ? Number(draft.premiumMonthly) : undefined,
      premiumAnnualGrowthPct:
        draft.mode === "quick" && draft.premiumAnnualGrowthPct
          ? Number(draft.premiumAnnualGrowthPct)
          : undefined,
      policies:
        draft.mode === "detailed"
          ? draft.policies.map((policy) => ({
              id: policy.id,
              name: policy.name.trim() || undefined,
              kind: policy.kind,
              premiumMonthly: Number(policy.premiumMonthly),
              premiumAnnualGrowthPct: policy.premiumAnnualGrowthPct
                ? Number(policy.premiumAnnualGrowthPct)
                : undefined,
              startMonth: policy.startMonth,
              endMonth: policy.endMonth || undefined,
              cashValue: policy.cashValue ? Number(policy.cashValue) : undefined,
              expectedAnnualReturnPct: policy.expectedAnnualReturnPct
                ? Number(policy.expectedAnnualReturnPct)
                : undefined,
              policyId: policy.policyId || undefined,
              policyAssetId: policy.policyAssetId || undefined,
            }))
          : undefined,
      memberId: draft.memberId || undefined,
    };
    upsertScenarioV2Event(payload, draft.id ? "edit" : "create");
    if (!draft.id) {
      showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
    }
    closeV2EventDrawer();
  };

  const planLabDraft: PlanLabDraft = useMemo(
    () => ({
      baselinePatches,
      experiments,
      scorecardSettings: {
        firstBucketTargetAmount:
          typeof firstBucketTargetAmount === "number" ? firstBucketTargetAmount : undefined,
        targetMonth: parseMonthStrict(targetMonthInput).ok ? targetMonthInput : undefined,
      },
      additions: {
        members: draftMembers,
        budgetRules: draftBudgetRules,
        events: draftEvents,
      },
    }),
    [
      baselinePatches,
      draftBudgetRules,
      draftEvents,
      draftMembers,
      experiments,
      firstBucketTargetAmount,
      targetMonthInput,
    ]
  );
  const debouncedPlanLabDraft = useDebouncedValue(planLabDraft, 200);

  const planSnapshot = useMemo<PlanLabSnapshot>(() => {
    const cloneSerializable = <T,>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
    return {
      baselinePatches: cloneSerializable(baselinePatches ?? {}),
      experiments: cloneSerializable(experiments ?? []),
      additions: cloneSerializable({
        members: draftMembers,
        budgetRules: draftBudgetRules,
        events: draftEvents,
      }),
      scenarioV2Patches: cloneSerializable(scenarioV2Patches),
      experimentGroups: cloneSerializable(experimentGroups),
      scorecardSettings:
        typeof firstBucketTargetAmount === "number" || parseMonthStrict(targetMonthInput).ok
          ? {
              firstBucketTargetAmount:
                typeof firstBucketTargetAmount === "number" ? firstBucketTargetAmount : undefined,
              targetMonth: parseMonthStrict(targetMonthInput).ok ? targetMonthInput : undefined,
            }
          : undefined,
    };
  }, [
    baselinePatches,
    draftBudgetRules,
    draftEvents,
    draftMembers,
    experimentGroups,
    experiments,
    firstBucketTargetAmount,
    scenarioV2Patches,
    targetMonthInput,
  ]);

  const baselineScenarioSnapshot = useMemo(() => scenario, [scenario]);
  const sandboxPatches = useMemo(
    () => buildPlanPatchesFromSnapshot(planSnapshot),
    [planSnapshot]
  );

  const sandboxMaterialized = useMemo(() => {
    if (scenarioIsV2) {
      return {
        scenario,
        eventDefinitions: [],
        budgetRules,
        addedMembers: [],
        addedBudgetRules: [],
        warnings: [],
        errors: [],
      };
    }
    return materializePlanLabDraft(scenario, planLabDraft, {
      scenarioId: scenario.id,
      budgetRules,
    });
  }, [budgetRules, planLabDraft, scenario, scenario.id, scenarioIsV2]);
  const sandboxEventLibrary = useMemo(
    () => [...eventLibrary, ...sandboxMaterialized.eventDefinitions],
    [eventLibrary, sandboxMaterialized.eventDefinitions]
  );
  const scenarioV2PatchesKey = useMemo(
    () => JSON.stringify(scenarioV2Patches),
    [scenarioV2Patches]
  );
  const experimentGroupsKey = useMemo(
    () => JSON.stringify(experimentGroups),
    [experimentGroups]
  );
  const experimentGroupsForPatches = useMemo(() => {
    if (!scenarioIsV2) {
      return experimentGroups;
    }
    return experimentGroups.map((group) => {
      if (!group.bundleInstanceId) {
        return group;
      }
      const baselineEventIds =
        baselineBundleEventIdsByBundleId.get(group.bundleInstanceId) ?? [];
      if (baselineEventIds.length === 0) {
        return group;
      }
      const baselineItemIds = baselineEventIds.map((id) => `events:${id}`);
      return {
        ...group,
        itemIds: Array.from(new Set([...group.itemIds, ...baselineItemIds])),
      };
    });
  }, [baselineBundleEventIdsByBundleId, experimentGroups, scenarioIsV2]);

  const projectionScenarioV2Patches = useMemo(() => {
    const filtered = filterScenarioV2PatchesByExperimentGroups(
      scenarioV2Patches,
      experimentGroupsForPatches
    );
    const assumptionOverrides = experimentGroupsForPatches.reduce<ScenarioAssumptionsOverride>(
      (acc, group) => {
        if (group.kind !== "ENV_OVERRIDE" || group.isEnabled === false || !group.envOverrides) {
          return acc;
        }
        return { ...acc, ...group.envOverrides };
      },
      {}
    );
    return {
      ...filtered,
      assumptions: {
        ...filtered.assumptions,
        ...assumptionOverrides,
      },
    };
  }, [experimentGroupsForPatches, scenarioV2Patches]);
  const projectionScenarioV2PatchesKey = useMemo(
    () => JSON.stringify(projectionScenarioV2Patches),
    [projectionScenarioV2Patches]
  );
  const ungroupedPatchItemIds = useMemo(
    () => collectUngroupedPatchItemIds(scenarioV2Patches, experimentGroups),
    [experimentGroupsKey, scenarioV2PatchesKey]
  );
  const packageUngroupedItemsAsExperiment = useCallback(() => {
    if (ungroupedPatchItemIds.length === 0) {
      return;
    }
    createExperimentGroup({
      title: translate("planLabUngroupedExperimentTitle", "已新增項目"),
      itemIds: ungroupedPatchItemIds,
    });
    setBundleExperimentCta(null);
  }, [createExperimentGroup, translate, ungroupedPatchItemIds]);
  const patchItemLookup = useMemo(() => {
    const map = new Map<string, { label?: string | null; type: string; amount?: number | null; startMonth?: string | null }>();
    scenarioV2Patches.events.add.forEach((event) => {
      const itemType = event.type === "cashflow" && event.kind === "income" ? "income" : "expense";
      const startMonth =
        event.type === "cashflow"
          ? event.cadence === "oneOff"
            ? event.occurrenceMonth
            : event.startMonth
          : event.type === "adjustment"
          ? event.month
          : event.startMonth;
      const amount =
        event.type === "cashflow"
          ? event.amount
          : event.type === "adjustment"
          ? event.amount
          : undefined;
      map.set(`events:${event.id}`, {
        label: event.label,
        type: itemType,
        amount,
        startMonth,
      });
    });
    scenarioV2Patches.assets.add.forEach((asset) => {
      map.set(`assets:${asset.id}`, {
        label: asset.label,
        type: "asset",
        amount: asset.currentValue,
        startMonth: asset.startMonth,
      });
    });
    scenarioV2Patches.liabilities.add.forEach((liability) => {
      map.set(`liabilities:${liability.id}`, {
        label: liability.label,
        type: "liability",
        amount: liability.principalOutstanding,
        startMonth: liability.startMonth,
      });
    });
    scenarioV2Patches.rules.add.forEach((rule) => {
      map.set(`rules:${rule.id}`, {
        label: rule.name,
        type: "expense",
        amount: rule.monthlyAmount,
        startMonth: rule.startMonth,
      });
    });
    scenarioV2Patches.members.add.forEach((member) => {
      map.set(`members:${member.id}`, {
        label: member.name,
        type: "expense",
      });
    });
    return map;
  }, [scenarioV2PatchesKey]);

  const buildRemovedItemMeta = useCallback(
    (itemId: string): PlanLabExperimentRemovedItemMeta => {
      const fallbackType = itemId.split(":")[0] || "item";
      const source = patchItemLookup.get(itemId);
      return {
        label: source?.label,
        type: source?.type ?? fallbackType,
        amount: source?.amount,
        startMonth: source?.startMonth,
      };
    },
    [patchItemLookup]
  );

  const removeItemFromExperimentGroup = useCallback(
    (experimentId: string, itemId: string) => {
      const removedAt = Date.now();
      const meta = buildRemovedItemMeta(itemId);
      let removed = false;
      setExperimentGroups((current) =>
        current.map((group) => {
          if (group.experimentId !== experimentId) {
            return group;
          }
          if (!group.itemIds.includes(itemId)) {
            return group;
          }
          const alreadyRemoved = group.removedItems?.some((item) => item.itemId === itemId);
          if (alreadyRemoved) {
            return group;
          }
          removed = true;
          return {
            ...group,
            removedItems: [...(group.removedItems ?? []), { itemId, removedAt, meta }],
          };
        })
      );
      if (!removed) {
        return;
      }
      const label = meta.label ?? itemId;
      const undoRemoval = () => {
        setExperimentGroups((current) =>
          current.map((group) =>
            group.experimentId === experimentId
              ? {
                  ...group,
                  removedItems: (group.removedItems ?? []).filter(
                    (item) => item.itemId !== itemId
                  ),
                }
              : group
          )
        );
        setExperimentToast(null);
        setUndoRemovalRevision((value) => value + 1);
      };
      setExperimentToast({
        id: `${experimentId}:${itemId}:${removedAt}`,
        color: "orange",
        message: translate("planLabExperimentItemRemovedToast", "已從實驗移除：{label}", {
          label,
        }),
        actionLabel: translate("planLabUndo", "復原"),
        onAction: undoRemoval,
      });
    },
    [buildRemovedItemMeta, translate]
  );

  const restoreItemToExperimentGroup = useCallback((experimentId: string, itemId: string) => {
    setExperimentGroups((current) =>
      current.map((group) =>
        group.experimentId === experimentId
          ? {
              ...group,
              removedItems: (group.removedItems ?? []).filter((item) => item.itemId !== itemId),
            }
          : group
      )
    );
  }, []);

  const pendingRemoveGroup = useMemo(
    () =>
      confirmRemoveGroupId
        ? experimentGroups.find((group) => group.experimentId === confirmRemoveGroupId) ?? null
        : null,
    [confirmRemoveGroupId, experimentGroupsKey]
  );
  const pendingRemoveGroupCount = pendingRemoveGroup?.itemIds?.length ?? 0;
  const pendingRemoveExperiment = useMemo(
    () =>
      confirmRemoveExperimentId
        ? experiments.find((experiment) => experiment.id === confirmRemoveExperimentId) ?? null
        : null,
    [confirmRemoveExperimentId, experiments]
  );
  const sandboxScenarioV2 = useMemo(
    () =>
      scenarioIsV2
        ? applyPlanLabScenarioV2Patches(baselineScenarioV2, projectionScenarioV2Patches)
        : buildScenarioV2FromScenario(
            sandboxMaterialized.scenario,
            sandboxEventLibrary
          ),
    [
      baselineScenarioV2,
      sandboxEventLibrary,
      sandboxMaterialized.scenario,
      projectionScenarioV2Patches,
      projectionScenarioV2PatchesKey,
      scenarioIsV2,
    ]
  );
  const debouncedSandboxScenarioV2 = useDebouncedValue(sandboxScenarioV2, 200);
  const sandboxBudgetRules = useMemo(() => {
    if (scenarioIsV2) {
      return budgetRules;
    }
    const patches = baselinePatches?.rulePatches ?? {};
    const updated = budgetRules.map((rule) => {
      const patch = patches[rule.id];
      if (!patch) {
        return rule;
      }
      return {
        ...rule,
        ...(patch.patch ?? {}),
        enabled: patch.isDisabled !== undefined ? !patch.isDisabled : rule.enabled,
        endMonth: patch.endMonth ?? rule.endMonth,
      };
    });
    return [...updated, ...draftBudgetRules];
  }, [baselinePatches?.rulePatches, budgetRules, draftBudgetRules, scenarioIsV2]);
  const snapshotPayload = useMemo(
    () =>
      buildSnapshotPayload(
        baselineScenarioV2,
        sandboxScenarioV2,
        budgetRules,
        sandboxBudgetRules
      ),
    [baselineScenarioV2, budgetRules, sandboxBudgetRules, sandboxScenarioV2]
  );
  const hasPlanSnapshotChanges = useMemo(
    () => buildPlanPatchesFromSnapshot(planSnapshot).length > 0,
    [planSnapshot]
  );
  const hasDraftAdditions =
    draftMembers.length > 0 || draftBudgetRules.length > 0 || draftEvents.length > 0;
  const workspaceSignature = useMemo(
    () =>
      JSON.stringify({
        baselinePatches,
        experiments,
        scenarioV2Patches,
        experimentGroups,
        firstBucketTargetAmount,
        targetMonth: parseMonthStrict(targetMonthInput).ok ? targetMonthInput : null,
      }),
    [
      baselinePatches,
      experimentGroups,
      experiments,
      firstBucketTargetAmount,
      scenarioV2Patches,
      targetMonthInput,
    ]
  );
  useEffect(() => {
    if (lastSyncedWorkspaceSignature === "{}") {
      setLastSyncedWorkspaceSignature(workspaceSignature);
    }
  }, [lastSyncedWorkspaceSignature, workspaceSignature]);
  const isWorkspaceDirty =
    lastSyncedWorkspaceSignature !== "{}" &&
    workspaceSignature !== lastSyncedWorkspaceSignature;
  const hasUnsavedChanges = useMemo(() => {
    if (scenarioIsV2) {
      return hasMeaningfulPatch(snapshotPayload) || hasScenarioV2Edits;
    }
    return (
      hasPlanSnapshotChanges ||
      hasDraftAdditions ||
      typeof firstBucketTargetAmount === "number"
    );
  }, [
    firstBucketTargetAmount,
    hasDraftAdditions,
    hasPlanSnapshotChanges,
    hasScenarioV2Edits,
    scenarioIsV2,
    snapshotPayload,
  ]);
  const planSnapshotWarnings = useMemo(() => {
    const warnings = detectDoubleCountingWarnings(baselineScenarioV2, snapshotPayload);
    if (!hasMeaningfulPatch(snapshotPayload)) {
      warnings.push(
        translate(
          "planLabPlanEmptyWarning",
          "No event or rule changes detected in this snapshot."
        )
      );
    }
    return warnings;
  }, [baselineScenarioV2, snapshotPayload, translate]);

  const planPatchWarnings = useMemo(() => {
    if (scenarioIsV2) {
      return [];
    }
    const warnings = validatePlanPatches({
      patches: sandboxPatches,
      scenario,
      eventLibrary,
      budgetRules,
      members,
    });
    return warnings.map((warning) =>
      warningsT.has(warning.messageKey)
        ? warningsT(warning.messageKey)
        : warning.defaultMessage
    );
  }, [budgetRules, eventLibrary, members, sandboxPatches, scenario, scenarioIsV2, warningsT]);

  const projectionMonths = Math.max(scenario.assumptions.horizonMonths ?? 0, PLANLAB_MAX_MONTHS);
  const displayMonths = scenario.assumptions.horizonMonths ?? 0;

  const legacyPlanLabProjection = usePlanLabProjectionWithLedger(
    scenarioIsV2 ? null : debouncedPlanLabDraft,
    scenarioIsV2 ? null : baselineScenarioSnapshot,
    eventLibrary,
    {
      members,
      budgetRules,
      patches: scenarioIsV2 ? [] : sandboxPatches,
      horizonMonths: projectionMonths,
    }
  );
  const legacyBaselineProjection = usePlanLabProjectionWithLedger(
    null,
    scenarioIsV2 ? null : baselineScenarioSnapshot,
    eventLibrary,
    { members, budgetRules, patches: [], horizonMonths: projectionMonths }
  );
  const v2PlanLabProjection = useProjectionWithLedger(
    scenarioIsV2 ? (debouncedSandboxScenarioV2 as unknown as Scenario) : null,
    eventLibrary,
    {
      members: sandboxScenarioV2.members ?? [],
      budgetRules: [],
      horizonMonths: projectionMonths,
    }
  );
  const v2BaselineProjection = useProjectionWithLedger(
    scenarioIsV2 ? (baselineScenarioV2 as unknown as Scenario) : null,
    eventLibrary,
    {
      members: baselineScenarioV2.members ?? [],
      budgetRules: [],
      horizonMonths: projectionMonths,
    }
  );

  const planLabProjection = scenarioIsV2 ? v2PlanLabProjection : legacyPlanLabProjection;
  const baselineProjection = scenarioIsV2 ? v2BaselineProjection : legacyBaselineProjection;

  const openV2EventDrawer = useCallback(
    (mode: "create" | "edit", type: ScenarioV2DrawerType, eventId?: string) => {
      closeAllPlanLabDrawers();
      setV2EventDrawerMode(mode);
      setV2EventDrawerType(type);
      setEditingV2EventId(eventId ?? null);
      setV2EventDrawerOpen(true);
    },
    [closeAllPlanLabDrawers]
  );

  const closeV2EventDrawer = useCallback(() => {
    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
    setSalaryAdjustmentParentEventId(null);
    setTemplateCashflowDraft(null);
    setTemplateHousingDraft(null);
    setTemplateLoanDraft(null);
    setTemplateInsuranceDraft(null);
    setExperimentTemplateContext(null);
  }, []);

  const v2EventLookup = useMemo(
    () =>
      new Map(
        (sandboxScenarioV2.events ?? []).map((event) => [event.id, event])
      ),
    [sandboxScenarioV2.events]
  );

  const editingV2Event = useMemo<ScenarioEvent | null>(() => {
    if (!editingV2EventId) {
      return null;
    }
    return v2EventLookup.get(editingV2EventId) ?? null;
  }, [editingV2EventId, v2EventLookup]);

  const editingCashflowEvent =
    editingV2Event?.type === "cashflow" || editingV2Event?.type === "adjustment"
      ? editingV2Event
      : null;
  const editingHousingEvent =
    editingV2Event?.type === "housing" ? editingV2Event : null;
  const editingLoanEvent = editingV2Event?.type === "loan" ? editingV2Event : null;
  const editingInsuranceEvent =
    editingV2Event?.type === "insurance" ? editingV2Event : null;

  const handleEditV2Event = useCallback(
    (eventId: string) => {
      const event = v2EventLookup.get(eventId);
      if (!event) {
        return;
      }
      setV2EventDefaultKind(
        event.type === "cashflow" ? event.kind : "income"
      );
      openV2EventDrawer("edit", event.type, eventId);
    },
    [openV2EventDrawer, v2EventLookup]
  );

  const openCreateExperimentFlow = useCallback(
    (target: EventExperimentTargetContext, presetAction?: EventExperimentAction) => {
      closeAllPlanLabDrawers();
      setEventExperimentLandingTarget(target);
      setEventExperimentLandingPresetAction(presetAction ?? null);
      setEventExperimentLandingOpen(true);
    },
    [closeAllPlanLabDrawers]
  );

  const openCreateSalaryAdjustmentFromBase = useCallback(
    (eventId: string) => {
      const baseEvent = v2EventLookup.get(eventId);
      if (!baseEvent || baseEvent.type !== "cashflow") {
        return;
      }
      setSalaryAdjustmentParentEventId(eventId);
      setV2EventDefaultKind("income");
      openV2EventDrawer("create", "cashflow");
    },
    [openV2EventDrawer, v2EventLookup]
  );

  const salaryAdjustmentContext = useMemo(() => {
    if (!salaryAdjustmentParentEventId) {
      return null;
    }
    const parentEvent = v2EventLookup.get(salaryAdjustmentParentEventId);
    if (!parentEvent || parentEvent.type !== "cashflow") {
      return null;
    }
    return {
      parentLabel: parentEvent.label ?? parentEvent.id,
      parentStartMonth: parentEvent.startMonth ?? null,
      parentEndMonth: parentEvent.endMonth ?? null,
    };
  }, [salaryAdjustmentParentEventId, v2EventLookup]);

  const salaryAdjustmentInitialDraft = useMemo<Partial<CashflowEventDraft> | null>(() => {
    if (!salaryAdjustmentParentEventId) {
      return null;
    }
    const parentEvent = v2EventLookup.get(salaryAdjustmentParentEventId);
    if (!parentEvent || parentEvent.type !== "cashflow") {
      return null;
    }
    return {
      kind: "income",
      cadence: "monthly",
      startMonth: parentEvent.startMonth ?? "",
      memberId: parentEvent.memberId ?? "",
      growthMode: "none",
      tags: ["salary_adjustment", `salary_parent:${parentEvent.id}`],
    };
  }, [salaryAdjustmentParentEventId, v2EventLookup]);

  const openEventExperimentDrawer = useCallback(
    (eventId?: string) => {
      closeAllPlanLabDrawers();
      const baselineEvent = (baselineScenarioV2.events ?? []).find((event) => event.id === eventId) ?? null;
      const baselineStartMonth =
        baselineEvent && baselineEvent.type === "cashflow"
          ? baselineEvent.startMonth ?? scenario.assumptions.baseMonth ?? ""
          : scenario.assumptions.baseMonth ?? "";
      const baselineEndMonth = baselineEvent && baselineEvent.type === "cashflow" ? baselineEvent.endMonth ?? "" : "";
      setEventExperimentDraft({
        targetEventId: eventId ?? null,
        amountMode: "delta",
        deltaUnit: "percent",
        amountValue: 0,
        setAmountValue: baselineEvent && baselineEvent.type === "cashflow" ? baselineEvent.amount : 0,
        startMonthMode: "offset",
        startShiftMonths: 0,
        startMonthValue: baselineStartMonth,
        startAgeYears: 0,
        startAgeMonths: 0,
        endMonthMode: "offset",
        endShiftMonths: 0,
        endMonthValue: baselineEndMonth,
        endAgeYears: 0,
        endAgeMonths: 0,
        clearEndMonth: false,
        growthMode: "unchanged",
        growthRate: 0,
      });
      setEventExperimentDrawerOpen(true);
    },
    [closeAllPlanLabDrawers]
  );

  const applyEventOverrideExperiment = useCallback(
    (baselineEvent: ScenarioEvent, spec: EventOverrideExperimentSpec) => {
      const patch = buildEventOverridePatch(baselineEvent, spec);
      if (Object.keys(patch).length === 0) {
        return false;
      }

      const changes = formatExperimentChanges(
        baselineEvent,
        spec,
        scenario.baseCurrency,
        locale
      );
      const summary = formatExperimentSummary(changes);

      setScenarioV2Patches((current) => ({
        ...current,
        events: {
          ...current.events,
          update: {
            ...current.events.update,
            [baselineEvent.id]: {
              ...(current.events.update[baselineEvent.id] ?? {}),
              ...patch,
            } as Partial<ScenarioEvent>,
          },
        },
      }));

      const itemId = `events:${baselineEvent.id}`;
      const affectedEntityType =
        baselineEvent.type === "cashflow"
          ? baselineEvent.kind === "income"
            ? "income"
            : "expense"
          : baselineEvent.type;

      setExperimentGroups((current) => [
        ...current,
        {
          experimentId: spec.id,
          title:
            changes.length > 0
              ? `${baselineEvent.label ?? baselineEvent.id}: ${summary}`
              : spec.title,
          kind: "MODIFY_BASELINE_EVENT",
          target: { baselineEventId: baselineEvent.id },
          changes,
          affectedEntities: [
            {
              itemId,
              label: baselineEvent.label ?? baselineEvent.id,
              type: affectedEntityType,
            },
          ],
          isEnabled: true,
          itemIds: [itemId],
          primaryEventId: baselineEvent.id,
          templateId: spec.type,
          createdAt: Date.now(),
        },
      ]);

      return true;
    },
    [locale, scenario.baseCurrency]
  );

  const submitEventExperiment = useCallback(() => {
    if (!eventExperimentDraft.targetEventId) {
      setPlanToast(
        translate(
          "planLabExperimentPickEvent",
          "Pick one baseline event before creating an experiment."
        )
      );
      return;
    }

    const baselineEvent = (baselineScenarioV2.events ?? []).find(
      (event) => event.id === eventExperimentDraft.targetEventId
    );
    if (!baselineEvent) {
      setPlanToast(
        translate("planLabExperimentEventMissing", "The selected baseline event no longer exists.")
      );
      return;
    }

    if (
      eventExperimentDraft.endMonthMode === "offset" &&
      eventExperimentDraft.endShiftMonths !== 0 &&
      baselineEvent.type === "cashflow" &&
      !baselineEvent.endMonth
    ) {
      setPlanToast(
        translate(
          "planLabExperimentEndOffsetRequiresBaseline",
          "Set a baseline end month before applying end-month offset."
        )
      );
      return;
    }

    let experimentChanges: EventOverrideExperimentSpec["changes"];
    let uiMetadata: EventOverrideExperimentSpec["uiMetadata"];
    try {
      const built = buildEventExperimentChanges({
        draft: eventExperimentDraft,
        baselineEvent,
        baseMonth: scenario.assumptions.baseMonth ?? "",
        members,
      });
      experimentChanges = built.changes;
      uiMetadata = built.uiMetadata;
    } catch (error) {
      console.info("[plan-lab:event-experiment:create:invalid-config]", {
        targetEventId: baselineEvent.id,
        error: error instanceof Error ? error.message : String(error),
        draft: eventExperimentDraft,
      });
      setPlanToast(
        translate(
          "planLabEventExperimentMonthInvalid",
          "Please use a valid month in YYYY-MM format."
        )
      );
      return;
    }

    const spec: EventOverrideExperimentSpec = {
      id: `event_override_${nanoid(8)}`,
      title: translate("planLabEventExperimentTitle", "Event experiment: {event}", {
        event: baselineEvent.label ?? baselineEvent.id,
      }),
      type: "event_override",
      targetEventId: baselineEvent.id,
      changes: experimentChanges,
      uiMetadata,
    };

    const created = applyEventOverrideExperiment(baselineEvent, spec);
    if (!created) {
      setPlanToast(
        translate(
          "planLabExperimentApplyFailed",
          "This event cannot be overridden with the current template."
        )
      );
      return;
    }

    setEventExperimentDrawerOpen(false);
  }, [
    applyEventOverrideExperiment,
    baselineScenarioV2.events,
    eventExperimentDraft,
    members,
    scenario.assumptions.baseMonth,
    translate,
  ]);

  const standaloneEventExperimentOptions = useMemo(
    () =>
      (baselineScenarioV2.events ?? []).map((event) => ({
        value: event.id,
        label: `${event.label ?? event.id} (${event.type === "cashflow" ? event.kind : event.type})`,
        disabled: Boolean(event.source?.bundleInstanceId),
      })),
    [baselineScenarioV2.events]
  );

  const baselineEventTemplateOptions = useMemo(
    () =>
      (baselineScenarioV2.events ?? []).map((event) => ({
        id: event.id,
        title: event.label ?? event.id,
        description: event.type === "cashflow" ? event.kind : event.type,
        disabled: Boolean(event.source?.bundleInstanceId),
      })),
    [baselineScenarioV2.events]
  );

  const baselineEditableIncomeEvents = useMemo<CashflowEvent[]>(
    () =>
      (baselineScenarioV2.events ?? []).filter(
        (event): event is CashflowEvent =>
          event.type === "cashflow" &&
          event.kind === "income" &&
          event.cadence !== "oneOff" &&
          !event.source?.bundleInstanceId
      ),
    [baselineScenarioV2.events]
  );

  const decisionTemplateOptions = useMemo(
    () =>
      buildPlanLabDecisionTemplateOptions({
        hasEligibleIncomeEvent: baselineEditableIncomeEvents.length > 0,
        translate,
        selectedCostProfile: scenario.meta?.planLab?.decisionTemplateCostProfile ?? {},
      }).map((option) => ({
        ...option,
        availability: option.availability.reasonKey
          ? {
              ...option.availability,
              reasonFallback: translate(
                option.availability.reasonKey,
                option.availability.reasonFallback ?? ""
              ),
            }
          : option.availability,
      })),
    [
      baselineEditableIncomeEvents.length,
      scenario.meta?.planLab?.decisionTemplateCostProfile,
      translate,
    ]
  );

  const handleSelectDecisionTemplate = useCallback(
    (templateId: PlanLabDecisionTemplateId) => {
      const selectedCostProfile =
        decisionTemplateOptions.find((option) => option.id === templateId)
          ?.selectedCostProfile ?? "median";

      if (templateId !== "income_shock" && templateId !== "retirement") {
        const templateMap: Partial<Record<PlanLabDecisionTemplateId, TemplateId>> = {
          marriage: "life_marriage_plan",
          childbirth: "life_new_baby_plan",
          parenting: "life_new_baby_plan",
          home_purchase: "life_home_purchase",
          rental_plan: "life_rental_plan",
        };
        const mappedTemplateId = templateMap[templateId];
        if (!mappedTemplateId) {
          setPlanToast(
            translate(
              "planLabDecisionTemplateMissing",
              "This decision template is currently unavailable."
            )
          );
          return;
        }
        const template = getTemplateDef(mappedTemplateId);
        if (!template) {
          setPlanToast(
            translate(
              "planLabDecisionTemplateMissing",
              "This decision template is currently unavailable."
            )
          );
          return;
        }
        const initialWizardInput = buildBundleWizardInputForDecisionTemplate({
          templateId,
          selectedCostProfile,
          baseMonth: scenario.assumptions.baseMonth ?? null,
        });
        setExperimentTemplatesOpen(false);
        handleTemplateSelect(template, { initialWizardInput });
        return;
      }

      if (templateId === "retirement") {
        setPlanToast(
          translate(
            "planLabDecisionTemplateMissing",
            "This decision template is currently unavailable."
          )
        );
        return;
      }

      const targetIncomeEvent = [...baselineEditableIncomeEvents].sort(
        (left, right) => right.amount - left.amount
      )[0];
      if (!targetIncomeEvent) {
        setPlanToast(
          translate(
            "planLabDecisionTemplateIncomeShockDisabled",
            "No editable baseline income event available."
          )
        );
        return;
      }

      const payload = buildIncomeShockDefaultPayload({
        baseMonth: scenario.assumptions.baseMonth ?? null,
        fallbackStartMonth: targetIncomeEvent.startMonth ?? null,
      });
      if (!payload) {
        setPlanToast(
          translate(
            "planLabDecisionTemplateIncomeShockInvalidMonth",
            "Cannot resolve default months for this income shock template."
          )
        );
        return;
      }

      const spec: EventOverrideExperimentSpec = {
        id: `event_override_${nanoid(8)}`,
        title: translate(
          "planLabDecisionTemplateIncomeShockExperimentTitle",
          "Income shock: {event}",
          { event: targetIncomeEvent.label ?? targetIncomeEvent.id }
        ),
        type: "event_override",
        targetEventId: targetIncomeEvent.id,
        changes: {
          amountMultiplier: payload.amountMultiplier,
          startMonth: payload.startMonth,
          setEndMonth: payload.endMonth,
        },
        uiMetadata: {
          startTimingMode: "month",
          endTimingMode: "month",
        },
      };

      const created = applyEventOverrideExperiment(targetIncomeEvent, spec);
      if (!created) {
        setPlanToast(
          translate(
            "planLabExperimentApplyFailed",
            "This event cannot be overridden with the current template."
          )
        );
        return;
      }

      setExperimentTemplatesOpen(false);
      setPlanToast(
        translate(
          "planLabDecisionTemplateApplied",
          "Decision template applied: {title}",
          { title: targetIncomeEvent.label ?? targetIncomeEvent.id }
        )
      );
    },
    [
      applyEventOverrideExperiment,
      baselineEditableIncomeEvents,
      closeAllPlanLabDrawers,
      handleTemplateSelect,
      decisionTemplateOptions,
      openV2EventDrawer,
      sandboxScenarioV2.events,
      scenario.assumptions.baseMonth,
      translate,
    ]
  );
  const handleSelectDecisionTemplateCostProfile = useCallback(
    (templateId: PlanLabDecisionTemplateId, tier: PlanLabCostProfileTier) => {
      updateScenarioMeta(scenario.id, {
        planLab: {
          ...(scenario.meta?.planLab ?? {}),
          decisionTemplateCostProfile: {
            ...(scenario.meta?.planLab?.decisionTemplateCostProfile ?? {}),
            [templateId]: tier,
          },
        },
      });
    },
    [scenario.id, scenario.meta?.planLab, updateScenarioMeta]
  );

  const environmentTemplateOptions = useMemo(
    () => [
      {
        id: "budget-rule",
        title: translate("planLabEmptyStateAssumptionsAction", "修改環境假設"),
        description: translate("planLabEnvOverrideDesc", "對齊設定頁全局假設結構。"),
      },
    ],
    [translate]
  );

  const eventExperimentLandingEvent = useMemo(
    () =>
      eventExperimentLandingTarget
        ? (baselineScenarioV2.events ?? []).find((event) => event.id === eventExperimentLandingTarget.eventId) ?? null
        : null,
    [baselineScenarioV2.events, eventExperimentLandingTarget]
  );

  const selectedEventExperimentEvent = useMemo(
    () =>
      eventExperimentDraft.targetEventId
        ? (baselineScenarioV2.events ?? []).find((event) => event.id === eventExperimentDraft.targetEventId) ?? null
        : null,
    [baselineScenarioV2.events, eventExperimentDraft.targetEventId]
  );

  const selectedEventExperimentMember = useMemo(
    () =>
      selectedEventExperimentEvent?.memberId
        ? members.find((member) => member.id === selectedEventExperimentEvent.memberId) ?? null
        : null,
    [members, selectedEventExperimentEvent?.memberId]
  );
  const selectedEventExperimentBirthMonth = selectedEventExperimentMember?.birthMonth;
  const eventExperimentCanUseAgeMode =
    isMemberLinkedEvent(selectedEventExperimentEvent) && Boolean(selectedEventExperimentBirthMonth);

  useEffect(() => {
    if (eventExperimentCanUseAgeMode) {
      return;
    }
    setEventExperimentDraft((current) => {
      let changed = false;
      const next: EventExperimentDraft = { ...current };
      if (next.startMonthMode === "age") {
        next.startMonthMode = "month";
        changed = true;
      }
      if (next.endMonthMode === "age") {
        next.endMonthMode = "month";
        changed = true;
      }
      return changed ? next : current;
    });
  }, [eventExperimentCanUseAgeMode]);

  useEffect(() => {
    if (!selectedEventExperimentEvent || selectedEventExperimentEvent.type !== "cashflow") {
      return;
    }
    setEventExperimentDraft((current) => {
      if (current.targetEventId !== selectedEventExperimentEvent.id) {
        return current;
      }
      const startMonth =
        selectedEventExperimentEvent.startMonth ?? scenario.assumptions.baseMonth ?? "";
      const endMonth = selectedEventExperimentEvent.endMonth ?? "";
      if (
        current.startMonthValue === startMonth &&
        current.endMonthValue === endMonth &&
        current.setAmountValue !== null
      ) {
        return current;
      }
      const startAge =
        selectedEventExperimentEvent.memberId && selectedEventExperimentBirthMonth
          ? yyyymmToAge(selectedEventExperimentBirthMonth, startMonth)
          : null;
      const endAge =
        selectedEventExperimentEvent.memberId && selectedEventExperimentBirthMonth && endMonth
          ? yyyymmToAge(selectedEventExperimentBirthMonth, endMonth)
          : null;
      return {
        ...current,
        startMonthValue: startMonth,
        endMonthValue: endMonth,
        startAgeYears: startAge?.years ?? current.startAgeYears,
        startAgeMonths: startAge?.months ?? current.startAgeMonths,
        endAgeYears: endAge?.years ?? current.endAgeYears,
        endAgeMonths: endAge?.months ?? current.endAgeMonths,
        setAmountValue:
          current.setAmountValue === null ? selectedEventExperimentEvent.amount : current.setAmountValue,
      };
    });
  }, [scenario.assumptions.baseMonth, selectedEventExperimentBirthMonth, selectedEventExperimentEvent]);

  const eventExperimentPreviewAmount = useMemo(() => {
    if (!selectedEventExperimentEvent || selectedEventExperimentEvent.type !== "cashflow") {
      return null;
    }
    if (eventExperimentDraft.amountMode === "set") {
      return typeof eventExperimentDraft.setAmountValue === "number"
        ? Math.max(0, Math.round(eventExperimentDraft.setAmountValue))
        : null;
    }
    if (eventExperimentDraft.deltaUnit === "percent") {
      return Math.round(
        selectedEventExperimentEvent.amount *
          (1 + eventExperimentDraft.amountValue / 100)
      );
    }
    return Math.round(selectedEventExperimentEvent.amount + eventExperimentDraft.amountValue);
  }, [
    eventExperimentDraft.amountMode,
    eventExperimentDraft.amountValue,
    eventExperimentDraft.deltaUnit,
    eventExperimentDraft.setAmountValue,
    selectedEventExperimentEvent,
  ]);

  const baselineEventStartMonth =
    selectedEventExperimentEvent && selectedEventExperimentEvent.type === "cashflow"
      ? selectedEventExperimentEvent.startMonth ?? scenario.assumptions.baseMonth ?? ""
      : scenario.assumptions.baseMonth ?? "";
  const normalizedStartMonthValue = normalizeYYYYMM(eventExperimentDraft.startMonthValue);
  const normalizedEndMonthValue = normalizeYYYYMM(eventExperimentDraft.endMonthValue);
  const startMonthInputInvalid =
    eventExperimentDraft.startMonthMode === "month" && !normalizedStartMonthValue;
  const endMonthInputInvalid =
    eventExperimentDraft.endMonthMode === "month" && !eventExperimentDraft.clearEndMonth && !normalizedEndMonthValue;
  const resolvedExperimentStartMonth =
    eventExperimentDraft.startMonthMode === "month"
      ? normalizedStartMonthValue ?? baselineEventStartMonth
      : eventExperimentDraft.startMonthMode === "age"
      ? ageToYYYYMM(
          selectedEventExperimentBirthMonth ?? "",
          eventExperimentDraft.startAgeYears * 12 + eventExperimentDraft.startAgeMonths
        ) ?? baselineEventStartMonth
      : addMonthsToMonth(baselineEventStartMonth, eventExperimentDraft.startShiftMonths);
  const resolvedExperimentEndMonth =
    eventExperimentDraft.endMonthMode === "month"
      ? eventExperimentDraft.clearEndMonth
        ? null
        : normalizedEndMonthValue
      : eventExperimentDraft.endMonthMode === "age"
      ? ageToYYYYMM(
          selectedEventExperimentBirthMonth ?? "",
          eventExperimentDraft.endAgeYears * 12 + eventExperimentDraft.endAgeMonths
        )
      : selectedEventExperimentEvent && selectedEventExperimentEvent.type === "cashflow" && selectedEventExperimentEvent.endMonth
        ? addMonthsToMonth(selectedEventExperimentEvent.endMonth, eventExperimentDraft.endShiftMonths)
        : null;
  const eventExperimentRangeInvalid =
    Boolean(resolvedExperimentEndMonth) &&
    Boolean(resolvedExperimentStartMonth) &&
    monthIndex(resolvedExperimentStartMonth, resolvedExperimentEndMonth as string) < 0;
  const eventExperimentPercentOnZero =
    selectedEventExperimentEvent?.type === "cashflow" &&
    selectedEventExperimentEvent.amount === 0 &&
    eventExperimentDraft.amountMode === "delta" &&
    eventExperimentDraft.deltaUnit === "percent";
  const canSubmitEventExperiment =
    Boolean(eventExperimentDraft.targetEventId) &&
    !eventExperimentRangeInvalid &&
    !(eventExperimentDraft.startMonthMode === "age" && !eventExperimentCanUseAgeMode) &&
    !(eventExperimentDraft.endMonthMode === "age" && !eventExperimentCanUseAgeMode) &&
    !startMonthInputInvalid &&
    !endMonthInputInvalid &&
    !(eventExperimentDraft.amountMode === "set" && typeof eventExperimentDraft.setAmountValue !== "number");

  const canCreateExperimentFromItem = useCallback(
    (item: ScenarioEditorItem): boolean => {
      if (scenarioIsV2) {
        return item.kind === "event" && Boolean(item.eventId) && !item.bundleInstanceId;
      }
      return item.kind === "event" || item.kind === "rule" || item.kind === "position";
    },
    [scenarioIsV2]
  );

  const handleCreateExperimentFromItem = useCallback(
    (item: ScenarioEditorItem) => {
      if (scenarioIsV2) {
        if (item.kind === "event" && item.eventId) {
          openCreateExperimentFlow({
            eventId: item.eventId,
            isChild: Boolean(item.sourceEventId && item.eventId && item.sourceEventId !== item.eventId),
            parentEventId: item.sourceEventId ?? undefined,
          });
          return;
        }
        setPlanToast(
          translate("planLabExperimentUnsupported", "此項目暫未支援新增實驗。")
        );
        return;
      }
      openEditingItem(item);
    },
    [openCreateExperimentFlow, openEditingItem, scenarioIsV2, translate]
  );

  const createSegmentDeleteExperiment = useCallback(
    (segmentEventId: string, baseEventId?: string) => {
      const baselineEvent = (baselineScenarioV2.events ?? []).find(
        (event) => event.id === segmentEventId
      );
      if (!baselineEvent) {
        setPlanToast(translate("planLabExperimentEventMissing", "找不到目標事件。"));
        return;
      }

      setScenarioV2Patches((current) => ({
        ...current,
        events: {
          ...current.events,
          remove: Array.from(new Set([...current.events.remove, segmentEventId])),
          update: Object.fromEntries(
            Object.entries(current.events.update).filter(([id]) => id !== segmentEventId)
          ),
        },
      }));

      const segmentLabel =
        baselineEvent.type === "cashflow"
          ? `${baselineEvent.startMonth ?? "--"}~${baselineEvent.endMonth ?? translate("planLabOpenEnded", "持續中")}`
          : baselineEvent.id;
      const itemId = `events:${segmentEventId}`;
      setExperimentGroups((current) => [
        ...current,
        {
          experimentId: `segment_delete_${nanoid(8)}`,
          title: `調整：${baselineEvent.label ?? baselineEvent.id}（${segmentLabel}）`,
          kind: "MODIFY_BASELINE_EVENT",
          target: { baselineEventId: baseEventId ?? segmentEventId },
          changes: [translate("planLabSegmentDeleteSummary", "模擬刪除此調整段")],
          affectedEntities: [
            {
              itemId,
              label: baselineEvent.label ?? baselineEvent.id,
              type: "cashflow",
            },
          ],
          isEnabled: true,
          itemIds: [itemId],
          primaryEventId: segmentEventId,
          templateId: "segment.delete",
          createdAt: Date.now(),
        },
      ]);
    },
    [baselineScenarioV2.events, setScenarioV2Patches, translate]
  );

  const handleEventExperimentLandingAction = useCallback(
    (action: EventExperimentAction) => {
      if (!eventExperimentLandingTarget) {
        return;
      }
      if (action === "edit") {
        openEventExperimentDrawer(eventExperimentLandingTarget.eventId);
        return;
      }
      if (action === "add_adjustment") {
        if (eventExperimentLandingTarget.isChild) {
          setPlanToast(
            translate(
              "planLabChildAddAdjustmentHint",
              "需在 Parent 事件新增調整。"
            )
          );
          return;
        }
        openCreateSalaryAdjustmentFromBase(eventExperimentLandingTarget.eventId);
        return;
      }
      const shouldRemove = window.confirm(
        translate(
          "planLabExperimentLandingRemoveConfirm",
          "此操作會建立一個移除事件的實驗。是否繼續？"
        )
      );
      if (!shouldRemove) {
        return;
      }
      createSegmentDeleteExperiment(
        eventExperimentLandingTarget.eventId,
        eventExperimentLandingTarget.parentEventId ?? eventExperimentLandingTarget.eventId
      );
      setEventExperimentLandingOpen(false);
      setEventExperimentLandingTarget(null);
      setEventExperimentLandingPresetAction(null);
    },
    [
      createSegmentDeleteExperiment,
      eventExperimentLandingTarget,
      openCreateSalaryAdjustmentFromBase,
      openEventExperimentDrawer,
      t,
    ]
  );

  const scenarioItems = useMemo<ScenarioEditorItem[]>(() => {
    if (scenarioIsV2) {
      return deriveInputsFromScenarioV2({
        scenario: baselineScenarioV2,
        members: baselineScenarioV2.members ?? [],
        rules: sandboxBudgetRules,
        changed: scenarioV2Changed,
      });
    }
    const items: ScenarioEditorItem[] = [];
    const combinedEventLibrary = [...eventLibrary, ...draftEventDefinitions];
    const definitionById = new Map(combinedEventLibrary.map((definition) => [definition.id, definition]));
    const combinedEventRefs = [
      ...(scenario.eventRefs ?? []),
      ...draftEventRefs,
    ];
    const eventViews = buildScenarioEventViews(
      {
        ...scenario,
        eventRefs: combinedEventRefs,
      },
      combinedEventLibrary
    );
    const draftEventIds = new Set(draftEventDefinitions.map((definition) => definition.id));
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
        defaultMemberId: definitionById.get(view.definition.id)?.memberId ?? null,
        startMonth: rule.startMonth,
        endMonth: patch?.endMonth ?? rule.endMonth ?? null,
        enabled: isEnabled,
        risky,
        eventRefId: view.ref.refId,
        eventDefinitionId: view.definition.id,
        eventDefinition: view.definition,
        eventRule: rule,
        eventOverrides: view.ref.overrides,
        eventSource: draftEventIds.has(view.definition.id) ? "draft" : "baseline",
        amount:
          typeof rule.monthlyAmount === "number"
            ? rule.monthlyAmount
            : typeof rule.oneTimeAmount === "number"
            ? rule.oneTimeAmount
            : null,
        frequency:
          rule.mode === "schedule"
            ? "schedule"
            : typeof rule.oneTimeAmount === "number"
            ? "oneOff"
            : "monthly",
        linkState: view.linkState ?? "linked",
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
    draftEventDefinitions,
    draftEventRefs,
    eventLibrary,
    eventPatches,
    positionPatches,
    positionTitleLabels,
    rulePatches,
    scenario,
    scenarioBudgetRules,
    scenarioIsV2,
    sandboxBudgetRules,
    sandboxScenarioV2,
    scenarioV2Changed,
    smartInvestLabel,
    smartInvestPatch,
  ]);

  useEffect(() => {
    const map = new Map<string, string>();
    scenarioItems.forEach((item) => {
      if (item.bundleInstanceId) {
        map.set(item.id, item.bundleInstanceId);
      }
    });
    bundleIdByItemIdRef.current = map;
  }, [scenarioItems]);

  const standaloneItems = useMemo(
    () => scenarioItems.filter((item) => !item.bundleInstanceId),
    [scenarioItems]
  );

  const bundleInstanceRecords = useMemo(
    () => scenario.bundleInstances ?? [],
    [scenario.bundleInstances]
  );

  const baselineBundleInstanceById = useMemo(
    () => new Map(bundleInstanceRecords.map((record) => [record.id, record])),
    [bundleInstanceRecords]
  );

  const bundleInstanceOverrideById = useMemo(
    () => new Map(bundleInstanceOverrides.map((record) => [record.id, record])),
    [bundleInstanceOverrides]
  );

  const bundleInstanceById = useMemo(() => {
    const map = new Map<string, BundleInstanceRecord>();
    bundleInstanceRecords.forEach((record) => map.set(record.id, record));
    bundleInstanceOverrides.forEach((record) => map.set(record.id, record));
    return map;
  }, [bundleInstanceOverrides, bundleInstanceRecords]);

  const buildBundleGroups = useCallback(
    (events: ScenarioEvent[] | undefined) => {
      if (!scenarioIsV2) {
        return [];
      }
      const groups = new Map<
        string,
        {
          id: string;
          templateId?: string;
          bundleTitle?: string;
          events: ScenarioEvent[];
        }
      >();
      (events ?? []).forEach((event) => {
        const source = event.source;
        if (!source?.bundleInstanceId) {
          return;
        }
        const existing =
          groups.get(source.bundleInstanceId) ?? {
            id: source.bundleInstanceId,
            templateId: source.templateId,
            bundleTitle: source.bundleTitle,
            events: [],
          };
        existing.events.push(event);
        if (!existing.templateId && source.templateId) {
          existing.templateId = source.templateId;
        }
        if (!existing.bundleTitle && source.bundleTitle) {
          existing.bundleTitle = source.bundleTitle;
        }
        groups.set(source.bundleInstanceId, existing);
      });
      return Array.from(groups.values());
    },
    [scenarioIsV2]
  );

  const baselineBundleGroups = useMemo(
    () => buildBundleGroups(baselineScenarioV2.events),
    [baselineScenarioV2.events, buildBundleGroups]
  );

  const sandboxBundleGroups = useMemo(
    () => buildBundleGroups(sandboxScenarioV2.events),
    [sandboxScenarioV2.events, buildBundleGroups]
  );

  const bundleGroupById = useMemo(
    () => new Map(baselineBundleGroups.map((group) => [group.id, group])),
    [baselineBundleGroups]
  );

  useEffect(() => {
    if (!scenarioIsV2) {
      return;
    }
    const eventLookup = new Map(
      (sandboxScenarioV2.events ?? []).map((event) => [event.id, event])
    );
    const missingLinks: string[] = [];
    (sandboxScenarioV2.events ?? []).forEach((event) => {
      if (event.source?.templateId && !event.source?.bundleInstanceId) {
        missingLinks.push(`event:${event.id}`);
      }
    });
    (sandboxScenarioV2.assets ?? []).forEach((asset) => {
      if (!asset.createdByEventId) {
        return;
      }
      const event = eventLookup.get(asset.createdByEventId);
      if (event?.source?.templateId && !event.source?.bundleInstanceId) {
        missingLinks.push(`asset:${asset.id}`);
      }
    });
    (sandboxScenarioV2.liabilities ?? []).forEach((liability) => {
      if (!liability.createdByEventId) {
        return;
      }
      const event = eventLookup.get(liability.createdByEventId);
      if (event?.source?.templateId && !event.source?.bundleInstanceId) {
        missingLinks.push(`liability:${liability.id}`);
      }
    });
    if (missingLinks.length > 0) {
      console.warn(
        `[PlanLab] Bundle metadata missing for linked items: ${missingLinks.join(", ")}`
      );
    }
  }, [sandboxScenarioV2.assets, sandboxScenarioV2.events, sandboxScenarioV2.liabilities, scenarioIsV2]);

  const handleViewBundle = useCallback(
    (bundleId: string, options?: { focusSection?: BundleDrawerSection }) => {
      closeAllPlanLabDrawers();
      setBundleViewId(bundleId);
      setBundleDrawerFocus(options?.focusSection ?? null);
    },
    [closeAllPlanLabDrawers]
  );

  const handleEditBundle = useCallback(
    (bundleId: string) => {
      const bundle = bundleGroupById.get(bundleId);
      if (!bundle) {
        return;
      }
      const record = bundleInstanceById.get(bundleId);
      if (!record) {
        setPlanToast(
          translate("planLabBundleEditMissingInput", "找不到組合設定，請重新建立。")
        );
        return;
      }
      closeAllPlanLabDrawers();
      const isExperimentBundle = experimentGroups.some(
        (group) => group.bundleInstanceId === bundleId
      );
      const templateDef = record.wizardInput?.templateId
        ? getTemplateDef(record.wizardInput.templateId)
        : bundle.templateId
        ? getTemplateDef(bundle.templateId as TemplateId)
        : null;
      if (!templateDef || !record.wizardInput) {
        setPlanToast(
          translate("planLabBundleEditMissingInput", "找不到組合設定，請重新建立。")
        );
        return;
      }
      setBundleWizardMode("edit");
      setBundleWizardInstanceId(bundleId);
      setBundleWizardInitialInput(record.wizardInput);
      setBundleWizardExperimentMode(isExperimentBundle);
      setBundleTemplate(templateDef);
      setBundleWizardOpen(true);
    },
    [bundleGroupById, bundleInstanceById, closeAllPlanLabDrawers, experimentGroups, translate]
  );

  const handleCreateBundleExperiment = useCallback(
    (bundleId: string) => {
      const bundle = bundleGroupById.get(bundleId);
      if (!bundle) {
        return;
      }
      const record = bundleInstanceById.get(bundleId);
      if (!record) {
        setPlanToast(
          translate("planLabBundleEditMissingInput", "找不到組合設定，請重新建立。")
        );
        return;
      }
      closeAllPlanLabDrawers();
      const templateDef = record.wizardInput?.templateId
        ? getTemplateDef(record.wizardInput.templateId)
        : bundle.templateId
        ? getTemplateDef(bundle.templateId as TemplateId)
        : null;
      if (!templateDef || !record.wizardInput) {
        setPlanToast(
          translate("planLabBundleEditMissingInput", "找不到組合設定，請重新建立。")
        );
        return;
      }
      setBundleWizardMode("edit");
      setBundleWizardInstanceId(bundleId);
      setBundleWizardInitialInput(record.wizardInput);
      setBundleWizardExperimentMode(true);
      setBundleTemplate(templateDef);
      setBundleWizardOpen(true);
    },
    [bundleGroupById, bundleInstanceById, closeAllPlanLabDrawers, translate]
  );

  const handleLocateBundle = useCallback(
    (bundleId: string, options?: { openDrawer?: boolean }) => {
      handleLocateItem(buildBundleRowId(bundleId));
      if (options?.openDrawer) {
        closeAllPlanLabDrawers();
        setBundleViewId(bundleId);
        setBundleDrawerFocus(null);
      }
    },
    [closeAllPlanLabDrawers, handleLocateItem]
  );

  const openMortgageDetails = useCallback(
    (bundleId: string, eventId: string, tab: MortgageDetailTab) => {
      closeAllPlanLabDrawers();
      setLastBundleDrawerState({ bundleId, focusSection: "mortgage" });
      setMortgageDetail({ bundleId, eventId, tab });
    },
    [closeAllPlanLabDrawers]
  );

  const bundleItemsById = useMemo(() => {
    const map = new Map<string, ScenarioEditorItem[]>();
    scenarioItems.forEach((item) => {
      if (!item.bundleInstanceId) {
        return;
      }
      const items = map.get(item.bundleInstanceId) ?? [];
      items.push(item);
      map.set(item.bundleInstanceId, items);
    });
    map.forEach((items, key) => {
      items.sort((left, right) => left.title.localeCompare(right.title));
      map.set(key, items);
    });
    return map;
  }, [scenarioItems]);

  const baselineScenarioAssets = useMemo(
    () => baselineScenarioV2.assets ?? [],
    [baselineScenarioV2.assets]
  );

  const baselineScenarioLiabilities = useMemo(
    () => baselineScenarioV2.liabilities ?? [],
    [baselineScenarioV2.liabilities]
  );

  const bundleSummaryLabels = useMemo(
    () => ({
      mortgagePayment: moneyT("bundleDetailMortgagePaymentLabel"),
      rentalIncome: moneyT("bundleHomeRentalMonthly"),
      holdingCost: translate("planLabBundleHoldingCostLabel", "持有成本"),
      fallback: moneyT("ledgerRowFallbackLabel"),
    }),
    [moneyT, translate]
  );

  const buildLedgerRowsByEventId = useCallback(
    (entries: typeof planLabProjection.ledger) => {
      const map = new Map<string, LedgerRow[]>();
      if (!scenarioIsV2) {
        return map;
      }
      const ledgerRows: LedgerRow[] = entries
        .filter((entry) => entry.source === "event" && entry.sourceId)
        .map((entry) => {
          const kind: "income" | "expense" =
            entry.category === "income"
              ? "income"
              : entry.category === "expense"
              ? "expense"
              : entry.amount >= 0
              ? "income"
              : "expense";
          return {
            month: entry.month,
            amount: entry.amount,
            sourceEventId: entry.sourceId ?? "",
            label: entry.label ?? undefined,
            memberId: entry.memberId ?? undefined,
            kind,
          };
        });
      ledgerRows.forEach((row) => {
        if (!row.sourceEventId) {
          return;
        }
        const existing = map.get(row.sourceEventId) ?? [];
        existing.push(row);
        map.set(row.sourceEventId, existing);
      });
      map.forEach((rows, key) => {
        rows.sort((a, b) => {
          const monthSort = b.month.localeCompare(a.month);
          if (monthSort !== 0) {
            return monthSort;
          }
          return (a.label ?? "").localeCompare(b.label ?? "");
        });
        map.set(key, rows);
      });
      return map;
    },
    [scenarioIsV2]
  );

  const sandboxLedgerRowsByEventId = useMemo(
    () => buildLedgerRowsByEventId(planLabProjection.ledger),
    [buildLedgerRowsByEventId, planLabProjection.ledger]
  );

  const baselineLedgerRowsByEventId = useMemo(
    () => buildLedgerRowsByEventId(baselineProjection.ledger),
    [baselineProjection.ledger, buildLedgerRowsByEventId]
  );

  const sandboxBundleSummaryMonth = useMemo(() => {
    return (
      planLabProjection.projection?.baseMonth ??
      scenario.assumptions.baseMonth ??
      planLabProjection.months[0] ??
      null
    );
  }, [planLabProjection.months, planLabProjection.projection?.baseMonth, scenario.assumptions.baseMonth]);

  const baselineBundleSummaryMonth = useMemo(() => {
    return (
      baselineProjection.projection?.baseMonth ??
      scenario.assumptions.baseMonth ??
      baselineProjection.months[0] ??
      null
    );
  }, [baselineProjection.months, baselineProjection.projection?.baseMonth, scenario.assumptions.baseMonth]);

  const baselineBundleCards = useMemo(() => {
    if (!scenarioIsV2) {
      return [];
    }
    return baselineBundleGroups.map((bundle) => {
      const eventIds = bundle.events.map((event) => event.id);
      const cashflowSummary = computeBundleCashflowSummary(
        bundle.events,
        baselineLedgerRowsByEventId,
        baselineBundleSummaryMonth,
        bundleSummaryLabels
      );
      const assets = baselineScenarioAssets.filter(
        (asset) => asset.createdByEventId && eventIds.includes(asset.createdByEventId)
      );
      const liabilities = baselineScenarioLiabilities.filter(
        (liability) =>
          liability.createdByEventId && eventIds.includes(liability.createdByEventId)
      );
      return {
        id: bundle.id,
        title: resolveBundleTitle(bundle),
        eventIds,
        assets,
        liabilities,
        monthlyIncome: cashflowSummary.monthlyIncome,
        monthlyExpense: cashflowSummary.monthlyExpense,
        monthlyNet: cashflowSummary.monthlyNet,
        monthlySummary: cashflowSummary,
        hasMonthlyImpact: cashflowSummary.hasMonthlyImpact,
        hasStartMonthOneOffImpact: cashflowSummary.hasStartMonthOneOffImpact,
        oneOffTotal: cashflowSummary.oneOffTotal,
      };
    });
  }, [
    baselineBundleGroups,
    baselineBundleSummaryMonth,
    baselineLedgerRowsByEventId,
    baselineScenarioAssets,
    baselineScenarioLiabilities,
    bundleSummaryLabels,
    resolveBundleTitle,
    scenarioIsV2,
  ]);

  const sandboxBundleCards = useMemo(() => {
    if (!scenarioIsV2) {
      return [];
    }
    return sandboxBundleGroups.map((bundle) => {
      const cashflowSummary = computeBundleCashflowSummary(
        bundle.events,
        sandboxLedgerRowsByEventId,
        sandboxBundleSummaryMonth,
        bundleSummaryLabels
      );
      return {
        id: bundle.id,
        monthlyIncome: cashflowSummary.monthlyIncome,
        monthlyExpense: cashflowSummary.monthlyExpense,
        monthlyNet: cashflowSummary.monthlyNet,
        monthlySummary: cashflowSummary,
        hasMonthlyImpact: cashflowSummary.hasMonthlyImpact,
        hasStartMonthOneOffImpact: cashflowSummary.hasStartMonthOneOffImpact,
        oneOffTotal: cashflowSummary.oneOffTotal,
      };
    });
  }, [
    bundleSummaryLabels,
    sandboxBundleGroups,
    sandboxBundleSummaryMonth,
    sandboxLedgerRowsByEventId,
    scenarioIsV2,
  ]);

  const sandboxBundleCardById = useMemo(
    () => new Map(sandboxBundleCards.map((card) => [card.id, card])),
    [sandboxBundleCards]
  );

  const activeBundleCard = useMemo(
    () =>
      bundleViewId
        ? baselineBundleCards.find((card) => card.id === bundleViewId) ?? null
        : null,
    [baselineBundleCards, bundleViewId]
  );

  const activeBundleGroup = useMemo(
    () => (bundleViewId ? bundleGroupById.get(bundleViewId) ?? null : null),
    [bundleGroupById, bundleViewId]
  );

  const canEditActiveBundle = useMemo(() => {
    if (!activeBundleCard) {
      return false;
    }
    return experimentGroups.some((group) => group.bundleInstanceId === activeBundleCard.id);
  }, [activeBundleCard, experimentGroups]);

  const lastBundleTitle = useMemo(() => {
    if (!lastBundleDrawerState) {
      return null;
    }
    return (
      baselineBundleCards.find((card) => card.id === lastBundleDrawerState.bundleId)?.title ??
      moneyT("bundleTitleFallback")
    );
  }, [baselineBundleCards, lastBundleDrawerState, moneyT]);

  const activeBundleSummary = useMemo(
    () => activeBundleCard?.monthlySummary ?? null,
    [activeBundleCard?.monthlySummary]
  );

  useEffect(() => {
    if (!activeBundleCard || !bundleDrawerFocus) {
      return;
    }
    const sectionRefMap: Record<BundleDrawerSection, React.RefObject<HTMLDivElement>> = {
      summary: bundleSummaryRef,
      cashflow: bundleCashflowRef,
      mortgage: bundleMortgageRef,
    };
    const target = sectionRefMap[bundleDrawerFocus]?.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeBundleCard, bundleDrawerFocus]);

  const bundleDetailIncomeItems = useMemo(
    () =>
      activeBundleSummary?.breakdown.filter((item) => item.direction === "income") ??
      [],
    [activeBundleSummary?.breakdown]
  );

  const bundleDetailExpenseItems = useMemo(
    () =>
      activeBundleSummary?.breakdown.filter((item) => item.direction === "expense") ??
      [],
    [activeBundleSummary?.breakdown]
  );

  const activeBundleMortgageEvent = useMemo(() => {
    if (!activeBundleGroup) {
      return null;
    }
    return (
      activeBundleGroup.events.find(
        (event): event is HousingEvent => isMortgageHousingEvent(event)
      ) ?? null
    );
  }, [activeBundleGroup]);

  const activeBundleMortgageSummary = useMemo(() => {
    if (!activeBundleMortgageEvent) {
      return null;
    }
    const purchasePrice = activeBundleMortgageEvent.purchasePrice;
    let downPayment = 0;
    if (activeBundleMortgageEvent.downPaymentMode === "amount") {
      downPayment = activeBundleMortgageEvent.downPaymentAmount ?? 0;
    } else if (activeBundleMortgageEvent.downPaymentMode === "percent") {
      downPayment =
        (purchasePrice ?? 0) *
        ((activeBundleMortgageEvent.downPaymentPercent ?? 0) / 100);
    } else if (typeof activeBundleMortgageEvent.downPaymentAmount === "number") {
      downPayment = activeBundleMortgageEvent.downPaymentAmount ?? 0;
    }
    const loanAmount =
      typeof purchasePrice === "number"
        ? Math.max(purchasePrice - downPayment, 0)
        : null;
    return {
      eventId: activeBundleMortgageEvent.id,
      loanAmount,
      ratePct: activeBundleMortgageEvent.mortgageRatePct ?? null,
      termYears: activeBundleMortgageEvent.mortgageTermYears ?? null,
      monthlyPayment: activeBundleMortgageEvent.mortgagePayment ?? null,
    };
  }, [activeBundleMortgageEvent]);

  const mortgageDetailEvent = useMemo(() => {
    if (!mortgageDetail) {
      return null;
    }
    const match = (baselineScenarioV2.events ?? []).find(
      (event) => event.id === mortgageDetail.eventId
    );
    if (match?.type !== "housing" || match.kind !== "mortgage") {
      return null;
    }
    return match;
  }, [baselineScenarioV2.events, mortgageDetail]);

  const mortgageDetailAsset = useMemo(() => {
    if (!mortgageDetailEvent?.propertyAssetId) {
      return null;
    }
    return (
      baselineScenarioAssets.find(
        (asset) => asset.id === mortgageDetailEvent.propertyAssetId
      ) ??
      null
    );
  }, [baselineScenarioAssets, mortgageDetailEvent?.propertyAssetId]);

  const mortgageDetailLiability = useMemo(() => {
    if (!mortgageDetailEvent?.mortgageLiabilityId) {
      return null;
    }
    return (
      baselineScenarioLiabilities.find(
        (liability) => liability.id === mortgageDetailEvent.mortgageLiabilityId
      ) ?? null
    );
  }, [baselineScenarioLiabilities, mortgageDetailEvent?.mortgageLiabilityId]);

  const getScenarioItemChangeStatus = useCallback(
    (
      item: ScenarioEditorItem
    ): "added" | "updated" | "disabled" | "removed" | null => {
      if (scenarioIsV2) {
        const patchSets = {
          event: scenarioV2Patches.events,
          asset: scenarioV2Patches.assets,
          liability: scenarioV2Patches.liabilities,
          rule: scenarioV2Patches.rules,
        };
        const patchKey =
          item.kind === "event"
            ? "event"
            : item.kind === "rule"
            ? "rule"
            : item.positionKind === "asset"
            ? "asset"
            : item.positionKind === "liability"
            ? "liability"
            : null;
        if (patchKey) {
          const patchSet = patchSets[patchKey];
          const id =
            item.eventId ??
            item.ruleId ??
            item.assetId ??
            item.liabilityId ??
            item.positionKey ??
            "";
          if (patchSet.remove.includes(id)) {
            return "removed";
          }
          if (patchSet.add.some((entry) => entry.id === id)) {
            return "added";
          }
          if (patchSet.update[id]) {
            return "updated";
          }
        }
      } else {
        if (item.kind === "event") {
          if (item.eventSource === "draft") {
            return "added";
          }
          const patch = item.eventDefinitionId
            ? eventPatches[item.eventDefinitionId]
            : null;
          if (patch?.isDisabled) {
            return "disabled";
          }
          if (patch?.patch || patch?.endMonth) {
            return "updated";
          }
        }
        if (item.kind === "rule") {
          if (item.ruleSource === "draft") {
            return "added";
          }
          const patch = item.ruleId ? rulePatches[item.ruleId] : null;
          if (patch?.isDisabled) {
            return "disabled";
          }
          if (patch?.patch || patch?.endMonth) {
            return "updated";
          }
        }
        if (item.kind === "position") {
          const patch =
            item.positionKind === "smartInvest"
              ? smartInvestPatch
              : item.positionKey
              ? positionPatches[item.positionKey]
              : null;
          if (patch?.isDisabled) {
            return "disabled";
          }
          if (patch?.patch) {
            return "updated";
          }
        }
      }
      return null;
    },
    [
      eventPatches,
      positionPatches,
      rulePatches,
      scenarioIsV2,
      scenarioV2Patches.assets,
      scenarioV2Patches.events,
      scenarioV2Patches.liabilities,
      scenarioV2Patches.rules,
      smartInvestPatch,
    ]
  );

  const getActiveExperimentGroupItemIds = useCallback(
    (group: PlanLabExperimentGroup) => {
      if (!group.removedItems || group.removedItems.length === 0) {
        return group.itemIds;
      }
      const removed = new Set(group.removedItems.map((item) => item.itemId));
      return group.itemIds.filter((itemId) => !removed.has(itemId));
    },
    []
  );

  const enabledExperimentItemIds = useMemo(() => {
    if (!scenarioIsV2) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    experimentGroups.forEach((group) => {
      if (group.isEnabled === false) {
        return;
      }
      getActiveExperimentGroupItemIds(group).forEach((itemId) => ids.add(itemId));
    });
    return ids;
  }, [experimentGroups, getActiveExperimentGroupItemIds, scenarioIsV2]);

  const enabledBundleExperimentIds = useMemo(() => {
    if (!scenarioIsV2) {
      return new Set<string>();
    }
    return new Set(
      experimentGroups
        .filter((group) => group.isEnabled !== false && group.bundleInstanceId)
        .map((group) => group.bundleInstanceId as string)
    );
  }, [experimentGroups, scenarioIsV2]);

  const getExperimentItemIdForScenarioItem = useCallback(
    (item: ScenarioEditorItem): string | null => {
      if (!scenarioIsV2) {
        return null;
      }
      if (item.kind === "event" && item.eventId) {
        return `events:${item.eventId}`;
      }
      if (item.kind === "rule" && item.ruleId) {
        return `rules:${item.ruleId}`;
      }
      if (item.kind === "position" && item.positionKind === "asset" && item.assetId) {
        return `assets:${item.assetId}`;
      }
      if (
        item.kind === "position" &&
        item.positionKind === "liability" &&
        item.liabilityId
      ) {
        return `liabilities:${item.liabilityId}`;
      }
      return null;
    },
    [scenarioIsV2]
  );

  const isItemImpactedByEnabledExperiment = useCallback(
    (item: ScenarioEditorItem): boolean => {
      if (!scenarioIsV2) {
        return Boolean(getScenarioItemChangeStatus(item));
      }
      const itemId = getExperimentItemIdForScenarioItem(item);
      return itemId ? enabledExperimentItemIds.has(itemId) : false;
    },
    [
      enabledExperimentItemIds,
      getExperimentItemIdForScenarioItem,
      getScenarioItemChangeStatus,
      scenarioIsV2,
    ]
  );

  const getScenarioItemChangeBadge = useCallback(
    (item: ScenarioEditorItem): PlanLabRowBadge | null => {
      const status = getScenarioItemChangeStatus(item);
      if (!status) {
        return null;
      }
      if (status === "removed") {
        return { label: translate("planLabBadgeRemoved", "刪除"), color: "red" };
      }
      if (status === "added") {
        return { label: translate("planLabBadgeAdded", "新增"), color: "teal" };
      }
      if (status === "disabled") {
        return { label: translate("planLabBadgeDisabled", "停用"), color: "red" };
      }
      return { label: translate("planLabBadgeUpdated", "修改"), color: "yellow" };
    },
    [getScenarioItemChangeStatus, translate]
  );

  const frequencyLabels = useMemo<Record<NonNullable<ScenarioEditorItem["frequency"]>, string>>(
    () => ({
      monthly: translate("planLabFrequencyMonthly", "每月"),
      quarterly: translate("planLabFrequencyQuarterly", "每季"),
      yearly: translate("planLabFrequencyYearly", "每年"),
      oneOff: translate("planLabFrequencyOneOff", "一次性"),
      everyNMonths: translate("planLabFrequencyEveryNMonths", "每 N 個月"),
      schedule: translate("planLabFrequencySchedule", "排程"),
    }),
    [translate]
  );

  const lifecycleLabels = useMemo(
    () => ({
      oneOff: translate("planLabTagLifecycleOneOff", "一次性"),
      hasEndMonth: translate("planLabTagLifecycleHasEndMonth", "有結束月份"),
      ongoing: translate("planLabTagLifecycleOngoing", "持續"),
    }),
    [translate]
  );

  const resolveScenarioItemSource = useCallback(
    (item: ScenarioEditorItem): SharedViewSource => {
      if (isItemImpactedByEnabledExperiment(item)) {
        return "experiment-only";
      }
      if (getScenarioItemChangeStatus(item)) {
        return "applied-to-scenario";
      }
      return "baseline-only";
    },
    [getScenarioItemChangeStatus, isItemImpactedByEnabledExperiment]
  );

  const resolveScenarioItemSourceBadge = useCallback(
    (source: SharedViewSource): PlanLabRowBadge => {
      if (source === "experiment-only") {
        return {
          label: translate("planLabBadgeSourceExperimentOnly", "實驗專用"),
          color: "blue",
        };
      }
      if (source === "applied-to-scenario") {
        return {
          label: translate("planLabBadgeSourceApplied", "已套用至情境"),
          color: "teal",
        };
      }
      return {
        label: translate("planLabBadgeSourceBaselineOnly", "僅基準"),
        color: "gray",
      };
    },
    [translate]
  );

  const getScenarioItemBadges = useCallback(
    (item: ScenarioEditorItem): PlanLabRowBadge[] => {
      const badges: PlanLabRowBadge[] = [];
      if (isItemImpactedByEnabledExperiment(item)) {
        badges.push({
          label: translate("planLabBadgeAffected", "受影響"),
          color: "blue",
        });
      }
      const changeBadge = getScenarioItemChangeBadge(item);
      if (changeBadge) {
        badges.push(changeBadge);
      }
      badges.push(resolveScenarioItemSourceBadge(resolveScenarioItemSource(item)));
      return badges;
    },
    [getScenarioItemChangeBadge, isItemImpactedByEnabledExperiment, resolveScenarioItemSource, resolveScenarioItemSourceBadge, translate]
  );

  const scenarioItemMetaById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof adaptPlanLabRowMeta>>();
    scenarioItems.forEach((item) => {
      const sourceEntity: PlanLabMetaTagAdapterInput = {
        id: item.id,
        kind: item.kind,
        category: item.category,
        memberId: item.memberId ?? undefined,
        memberName: item.memberName ?? undefined,
        defaultMemberId: item.defaultMemberId ?? undefined,
        startMonth: item.startMonth,
        endMonth: item.endMonth ?? undefined,
        amount: item.amount ?? undefined,
        frequency: item.frequency,
        intervalMonths: item.intervalMonths,
        eventId: item.eventId,
        assetId: item.assetId,
        liabilityId: item.liabilityId,
        positionKind: item.positionKind,
        position: item.position,
        title: item.title,
        linkState: item.linkState,
        source: resolveScenarioItemSource(item),
      };
      const meta = adaptPlanLabRowMeta({
        row: sourceEntity,
        currency: scenario.baseCurrency,
        locale,
        frequencyLabels,
        lifecycleLabels,
        householdLabel: translate("planLabMemberHousehold", "家庭"),
        orphanedLabel: translate("planLabTagLinkStateOrphaned", "孤兒項目"),
        memberLookupRecord: Object.fromEntries(
          combinedMembers.map((member) => [member.id, member.name])
        ),
        typeLabels: {
          income: translate("eventTypeIncome", "收入"),
          expense: translate("eventTypeExpense", "支出"),
          asset: translate("assetTypeOther", "資產"),
          liability: translate("liabilityTypeOther", "負債"),
        },
        intervalMonthsLabel: (intervalMonths) =>
          translate("planLabFrequencyEveryNMonthsWithValue", "每 {count} 個月", {
            count: intervalMonths,
          }),
      })
      map.set(item.id, meta);
    });
    return map;
  }, [combinedMembers, frequencyLabels, lifecycleLabels, locale, resolveScenarioItemSource, scenario.baseCurrency, scenarioItems, translate]);

  const getScenarioItemSummary = useCallback(
    (item: ScenarioEditorItem) => scenarioItemMetaById.get(item.id)?.summary ?? "",
    [scenarioItemMetaById]
  );

  const getScenarioItemMetaTags = useCallback(
    (item: ScenarioEditorItem) => scenarioItemMetaById.get(item.id)?.tags ?? [],
    [scenarioItemMetaById]
  );

  const getScenarioItemScheduleSummary = useCallback(
    (item: ScenarioEditorItem) => {
      if (!item.adjustmentCount || item.adjustmentCount <= 0) {
        return null;
      }
      const nextLabel =
        item.adjustmentNextMonth && typeof item.adjustmentNextAmount === "number"
          ? ` · ${translate("planLabSalaryNextAdjustment", "下一次：{month} → {amount}", {
              month: item.adjustmentNextMonth,
              amount: formatCurrency(item.adjustmentNextAmount, scenario.baseCurrency, locale),
            })}`
          : "";
      return `${translate("planLabSalaryAdjustmentCount", "調整 {count} 次", {
        count: item.adjustmentCount,
      })}${nextLabel}`;
    },
    [locale, scenario.baseCurrency, translate]
  );

  const getScenarioItemPanelContent = useCallback(
    (item: ScenarioEditorItem) => {
      const summary = getScenarioItemSummary(item) || "—";
      if (!item.adjustmentSegments || item.adjustmentSegments.length === 0) {
        return <Text size="xs" c="dimmed">{summary}</Text>;
      }
      return (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">{summary}</Text>
          {item.adjustmentSegments.map((segment) => (
            <Group key={segment.eventId} justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed">
                {formatCurrency(segment.amount, scenario.baseCurrency, locale)}｜{segment.from ?? "--"} → {segment.to ?? translate("planLabOpenEnded", "持續中")}（{segment.isBase ? "Parent" : "Child"}）
              </Text>
              <Group gap={6} wrap="nowrap">
                <>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() =>
                      openCreateExperimentFlow({
                        eventId: segment.eventId,
                        isChild: !segment.isBase,
                        parentEventId: item.eventId ?? undefined,
                      })
                    }
                  >
                    {translate("planLabCreateExperimentAction", "新增實驗")}
                  </Button>
                  <Menu withinPortal position="bottom-end">
                    <Menu.Target>
                      <Button size="compact-xs" variant="subtle">
                        {translate("planLabMoreActions", "更多")}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => openScenarioItemView(item)}>
                        {translate("planLabViewDetailsAction", "查看")}
                      </Menu.Item>
                      <Menu.Item
                        onClick={() =>
                          openCreateExperimentFlow(
                            {
                              eventId: segment.eventId,
                              isChild: !segment.isBase,
                              parentEventId: item.eventId ?? undefined,
                            },
                            "edit"
                          )
                        }
                      >
                        {translate("planLabParentEditTemplate", "parent.edit（只調整 Parent）")}
                      </Menu.Item>
                      {segment.isBase ? (
                        <Menu.Item
                          onClick={() =>
                            openCreateExperimentFlow(
                              {
                                eventId: segment.eventId,
                                isChild: false,
                                parentEventId: item.eventId ?? undefined,
                              },
                              "add_adjustment"
                            )
                          }
                        >
                          {translate("planLabChildrenManageTemplate", "children.manage（管理 Child）")}
                        </Menu.Item>
                      ) : null}
                      <Menu.Item
                        color="red"
                        onClick={() =>
                          openCreateExperimentFlow(
                            {
                              eventId: segment.eventId,
                              isChild: !segment.isBase,
                              parentEventId: item.eventId ?? undefined,
                            },
                            "remove"
                          )
                        }
                      >
                        {translate("planLabSegmentDeleteAction", "segment.delete（模擬刪除）")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </>
              </Group>
            </Group>
          ))}
        </Stack>
      );
    },
    [
      getScenarioItemSummary,
      locale,
      openCreateExperimentFlow,
      openScenarioItemView,
      scenario.baseCurrency,
      t,
    ]
  );

  const getBundleChildRoleLabel = useCallback(
    (item: ScenarioEditorItem) => {
      if (item.positionKind === "asset") {
        return translate("planLabBundleChildAssetLabel", "資產");
      }
      if (item.positionKind === "liability") {
        return translate("planLabBundleChildLiabilityLabel", "按揭");
      }
      const normalizedCategory = item.category?.toLowerCase();
      if (normalizedCategory) {
        if (normalizedCategory === "income" || normalizedCategory === "expense") {
          return translate("planLabBundleChildCashflowLabel", "現金流");
        }
        return GROUP_LABEL[normalizedCategory] ?? null;
      }
      return translate("planLabBundleChildCashflowLabel", "現金流");
    },
    [translate]
  );

  const getBundleChildTitle = useCallback(
    (item: ScenarioEditorItem) => {
      const roleLabel = getBundleChildRoleLabel(item);
      if (!roleLabel) {
        return item.title;
      }
      return `${roleLabel}・${item.title}`;
    },
    [getBundleChildRoleLabel]
  );

  const getBundleChildFocusSection = useCallback(
    (item: ScenarioEditorItem): BundleDrawerSection => {
      if (item.positionKind === "liability") {
        return "mortgage";
      }
      const normalizedCategory = item.category?.toLowerCase();
      if (normalizedCategory === "mortgage") {
        return "mortgage";
      }
      if (
        normalizedCategory === "income" ||
        normalizedCategory === "expense" ||
        normalizedCategory === "expenses"
      ) {
        return "cashflow";
      }
      return "summary";
    },
    []
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

  const groupedItems = useMemo(() => {
    return buildPlanLabGroups(standaloneItems, mode, groupBy, {
      resolveGroupLabel: ({ groupBy: groupMode, item }) =>
        getGroupLabel(groupMode === "timeBucket" ? "timeline" : groupMode, item),
      resolveImpact: (item) => Math.abs(item.amount ?? 0),
      resolveStableSortValue: (item) => Number(Boolean(getScenarioItemChangeStatus(item))),
    });
  }, [getGroupLabel, getScenarioItemChangeStatus, groupBy, mode, standaloneItems]);

  const visibleBundleCards = useMemo(() => {
    if (!scenarioIsV2) {
      return [];
    }
    return baselineBundleCards;
  }, [baselineBundleCards, scenarioIsV2]);

  const optionViewModel = useMemo(
    () =>
      planLabProjection.projection
        ? projectionToOverviewViewModel(planLabProjection.projection)
        : null,
    [planLabProjection.projection]
  );

  const optionFullSeries = useMemo(() => {
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

  const optionSeries = useMemo(
    () => ({
      cash: optionFullSeries.cash.slice(0, displayMonths),
      netWorth: optionFullSeries.netWorth.slice(0, displayMonths),
      netCashflow: optionFullSeries.netCashflow.slice(0, displayMonths),
    }),
    [displayMonths, optionFullSeries.cash, optionFullSeries.netCashflow, optionFullSeries.netWorth]
  );

  const baselineFullSeries = useMemo(
    () => ({
      cash: baselineSeries.cash,
      netWorth:
        displayMode === "real"
          ? deflateSeries(
              baselineProjection.projection
                ? projectionToOverviewViewModel(baselineProjection.projection).netWorthSeries
                : []
            )
          : baselineProjection.projection
            ? projectionToOverviewViewModel(baselineProjection.projection).netWorthSeries
            : [],
      netCashflow:
        displayMode === "real"
          ? deflateSeries(
              baselineProjection.months.map((month) => ({
                month,
                value: baselineProjection.projectionNetCashflowByMonth?.[month] ?? 0,
              }))
            )
          : baselineProjection.months.map((month) => ({
              month,
              value: baselineProjection.projectionNetCashflowByMonth?.[month] ?? 0,
            })),
    }),
    [
      baselineProjection.months,
      baselineProjection.projection,
      baselineProjection.projectionNetCashflowByMonth,
      baselineSeries.cash,
      deflateSeries,
      displayMode,
    ]
  );

  const firstBucketTargetValue =
    typeof firstBucketTargetAmount === "number" ? firstBucketTargetAmount : null;
  const baselineKpis = useMemo(
    () => computePlanLabKpis(baselineProjection.projection, firstBucketTargetValue, baselineProjection.ledgerByMonth),
    [baselineProjection.ledgerByMonth, baselineProjection.projection, firstBucketTargetValue]
  );
  const optionKpis = useMemo(
    () => computePlanLabKpis(planLabProjection.projection, firstBucketTargetValue, planLabProjection.ledgerByMonth),
    [firstBucketTargetValue, planLabProjection.ledgerByMonth, planLabProjection.projection]
  );

  const scenarioItemByEventId = useMemo(() => {
    const map = new Map<string, ScenarioEditorItem>();
    scenarioItems.forEach((item) => {
      if (item.kind !== "event") {
        return;
      }
      const eventId = item.eventId ?? item.eventDefinitionId ?? item.sourceEventId;
      if (eventId) {
        map.set(eventId, item);
      }
    });
    return map;
  }, [scenarioItems]);

  const scenarioItemByRuleId = useMemo(() => {
    const map = new Map<string, ScenarioEditorItem>();
    scenarioItems.forEach((item) => {
      if (item.kind !== "rule" || !item.ruleId) {
        return;
      }
      map.set(item.ruleId, item);
    });
    return map;
  }, [scenarioItems]);

  const driverMonth = useMemo(() => {
    if (optionKpis?.minCash?.month) {
      return optionKpis.minCash.month;
    }
    if (baselineKpis?.minCash?.month) {
      return baselineKpis.minCash.month;
    }
    return planLabProjection.months[planLabProjection.months.length - 1] ?? null;
  }, [
    baselineKpis?.minCash?.month,
    optionKpis?.minCash?.month,
    planLabProjection.months,
  ]);

  const topDriversLoading = !planLabProjection.projection || !baselineProjection.projection;

  const topDrivers = useMemo(() => {
    if (!driverMonth || topDriversLoading) {
      return [];
    }
    const optionLedger = planLabProjection.ledgerByMonth[driverMonth] ?? [];
    const baselineLedger = baselineProjection.ledgerByMonth[driverMonth] ?? [];
    const totals = new Map<
      string,
      { source: PlanLabDriverSource; sourceId: string; label?: string; contribution: number }
    >();
    const accumulate = (entries: typeof optionLedger, multiplier: number) => {
      entries.forEach((entry) => {
        if (entry.source !== "event" && entry.source !== "budget") {
          return;
        }
        const key = `${entry.source}:${entry.sourceId}`;
        const source: PlanLabDriverSource =
          entry.source === "event" ? "event" : "rule";
        const existing = totals.get(key) ?? {
          source,
          sourceId: entry.sourceId,
          label: entry.label,
          contribution: 0,
        };
        existing.contribution += entry.amount * multiplier;
        if (!existing.label && entry.label) {
          existing.label = entry.label;
        }
        totals.set(key, existing);
      });
    };

    accumulate(optionLedger, 1);
    accumulate(baselineLedger, -1);

    const drivers = Array.from(totals.values()).map((entry) => {
      const scenarioItem =
        entry.source === "event"
          ? scenarioItemByEventId.get(entry.sourceId)
          : scenarioItemByRuleId.get(entry.sourceId);
      const title =
        scenarioItem?.title ??
        entry.label ??
        translate("planLabDriverFallback", "未命名項目");
      const bundleId = scenarioItem?.bundleInstanceId ?? undefined;
      const itemId = bundleId
        ? buildBundleRowId(bundleId)
        : scenarioItem?.id ?? `${entry.source}:${entry.sourceId}`;
      return {
        id: `${entry.source}:${entry.sourceId}`,
        itemId,
        source: entry.source,
        title,
        contribution: entry.contribution,
        bundleInstanceId: bundleId,
      };
    });

    return sortTopDriversByMagnitude(drivers);
  }, [
    baselineProjection.ledgerByMonth,
    driverMonth,
    planLabProjection.ledgerByMonth,
    scenarioItemByEventId,
    scenarioItemByRuleId,
    topDriversLoading,
    t,
  ]);

  const baselineCashRiskScorecard = useMemo(() => {
    if (!baselineSeries.cash || baselineSeries.cash.length === 0) {
      return null;
    }
    const bufferThreshold = computeBufferThresholdFromLedger(
      baselineProjection.ledger,
      baselineProjection.months
    );
    return computeCashRiskScorecard({
      cashSeries: baselineSeries.cash,
      bufferThreshold,
    });
  }, [baselineProjection.ledger, baselineProjection.months, baselineSeries.cash]);

  const resolveCashRiskLevel = useCallback(
    (
      scorecard: ReturnType<typeof computeCashRiskScorecard> | null
    ): "healthy" | "warning" | "danger" | "unknown" => {
      if (!scorecard) {
        return "unknown";
      }
      if (scorecard.flags.belowZero) {
        return "danger";
      }
      if (scorecard.flags.belowBuffer) {
        return "warning";
      }
      return "healthy";
    },
    []
  );

  const handleTopDriverClick = useCallback(
    (driver: PlanLabTopDriver) => {
      const monthIdx = driverMonth
        ? planLabProjection.months.indexOf(driverMonth)
        : -1;
      if (monthIdx >= 0) {
        setLockedMonthIdx(monthIdx);
        setHoverMonthIdx(monthIdx);
        setChartPreviewOpen(true);
      }
      if (driver.bundleInstanceId) {
        handleLocateBundle(driver.bundleInstanceId, { openDrawer: true });
        return;
      }
      handleLocateItem(driver.itemId);
    },
    [driverMonth, handleLocateBundle, handleLocateItem, planLabProjection.months]
  );

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

  const previewMonthScale = useMemo(
    () => buildMonthScale(chartData, { isMobile, leftGutterPx: 72, rightPaddingPx: 24 }),
    [chartData, isMobile]
  );

  const activeMonthIdx = lockedMonthIdx ?? hoverMonthIdx;

  const activeMonthKey =
    activeMonthIdx !== null && activeMonthIdx >= 0
      ? previewMonthScale.months[activeMonthIdx] ?? null
      : null;

  const cursorX = activeMonthKey ? previewMonthScale.xOfMonth(activeMonthKey) : null;

  useEffect(() => {
    if (!chartPreviewOpen) {
      setHoverMonthIdx(null);
      setLockedMonthIdx(null);
    }
  }, [chartPreviewOpen]);

  const previewTimelineRange = useMemo(() => {
    const startYM =
      planLabProjection.months[0] ??
      scenario.assumptions.baseMonth ??
      baselineProjection.months[0] ??
      null;
    const endYM =
      planLabProjection.months[Math.max(0, displayMonths - 1)] ??
      baselineProjection.months[Math.max(0, displayMonths - 1)] ??
      null;
    if (!startYM || !endYM) {
      return null;
    }
    return { startYM, endYM };
  }, [baselineProjection.months, displayMonths, planLabProjection.months, scenario.assumptions.baseMonth]);

  const previewTimelineItems = useMemo(() => {
    if (!previewTimelineRange) {
      return [];
    }
    return buildTimelineItemsForPreview(
      scenarioItems.map((item) => ({
        id: item.id,
        label: item.title,
        kind: item.kind,
        category: item.category,
        startMonth: item.startMonth,
        endMonth: item.endMonth,
        enabled: item.enabled,
        frequency: item.frequency,
      })),
      previewTimelineRange
    );
  }, [previewTimelineRange, scenarioItems]);

  const planLabNetWorthByMonth = useMemo(
    () =>
      planLabProjection.projection?.months.reduce<Record<string, number>>((acc, month, index) => {
        acc[month] = planLabProjection.projection?.netWorth[index] ?? 0;
        return acc;
      }, {}) ?? {},
    [planLabProjection.projection]
  );

  const eventLabelById = useMemo(
    () =>
      new Map(
        (baselineScenarioV2.events ?? []).map((event) => [
          event.id,
          event.label?.trim() || event.id,
        ])
      ),
    [baselineScenarioV2.events]
  );

  const bundleLabelById = useMemo(() => {
    const map = new Map<string, string>();
    bundleInstanceRecords.forEach((record) => {
      map.set(record.id, resolveBundleExperimentTitle(record.wizardInput, record.id));
    });
    baselineBundleGroups.forEach((group) => {
      if (!map.has(group.id)) {
        map.set(group.id, group.bundleTitle?.trim() || group.id);
      }
    });
    return map;
  }, [baselineBundleGroups, bundleInstanceRecords, resolveBundleExperimentTitle]);

  const renderProjectionChart = useCallback(
    (
      height: number,
      options?: {
        hideXAxis?: boolean;
        syncCrosshair?: boolean;
        fixedWidth?: number;
      }
    ) => {
      const chart = (
        <LineChart
          width={options?.fixedWidth}
          height={height}
          data={chartData}
          margin={{ left: 0, right: options?.syncCrosshair ? previewMonthScale.rightPaddingPx : 12 }}
          onMouseMove={(state) => {
            if (!options?.syncCrosshair || lockedMonthIdx !== null) {
              return;
            }
            const idx = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : null;
            setHoverMonthIdx(idx);
          }}
          onMouseLeave={() => {
            if (!options?.syncCrosshair || lockedMonthIdx !== null) {
              return;
            }
            setHoverMonthIdx(null);
          }}
          onClick={(state) => {
            if (!options?.syncCrosshair) {
              return;
            }
            const idx = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : null;
            if (idx === null) {
              return;
            }
            setLockedMonthIdx((current) => (current === idx ? null : idx));
            setHoverMonthIdx(idx);
          }}
        >
          <XAxis
            dataKey="month"
            tick={options?.syncCrosshair ? false : { fontSize: 10 }}
            tickLine={false}
            axisLine={!options?.syncCrosshair}
            hide={Boolean(options?.hideXAxis)}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            width={previewMonthScale.leftGutterPx}
            tickFormatter={(value) => formatCurrency(Number(value), undefined, locale)}
          />
          <RechartsTooltip
            formatter={(value) => formatCurrency(Number(value), undefined, locale)}
            labelFormatter={(label) => t("monthLabel", { month: label })}
          />
          <RechartsLegend verticalAlign="top" height={24} />
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="#adb5bd"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            name={mode === "compare" ? "B" : t("planLabBaselineLabel")}
          />
          <Line
            type="monotone"
            dataKey="option"
            stroke="#12b886"
            strokeWidth={2}
            dot={false}
            name={mode === "compare" ? "A" : t("planLabOptionLabel")}
          />
        </LineChart>
      );

      if (options?.fixedWidth) {
        return <div style={{ width: options.fixedWidth, height }}>{chart}</div>;
      }

      return (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>{chart}</ResponsiveContainer>
        </div>
      );
    },
    [chartData, locale, lockedMonthIdx, mode, previewMonthScale.leftGutterPx, previewMonthScale.rightPaddingPx, t]
  );

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

  const decisionSummary = useMemo(() => {
    const optionRiskLevel = resolveCashRiskLevel(cashRiskScorecard);
    const baselineRiskLevel = resolveCashRiskLevel(baselineCashRiskScorecard);
    const optionMinCash = optionKpis?.minCash?.value;
    const baselineMinCash = baselineKpis?.minCash?.value;
    const minCashDelta =
      typeof optionMinCash === "number" && typeof baselineMinCash === "number"
        ? optionMinCash - baselineMinCash
        : null;

    const optionEndNetWorth = optionKpis?.endNetWorth;
    const baselineEndNetWorth = baselineKpis?.endNetWorth;
    const endNetWorthDelta =
      typeof optionEndNetWorth === "number" && typeof baselineEndNetWorth === "number"
        ? optionEndNetWorth - baselineEndNetWorth
        : null;

    return buildPlanLabDecisionSummary({
      baseMonth: baselineProjection.projection?.baseMonth ?? null,
      baselineTargetMonth: baselineKpis?.targetMonth ?? null,
      optionTargetMonth: optionKpis?.targetMonth ?? null,
      baselineFirstNegativeCashMonth: baselineKpis?.firstNegativeCashMonth ?? null,
      optionFirstNegativeCashMonth: optionKpis?.firstNegativeCashMonth ?? null,
      baselineRiskLevel,
      optionRiskLevel,
      minCashDelta,
      endNetWorthDelta,
      topDrivers: topDrivers.map((driver) => ({
        title: driver.title,
        contribution: driver.contribution,
      })),
      translate,
    });
  }, [
    baselineCashRiskScorecard,
    baselineKpis?.endNetWorth,
    baselineKpis?.firstNegativeCashMonth,
    baselineKpis?.minCash?.value,
    baselineKpis?.targetMonth,
    baselineProjection.projection?.baseMonth,
    cashRiskScorecard,
    optionKpis?.endNetWorth,
    optionKpis?.firstNegativeCashMonth,
    optionKpis?.minCash?.value,
    optionKpis?.targetMonth,
    resolveCashRiskLevel,
    topDrivers,
    translate,
  ]);

  const targetPresetOptions = useMemo(() => {
    const netWorthSeries = baselineProjection.projection?.netWorth ?? [];
    let baselineNetWorth = netWorthSeries[0];
    if (!Number.isFinite(baselineNetWorth) || baselineNetWorth <= 1000000) {
      baselineNetWorth = 1000000;
    }
    const multipliers = [0.5, 1, 1.5, 2, 3,4 ,5];
    const rawValues = multipliers.map((multiplier) =>
      Math.round((baselineNetWorth ?? 0) * multiplier)
    );
    const roundedValues = Array.from(
      new Set(rawValues.map((value) => Math.round(value / 1000000) * 1000000))
    ).filter((value) => value > 0);


    return roundedValues.map((value) => ({
      value: String(value),
      label: formatCurrency(value, scenario.baseCurrency, locale),
    }));
  }, [baselineProjection.projection, locale, scenario.baseCurrency]);

  const targetSelectValue = useMemo(() => {
    if (typeof firstBucketTargetAmount !== "number") {
      return null;
    }
    const preset = targetPresetOptions.find(
      (option) => Number(option.value) === firstBucketTargetAmount
    );
    return preset ? preset.value : null;
  }, [firstBucketTargetAmount, targetPresetOptions]);

  useEffect(() => {
    if (typeof firstBucketTargetAmount === "number") {
      return;
    }
    const firstOption = targetPresetOptions[0];
    if (!firstOption) {
      return;
    }
    const numeric = Number(firstOption.value);
    if (Number.isFinite(numeric)) {
      setFirstBucketTargetAmount(numeric);
    }
  }, [firstBucketTargetAmount, targetPresetOptions]);

  const kpiBaseMonth = useMemo(() => {
    return (
      planLabProjection.projection?.baseMonth ??
      baselineProjection.projection?.baseMonth ??
      scenario.assumptions.baseMonth ??
      planLabProjection.months[0] ??
      baselineProjection.months[0] ??
      getCurrentMonth()
    );
  }, [
    baselineProjection.months,
    baselineProjection.projection?.baseMonth,
    planLabProjection.months,
    planLabProjection.projection?.baseMonth,
    scenario.assumptions.baseMonth,
  ]);

  const defaultTargetMonth = useMemo(() => addMonthsToMonth(kpiBaseMonth, 12), [kpiBaseMonth]);

  useEffect(() => {
    if (parseMonthStrict(targetMonthInput).ok) {
      return;
    }
    setTargetMonthInput(defaultTargetMonth);
  }, [defaultTargetMonth, targetMonthInput]);

  const targetMonth = useMemo(() => {
    const parsed = parseMonthStrict(targetMonthInput);
    return parsed.ok ? parsed.month : defaultTargetMonth;
  }, [defaultTargetMonth, targetMonthInput]);

  const hasValidTargetMonth = useMemo(() => parseMonthStrict(targetMonthInput).ok, [targetMonthInput]);

  const resolveNetWorthAtTargetMonth = useCallback(
    (series: TimeSeriesPoint[]) => {
      if (series.length === 0) {
        return { value: null as number | null, month: null as string | null, clamped: false };
      }
      const monthToUse = series.some((entry) => entry.month === targetMonth)
        ? targetMonth
        : series.find((entry) => entry.month > targetMonth)?.month ??
          series[series.length - 1]?.month ??
          targetMonth;
      const matched = series.find((entry) => entry.month === monthToUse) ?? series[series.length - 1];
      return {
        value: typeof matched?.value === "number" ? matched.value : null,
        month: matched?.month ?? null,
        clamped: matched?.month !== targetMonth,
      };
    },
    [targetMonth]
  );

  const optionNetWorthAtTargetMonth = useMemo(
    () => resolveNetWorthAtTargetMonth(optionFullSeries.netWorth),
    [optionFullSeries.netWorth, resolveNetWorthAtTargetMonth]
  );

  const baselineNetWorthAtTargetMonth = useMemo(
    () => resolveNetWorthAtTargetMonth(baselineFullSeries.netWorth),
    [baselineFullSeries.netWorth, resolveNetWorthAtTargetMonth]
  );

  const targetMonthNetWorthDelta = useMemo(() => {
    const valueA = optionNetWorthAtTargetMonth.value;
    const valueB = baselineNetWorthAtTargetMonth.value;
    if (typeof valueA !== "number" || typeof valueB !== "number") {
      return null;
    }
    return valueA - valueB;
  }, [baselineNetWorthAtTargetMonth.value, optionNetWorthAtTargetMonth.value]);

  const formatMonthLabel = useCallback(
    (month: string | null | undefined, fallback: string) =>
      month ? t("monthLabel", { month }) : fallback,
    [t]
  ); 

  type DeltaDisplay = {
    display: string;
    direction: "up" | "down" | "flat";
  };

  const kpiDiff = useMemo(
    () =>
      diffPlanLabKpis(
        optionKpis,
        baselineKpis,
        baselineProjection.projection?.baseMonth ?? null
      ),
    [baselineKpis, baselineProjection.projection?.baseMonth, optionKpis]
  );

  const formatDeltaDisplay = useCallback(
    (deltaValue: number | null, unit: string | null) => {
      if (typeof deltaValue !== "number") {
        return null;
      }
      const direction: DeltaDisplay["direction"] =
        deltaValue > 0 ? "up" : deltaValue < 0 ? "down" : "flat";
      const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "●";
      const absValue = Math.abs(deltaValue);
      const valueDisplay =
        unit === null
          ? formatCurrency(absValue, scenario.baseCurrency, locale)
          : unit === "%"
            ? (absValue * 100).toFixed(1)
            : String(absValue);
      const sign = deltaValue > 0 ? "+" : deltaValue < 0 ? "-" : "±";
      return {
        direction,
        display: `${arrow} ${sign}${valueDisplay}${unit ? ` ${unit}` : ""}`,
      };
    },
    [locale, scenario.baseCurrency]
  );
  const formatGrowthPct = useCallback(
    (value: number | null | undefined) => {
      if (!Number.isFinite(value ?? NaN)) {
        return "0";
      }
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        value ?? 0
      );
    },
    [locale]
  );

  const formatRatio = useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return translate("planLabKpiNotAvailable", "—");
      }
      return `${(value * 100).toFixed(1)}%`;
    },
    [translate]
  );

  const kpiCards = useMemo(() => {
    const notAvailable = translate("planLabKpiNotAvailable", "—");
    const targetNotReached = translate("planLabScorecardTargetNotReached", "未達標");
    const targetNotSet = translate("planLabScorecardTargetNotSet", "尚未設定目標");
    const targetNotSetHint = translate(
      "planLabScorecardTargetNotSetHint",
      "請先設定目標金額，系統才會計算達標月份。"
    );
    const targetNotReachedHint = translate(
      "planLabScorecardTargetNotReachedHint",
      "目前未達標，建議調整目標或改善現金流。"
    );
    const negativeNotReached = translate("planLabKpiNegativeEmpty", "未轉負");

    const minCashA = optionKpis?.minCash?.value ?? null;
    const minCashB = baselineKpis?.minCash?.value ?? null;
    const minCashAValue = optionKpis?.minCash
      ? `${formatCurrency(minCashA ?? 0, scenario.baseCurrency, locale)}\n${formatMonthLabel(
          optionKpis.minCash.month,
          notAvailable
        )}`
      : notAvailable;
    const minCashBValue = baselineKpis?.minCash
      ? `${formatCurrency(minCashB ?? 0, scenario.baseCurrency, locale)}\n${formatMonthLabel(
          baselineKpis.minCash.month,
          notAvailable
        )}`
      : notAvailable;

    const negativeAValue = formatMonthLabel(
      optionKpis?.firstNegativeCashMonth ?? null,
      negativeNotReached
    );
    const negativeBValue = formatMonthLabel(
      baselineKpis?.firstNegativeCashMonth ?? null,
      negativeNotReached
    );

    const targetMonthNetWorthAValue =
      optionNetWorthAtTargetMonth.value !== null
        ? formatCurrency(optionNetWorthAtTargetMonth.value, scenario.baseCurrency, locale)
        : notAvailable;
    const targetMonthNetWorthBValue =
      baselineNetWorthAtTargetMonth.value !== null
        ? formatCurrency(baselineNetWorthAtTargetMonth.value, scenario.baseCurrency, locale)
        : notAvailable;

    const targetConfigured = typeof firstBucketTargetValue === "number";
    const targetAValue = targetConfigured
      ? formatMonthLabel(optionKpis?.targetMonth ?? null, targetNotReached)
      : targetNotSet;
    const targetBValue = targetConfigured
      ? formatMonthLabel(baselineKpis?.targetMonth ?? null, targetNotReached)
      : notAvailable;
    const targetHelper = !targetConfigured
      ? targetNotSetHint
      : optionKpis?.targetMonth
      ? undefined
      : targetNotReachedHint;

    return [
      {
        key: "minCash",
        better: "higher",
        label: translate("planLabKpiMinCash", "最低現金結餘"),
        valueA: minCashAValue,
        valueB: minCashBValue,
        delta: formatDeltaDisplay(kpiDiff.minCash, null),
      },
      {
        key: "negativeCash",
        better: "lower",
        label: translate("planLabKpiNegativeCash", "現金轉負最早月份"),
        valueA: negativeAValue,
        valueB: negativeBValue,
        delta: formatDeltaDisplay(
          kpiDiff.firstNegativeCashMonth,
          translate("planLabKpiMonthsUnit", "個月")
        ),
      },
      {
        key: "targetMonthNetWorth",
        better: "higher",
        label: translate("planLabKpiTargetMonthNetWorth", "目標月份淨資產"),
        valueA: targetMonthNetWorthAValue,
        valueB: targetMonthNetWorthBValue,
        delta: formatDeltaDisplay(targetMonthNetWorthDelta, null),
        actionLabel: translate("planLabViewMonthlyBreakdown", "查看每月明細"),
        actionDisabled: !hasValidTargetMonth,
        actionTooltip: translate("planLabViewMonthlyBreakdownDisabled", "先設定目標月份"),
      },
      {
        key: "targetMonth",
        better: "lower",
        label: translate("planLabKpiTargetMonth", "目標達標月份"),
        valueA: targetAValue,
        valueB: targetBValue,
        delta: targetConfigured
          ? formatDeltaDisplay(
              kpiDiff.targetMonth,
              translate("planLabKpiMonthsUnit", "個月")
            )
          : null,
        helper: targetHelper,
      },
      {
        key: "nonSalaryIncomeRatio",
        better: "higher",
        label: translate("planLabKpiNonSalaryIncomeRatio", "非薪金收入比率"),
        valueA: formatRatio(optionKpis?.nonSalaryIncomeRatio),
        valueB: formatRatio(baselineKpis?.nonSalaryIncomeRatio),
        delta: formatDeltaDisplay(kpiDiff.nonSalaryIncomeRatio, translate("planLabKpiPctUnit", "%")),
        helper: translate("planLabKpiNonSalaryIncomeRatioHint", "公式：非薪金收入 ÷ 總收入（未來12個月）"),
        tooltip: translate("planLabKpiNonSalaryIncomeRatioHint", "公式：非薪金收入 ÷ 總收入（未來12個月）"),
      },
      {
        key: "passiveIncomeCoverage",
        better: "higher",
        label: translate("planLabKpiPassiveIncomeCoverage", "退休覆蓋率"),
        valueA: formatRatio(optionKpis?.passiveIncomeCoverage),
        valueB: formatRatio(baselineKpis?.passiveIncomeCoverage),
        delta: formatDeltaDisplay(kpiDiff.passiveIncomeCoverage, translate("planLabKpiPctUnit", "%")),
        helper: translate("planLabKpiPassiveIncomeCoverageHint", "公式：租金/股息/利息收入 ÷ 核心生活支出（未來12個月）"),
        tooltip: translate("planLabKpiPassiveIncomeCoverageHint", "公式：租金/股息/利息收入 ÷ 核心生活支出（未來12個月）"),
      },
      {
        key: "educationExpensePressure",
        better: "lower",
        label: translate("planLabKpiEducationExpensePressure", "教育成本壓力"),
        valueA: formatRatio(optionKpis?.educationExpenseRatio),
        valueB: formatRatio(baselineKpis?.educationExpenseRatio),
        delta: formatDeltaDisplay(kpiDiff.educationExpenseRatio, translate("planLabKpiPctUnit", "%")),
        helper: translate("planLabKpiEducationExpensePressureHint", "公式：教育支出 ÷ 核心生活支出（未來12個月）"),
        tooltip: translate("planLabKpiEducationExpensePressureHint", "公式：教育支出 ÷ 核心生活支出（未來12個月）"),
      },
      {
        key: "assetLinkedExpenseRatio",
        better: "lower",
        label: translate("planLabKpiAssetLinkedExpenseRatio", "資產相關支出比率"),
        valueA: formatRatio(optionKpis?.assetLinkedExpenseRatio),
        valueB: formatRatio(baselineKpis?.assetLinkedExpenseRatio),
        delta: formatDeltaDisplay(kpiDiff.assetLinkedExpenseRatio, translate("planLabKpiPctUnit", "%")),
        helper: translate("planLabKpiAssetLinkedExpenseRatioHint", "公式：物業/車輛相關支出 ÷ 核心生活支出（未來12個月）"),
        tooltip: translate("planLabKpiAssetLinkedExpenseRatioHint", "公式：物業/車輛相關支出 ÷ 核心生活支出（未來12個月）"),
      },
    ];
  }, [
    baselineKpis,
    baselineNetWorthAtTargetMonth.value,
    firstBucketTargetValue,
    formatDeltaDisplay,
    formatMonthLabel,
    formatRatio,
    hasValidTargetMonth,
    kpiDiff,
    locale,
    optionKpis,
    optionNetWorthAtTargetMonth.value,
    scenario.baseCurrency,
    targetMonthNetWorthDelta,
    t,
  ]);

  const personaFocuses = scenario.meta?.personaFocuses ?? [];

  const personaOrderedKpiCards = useMemo(() => {
    const priority = personaFocuses.flatMap((focus) => PERSONA_KPI_PRIORITY[focus] ?? []);
    if (priority.length === 0) {
      return kpiCards;
    }
    const rank = new Map(priority.map((key, index) => [key, index]));
    return [...kpiCards].sort((left, right) => {
      const l = rank.get(left.key) ?? Number.MAX_SAFE_INTEGER;
      const r = rank.get(right.key) ?? Number.MAX_SAFE_INTEGER;
      return l - r;
    });
  }, [kpiCards, personaFocuses]);

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

  const formatDiffValue = useCallback(
    (value: string | number | boolean | null | undefined) =>
      value === null || value === undefined || value === "" ? "—" : String(value),
    []
  );

  const buildDiffLine = useCallback(
    (
      label: string,
      before: string | number | boolean | null | undefined,
      after: string | number | boolean | null | undefined
    ) => {
      if (before === after) {
        return null;
      }
      const beforeValue = formatDiffValue(before);
      const afterValue = formatDiffValue(after);
      return `${label}：${translate(
        "planLabDiffLine",
        "從 {before} 改成 {after}",
        { before: beforeValue, after: afterValue }
      )}`;
    },
    [formatDiffValue, translate]
  );

  const formatEnabledLabel = useCallback(
    (enabled: boolean) =>
      enabled
        ? translate("planLabEnabledLabel", "啟用")
        : translate("planLabDisabledLabel", "停用"),
    [translate]
  );

  const formatBundleAmount = useCallback(
    (value?: number | null) =>
      typeof value === "number"
        ? formatCurrency(value, scenario.baseCurrency, locale)
        : moneyT("amountUnset"),
    [locale, moneyT, scenario.baseCurrency]
  );

  const formatBundleDownPayment = useCallback(
    (input: HomePurchaseBundleInput) =>
      input.downPaymentMode === "percent"
        ? `${input.downPaymentPercent ?? 0}%`
        : formatBundleAmount(input.downPaymentAmount),
    [formatBundleAmount]
  );

  const formatBundleRent = useCallback(
    (input: HomePurchaseBundleInput) => {
      if (!input.rental?.enabled) {
        return translate("planLabBundleRentDisabled", "未出租");
      }
      return formatBundleAmount(input.rental.rentMonthly ?? 0);
    },
    [formatBundleAmount, translate]
  );

  const formatBundleHelper = useCallback(
    (input: NewBabyPlanInput) => {
      if (!input.helperEnabled) {
        return translate("planLabBundleHelperDisabled", "未啟用");
      }
      return formatBundleAmount(input.helperMonthly ?? 0);
    },
    [formatBundleAmount, translate]
  );

  const formatBundleHelperFee = useCallback(
    (input: NewBabyPlanInput) => {
      if (!input.helperEnabled) {
        return translate("planLabBundleHelperDisabled", "未啟用");
      }
      return formatBundleAmount(input.agencyFee ?? 0);
    },
    [formatBundleAmount, translate]
  );

  const formatBundleSchooling = useCallback(
    (input: NewBabyPlanInput) => {
      if (!input.schoolingEnabled) {
        return translate("planLabBundleSchoolingDisabled", "未啟用");
      }
      const cadenceLabel =
        input.schoolingCadence === "yearly"
          ? translate("planLabBundleCadenceYearly", "／年")
          : translate("planLabBundleCadenceMonthly", "／月");
      return `${formatBundleAmount(input.schoolingAmount ?? 0)}${cadenceLabel}`;
    },
    [formatBundleAmount, translate]
  );

  const buildBundleChangeSummary = useCallback(
    (baselineInput?: BundleWizardInput | null, currentInput?: BundleWizardInput | null) => {
      if (!currentInput) {
        return [];
      }
      if (!baselineInput) {
        return [translate("planLabAppliedUpdated", "已更新")];
      }
      if (baselineInput.templateId !== currentInput.templateId) {
        return [translate("planLabBundleTemplateChanged", "已更新組合類型")];
      }
      if (currentInput.templateId === "life_home_purchase") {
        const base = baselineInput.input as HomePurchaseBundleInput;
        const next = currentInput.input as HomePurchaseBundleInput;
        const diffLines = [
          buildDiffLine(
            translate("planLabBundlePurchasePriceLabel", "物業價"),
            formatBundleAmount(base.purchasePrice),
            formatBundleAmount(next.purchasePrice)
          ),
          buildDiffLine(
            translate("planLabBundleDownPaymentLabel", "首期"),
            formatBundleDownPayment(base),
            formatBundleDownPayment(next)
          ),
          buildDiffLine(
            translate("planLabBundleMortgageRateLabel", "按揭利率"),
            base.mortgageRatePct != null ? `${base.mortgageRatePct}%` : null,
            next.mortgageRatePct != null ? `${next.mortgageRatePct}%` : null
          ),
          buildDiffLine(
            translate("planLabBundleMortgageTermLabel", "年期"),
            base.mortgageTermYears,
            next.mortgageTermYears
          ),
          buildDiffLine(
            translate("planLabBundleMortgagePaymentLabel", "每月供款"),
            formatBundleAmount(base.mortgagePayment),
            formatBundleAmount(next.mortgagePayment)
          ),
          buildDiffLine(
            translate("planLabBundleRentMonthlyLabel", "租金收入"),
            formatBundleRent(base),
            formatBundleRent(next)
          ),
          buildDiffLine(
            translate("planLabBundleStartMonthLabel", "購入月份"),
            base.startMonth,
            next.startMonth
          ),
        ].filter(Boolean) as string[];
        return diffLines.length > 0 ? diffLines : [translate("planLabAppliedUpdated", "已更新")];
      }
      if (currentInput.templateId === "life_rental_plan") {
        const base = baselineInput.input as RentalPlanBundleInput;
        const next = currentInput.input as RentalPlanBundleInput;
        const diffLines = [
          buildDiffLine(
            translate("planLabBundleRentMonthlyLabel", "Rent monthly"),
            formatBundleAmount(base.rentMonthly),
            formatBundleAmount(next.rentMonthly)
          ),
          buildDiffLine(
            translate("planLabBundleRentGrowthLabel", "Annual rent growth"),
            base.rentAnnualGrowthPct != null ? `${base.rentAnnualGrowthPct}%` : null,
            next.rentAnnualGrowthPct != null ? `${next.rentAnnualGrowthPct}%` : null
          ),
          buildDiffLine(
            translate("planLabBundleRentalDepositLabel", "Rental deposit"),
            formatBundleAmount(base.depositAmount),
            formatBundleAmount(next.depositAmount)
          ),
          buildDiffLine(
            translate("planLabBundleRentalAgentFeeLabel", "Agent fee"),
            formatBundleAmount(base.agentFeeAmount),
            formatBundleAmount(next.agentFeeAmount)
          ),
          buildDiffLine(
            translate("planLabBundleStartMonthLabel", "Start month"),
            base.startMonth,
            next.startMonth
          ),
          buildDiffLine(
            translate("planLabBundleEndMonthLabel", "End month"),
            base.endMonth ?? null,
            next.endMonth ?? null
          ),
        ].filter(Boolean) as string[];
        return diffLines.length > 0 ? diffLines : [translate("planLabAppliedUpdated", "Updated")];
      }
      const base = baselineInput.input as NewBabyPlanInput;
      const next = currentInput.input as NewBabyPlanInput;
      const diffLines = [
        buildDiffLine(
          translate("planLabBundleBirthMonthLabel", "出生月份"),
          base.birthMonth,
          next.birthMonth
        ),
        buildDiffLine(
          translate("planLabBundleDeliveryCostLabel", "生產費用"),
          formatBundleAmount(base.deliveryCost),
          formatBundleAmount(next.deliveryCost)
        ),
        buildDiffLine(
          translate("planLabBundleChildcareLabel", "育兒支出"),
          formatBundleAmount(base.childcareMonthly),
          formatBundleAmount(next.childcareMonthly)
        ),
        buildDiffLine(
          translate("planLabBundleHelperLabel", "外傭支出"),
          formatBundleHelper(base),
          formatBundleHelper(next)
        ),
        buildDiffLine(
          translate("planLabBundleHelperFeeLabel", "外傭中介費"),
          formatBundleHelperFee(base),
          formatBundleHelperFee(next)
        ),
        buildDiffLine(
          translate("planLabBundleSchoolingLabel", "教育支出"),
          formatBundleSchooling(base),
          formatBundleSchooling(next)
        ),
      ].filter(Boolean) as string[];
      return diffLines.length > 0 ? diffLines : [translate("planLabAppliedUpdated", "已更新")];
    },
    [
      buildDiffLine,
      formatBundleAmount,
      formatBundleDownPayment,
      formatBundleHelper,
      formatBundleHelperFee,
      formatBundleRent,
      formatBundleSchooling,
      t,
    ]
  );

  const experimentIdByPatchItemId = useMemo(() => {
    const mapping = new Map<string, string>();
    experimentGroups.forEach((group) => {
      group.itemIds.forEach((itemId) => {
        if (!mapping.has(itemId)) {
          mapping.set(itemId, group.experimentId);
        }
      });
    });
    return mapping;
  }, [experimentGroups]);

  const appliedControls = useMemo(() => {
    const controls: Array<{
      id: string;
      titleLine: string;
      diffLines: string[];
      tooltip?: string;
      isEnabled: boolean;
      itemIds?: string[];
      onToggle?: () => void;
      onRemove: () => void;
      onView?: () => void;
      onLocate?: () => void;
    }> = [];

    if (scenarioIsV2) {
      const bundleExperimentGroups = experimentGroups.filter(
        (group) => Boolean(group.bundleInstanceId)
      );
      const bundleExperimentEventIds = new Set<string>();
      bundleExperimentGroups.forEach((group) => {
        group.itemIds.forEach((itemId) => {
          if (itemId.startsWith("events:")) {
            bundleExperimentEventIds.add(itemId.replace("events:", ""));
          }
        });
      });
      scenarioV2Patches.events.add.forEach((event) => {
        if (bundleExperimentEventIds.has(event.id)) {
          return;
        }
        const scenarioItem = scenarioItems.find((item) => item.eventId === event.id);
        const sourceExperimentId = experimentIdByPatchItemId.get(`events:${event.id}`);
        controls.push({
          id: `event-add-${event.id}`,
          titleLine: event.label ?? event.id,
          diffLines: sourceExperimentId
            ? [
                translate("planLabAppliedAddedEvent", "新增事件"),
                translate("planLabAppliedRevertExperimentImpact", "移除本實驗影響"),
              ]
            : [translate("planLabAppliedAddedEvent", "新增事件")],
          isEnabled: true,
          itemIds: [`event:${event.id}`],
          onRemove: sourceExperimentId
            ? () => unapplyExperiment(sourceExperimentId)
            : () => removeScenarioV2Event(event.id),
          onLocate: () => handleLocateItem(`event:${event.id}`),
          onView: scenarioItem ? () => openScenarioItemView(scenarioItem) : undefined,
        });
      });
      Object.keys(scenarioV2Patches.events.update).forEach((eventId) => {
        if (bundleExperimentEventIds.has(eventId)) {
          return;
        }
        const updated = v2EventLookup.get(eventId);
        const scenarioItem = scenarioItems.find((item) => item.eventId === eventId);
        const sourceExperimentId = experimentIdByPatchItemId.get(`events:${eventId}`);
        controls.push({
          id: `event-update-${eventId}`,
          titleLine: updated?.label ?? eventId,
          diffLines: sourceExperimentId
            ? [
                translate("planLabAppliedUpdated", "已更新"),
                translate("planLabAppliedRevertExperimentImpact", "移除本實驗影響"),
              ]
            : [translate("planLabAppliedUpdated", "已更新")],
          isEnabled: true,
          itemIds: [`event:${eventId}`],
          onRemove: sourceExperimentId
            ? () => unapplyExperiment(sourceExperimentId)
            : () => removeScenarioV2Event(eventId),
          onLocate: () => handleLocateItem(`event:${eventId}`),
          onView: scenarioItem ? () => openScenarioItemView(scenarioItem) : undefined,
        });
      });

      experimentGroups
        .filter((group) => group.kind === "ENV_OVERRIDE" && group.envOverrides)
        .forEach((group) => {
          const lines = group.changes ??
            getScenarioAssumptionOverrideEntries(group.envOverrides ?? {}).map(([key, value]) =>
              formatScenarioAssumptionChange(
                ENV_ASSUMPTION_LABELS[key],
                baselineAssumptionOverrides[key],
                value
              )
            );
          controls.push({
            id: `env-${group.experimentId}`,
            titleLine: resolveExperimentGroupTitle(group.title),
            diffLines: lines,
            isEnabled: group.isEnabled,
            onToggle: () =>
              group.isEnabled
                ? unapplyExperiment(group.experimentId)
                : applyExperiment(group.experimentId),
            onRemove: () => deleteExperiment(group.experimentId),
            onView: () => openEnvAssumptionsExperimentDrawer(group),
          });
        });
      bundleExperimentGroups.forEach((group) => {
        if (!group.bundleInstanceId) {
          return;
        }
        const bundleId = group.bundleInstanceId;
        const baselineRecord = baselineBundleInstanceById.get(bundleId);
        const overrideRecord = bundleInstanceOverrideById.get(bundleId);
        const wizardInput =
          overrideRecord?.wizardInput ?? baselineRecord?.wizardInput ?? null;
        const fallbackTitle = bundleGroupById.get(bundleId)
          ? resolveBundleTitle(bundleGroupById.get(bundleId) ?? {})
          : translate("planLabBundleExperimentFallback", "人生事件組合");
        const titleLine = resolveBundleExperimentTitle(wizardInput, fallbackTitle);
        const changeSummary = buildBundleChangeSummary(
          baselineRecord?.wizardInput,
          wizardInput
        );
        const bundleCard = sandboxBundleCardById.get(bundleId);
        const impactLines = bundleCard
          ? [
              moneyT("bundleSummaryOneOff", {
                amount:
                  bundleCard.oneOffTotal > 0
                    ? formatCurrency(
                        bundleCard.oneOffTotal,
                        scenario.baseCurrency,
                        locale
                      )
                    : moneyT("amountUnset"),
              }),
              moneyT("bundleSummaryMonthlyIncome", {
                amount: bundleCard.hasMonthlyImpact
                  ? formatCurrency(
                      bundleCard.monthlyIncome,
                      scenario.baseCurrency,
                      locale
                    )
                  : moneyT("amountUnset"),
              }),
              moneyT("bundleSummaryMonthlyExpense", {
                amount: bundleCard.hasMonthlyImpact
                  ? formatCurrency(
                      bundleCard.monthlyExpense,
                      scenario.baseCurrency,
                      locale
                    )
                  : moneyT("amountUnset"),
              }),
              moneyT("bundleSummaryMonthlyNet", {
                amount: bundleCard.hasMonthlyImpact
                  ? formatCurrency(
                      bundleCard.monthlyNet,
                      scenario.baseCurrency,
                      locale
                    )
                  : moneyT("amountUnset"),
              }),
              ...(bundleCard.hasStartMonthOneOffImpact
                ? [
                    moneyT("bundleSummaryStartMonthNet", {
                      amount: formatCurrency(
                        bundleCard.monthlySummary.startMonthNet,
                        scenario.baseCurrency,
                        locale
                      ),
                      month: bundleCard.monthlySummary.month ?? "--",
                    }),
                  ]
                : []),
            ]
          : [];
        const diffLines = [...changeSummary, ...impactLines].filter(Boolean);
        controls.push({
          id: `bundle-override-${group.experimentId}`,
          titleLine,
          diffLines:
            diffLines.length > 0
              ? diffLines
              : [translate("planLabAppliedUpdated", "已更新")],
          isEnabled: group.isEnabled !== false,
          itemIds: [buildBundleRowId(bundleId)],
          onToggle: () =>
            group.isEnabled === false
              ? applyExperiment(group.experimentId)
              : unapplyExperiment(group.experimentId),
          onRemove: () => removeBundleExperimentGroup(group),
          onView: () => handleViewBundle(bundleId),
          onLocate: () => handleLocateBundle(bundleId, { openDrawer: true }),
        });
      });
      return controls;
    }

    draftMembers.forEach((member) => {
      controls.push({
        id: `member-${member.id}`,
        titleLine: member.name,
        diffLines: [translate("planLabAppliedAddedMember", "新增成員")],
        isEnabled: true,
        onRemove: () => removeDraftMember(member.id),
        onLocate: () => openEditMemberDrawer(member),
        onView: () => openEditMemberDrawer(member),
      });
    });

    draftBudgetRules.forEach((rule) => {
      const diffLines = [translate("planLabAppliedAddedRule", "新增規則")];
      controls.push({
        id: `rule-add-${rule.id}`,
        titleLine: rule.name,
        diffLines,
        isEnabled: rule.enabled,
        itemIds: [`rule:${rule.id}`],
        onToggle: () =>
          setDraftBudgetRules((current) =>
            current.map((entry) =>
              entry.id === rule.id ? { ...entry, enabled: !entry.enabled } : entry
            )
          ),
        onRemove: () => removeDraftBudgetRule(rule.id),
        onLocate: () => handleLocateItem(`rule:${rule.id}`),
        onView: () => {
          const item = scenarioItems.find((entry) => entry.ruleId === rule.id);
          if (item) {
            openScenarioItemView(item);
          }
        },
      });
    });

    draftEvents.forEach((event) => {
      const item = scenarioItems.find(
        (entry) => entry.eventDefinitionId === event.definition.id
      );
      const summary = item ? getScenarioItemSummary(item) : "";
      const diffLines = [
        translate("planLabAppliedAddedEvent", "新增事件"),
        summary,
      ].filter(Boolean);
      controls.push({
        id: `event-add-${event.definition.id}`,
        titleLine: event.definition.title,
        diffLines,
        isEnabled: event.ref.enabled !== false,
        itemIds: [`event:${event.definition.id}`],
        onToggle: () =>
          setDraftEvents((current) =>
            current.map((entry) =>
              entry.definition.id === event.definition.id
                ? {
                    ...entry,
                    ref: { ...entry.ref, enabled: !entry.ref.enabled },
                  }
                : entry
            )
          ),
        onRemove: () =>
          setDraftEvents((current) =>
            current.filter((entry) => entry.definition.id !== event.definition.id)
          ),
        onLocate: () => handleLocateItem(`event:${event.definition.id}`),
        onView: () => openEditEventDrawer(event),
      });
    });

    Object.entries(eventPatches).forEach(([refId, patch]) => {
      const item = scenarioItems.find((entry) => entry.eventDefinitionId === refId);
      const title = item?.title ?? refId;
      const hasChange = patch.isDisabled || patch.endMonth || patch.patch;
      if (!hasChange) {
        return;
      }
      const baselineRef = scenario.eventRefs?.find((ref) => ref.refId === refId);
      const baselineEnabled = baselineRef?.enabled ?? true;
      const nextEnabled =
        patch.isDisabled !== undefined ? !patch.isDisabled : baselineEnabled;
      const baseRule = item?.eventRule ?? item?.eventDefinition?.rule;
      const patchedRule = {
        ...(baseRule ?? {}),
        ...(patch.patch?.rule ?? {}),
      };
      if (patch.endMonth) {
        patchedRule.endMonth = patch.endMonth;
      }
      const diffLines = [
        buildDiffLine(
          translate("planLabStatusLabel", "狀態"),
          formatEnabledLabel(baselineEnabled),
          formatEnabledLabel(nextEnabled)
        ),
        buildDiffLine(
          translate("planLabEventStartMonthLabel", "開始月份"),
          baseRule?.startMonth,
          patchedRule.startMonth
        ),
        buildDiffLine(
          translate("planLabEventEndMonthLabel", "結束月份"),
          baseRule?.endMonth,
          patchedRule.endMonth
        ),
        buildDiffLine(
          translate("planLabRuleMonthlyAmountLabel", "每月金額"),
          typeof baseRule?.monthlyAmount === "number"
            ? formatCurrency(baseRule.monthlyAmount, scenario.baseCurrency, locale)
            : null,
          typeof patchedRule.monthlyAmount === "number"
            ? formatCurrency(patchedRule.monthlyAmount, scenario.baseCurrency, locale)
            : null
        ),
        buildDiffLine(
          translate("planLabRuleOneTimeAmountLabel", "一次性金額"),
          typeof baseRule?.oneTimeAmount === "number"
            ? formatCurrency(baseRule.oneTimeAmount, scenario.baseCurrency, locale)
            : null,
          typeof patchedRule.oneTimeAmount === "number"
            ? formatCurrency(patchedRule.oneTimeAmount, scenario.baseCurrency, locale)
            : null
        ),
        buildDiffLine(
          translate("planLabRuleAnnualGrowthLabel", "年增長率 %"),
          baseRule?.annualGrowthPct != null ? `${baseRule.annualGrowthPct}%` : null,
          patchedRule.annualGrowthPct != null
            ? `${patchedRule.annualGrowthPct}%`
            : null
        ),
      ].filter(Boolean) as string[];

      if (diffLines.length === 0) {
        diffLines.push(translate("planLabAppliedUpdated", "已更新"));
      }

      controls.push({
        id: `event-${refId}`,
        titleLine: title,
        diffLines,
        isEnabled: nextEnabled,
        itemIds: [`event:${refId}`],
        onToggle: () => updateEventPatch(refId, { isDisabled: !nextEnabled }),
        onRemove: () => removePatch("event", refId),
        onLocate: () => handleLocateItem(`event:${refId}`),
        onView: item ? () => openScenarioItemView(item) : undefined,
      });
    });

    Object.entries(rulePatches).forEach(([ruleId, patch]) => {
      const item = scenarioItems.find((entry) => entry.ruleId === ruleId);
      const title = item?.title ?? ruleId;
      const hasChange = patch.isDisabled || patch.endMonth || patch.patch;
      if (!hasChange) {
        return;
      }
      const baseRule = item?.budgetRule;
      const patchedRule = {
        ...(baseRule ?? {}),
        ...(patch.patch ?? {}),
      };
      if (patch.endMonth) {
        patchedRule.endMonth = patch.endMonth;
      }
      const baselineEnabled = baseRule?.enabled ?? true;
      const nextEnabled =
        patch.isDisabled !== undefined ? !patch.isDisabled : baselineEnabled;
      const diffLines = [
        buildDiffLine(
          translate("planLabStatusLabel", "狀態"),
          formatEnabledLabel(baselineEnabled),
          formatEnabledLabel(nextEnabled)
        ),
        buildDiffLine(
          translate("planLabRuleStartMonthLabel", "開始月份"),
          baseRule?.startMonth,
          patchedRule.startMonth
        ),
        buildDiffLine(
          translate("planLabRuleEndMonthLabel", "結束月份"),
          baseRule?.endMonth,
          patchedRule.endMonth
        ),
        buildDiffLine(
          translate("planLabRuleMonthlyAmountLabel", "每月金額"),
          typeof baseRule?.monthlyAmount === "number"
            ? formatCurrency(baseRule.monthlyAmount, scenario.baseCurrency, locale)
            : null,
          typeof patchedRule.monthlyAmount === "number"
            ? formatCurrency(patchedRule.monthlyAmount, scenario.baseCurrency, locale)
            : null
        ),
        buildDiffLine(
          translate("planLabRuleAnnualGrowthLabel", "年增長率 %"),
          baseRule?.annualGrowthPct != null ? `${baseRule.annualGrowthPct}%` : null,
          patchedRule.annualGrowthPct != null
            ? `${patchedRule.annualGrowthPct}%`
            : null
        ),
      ].filter(Boolean) as string[];
      if (diffLines.length === 0) {
        diffLines.push(translate("planLabAppliedUpdated", "已更新"));
      }
      controls.push({
        id: `rule-${ruleId}`,
        titleLine: title,
        diffLines,
        isEnabled: nextEnabled,
        itemIds: [`rule:${ruleId}`],
        onToggle: () => updateRulePatch(ruleId, { isDisabled: !nextEnabled }),
        onRemove: () => removePatch("rule", ruleId),
        onLocate: () => handleLocateItem(`rule:${ruleId}`),
        onView: item ? () => openScenarioItemView(item) : undefined,
      });
    });

    Object.entries(positionPatches).forEach(([key, patch]) => {
      const item = scenarioItems.find((entry) => entry.positionKey === key);
      const title = item?.title ?? key;
      const hasChange = patch.isDisabled || patch.patch;
      if (!hasChange) {
        return;
      }
      const basePosition = item?.position ?? {};
      const baselineEnabled = item?.position?.enabled ?? true;
      const nextEnabled =
        patch.isDisabled !== undefined ? !patch.isDisabled : baselineEnabled;
      const diffLines = [
        buildDiffLine(
          translate("planLabStatusLabel", "狀態"),
          formatEnabledLabel(baselineEnabled),
          formatEnabledLabel(nextEnabled)
        ),
        ...(patch.patch
          ? Object.entries(patch.patch)
              .map(([field, value]) =>
                typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean" ||
                value == null
                  ? buildDiffLine(
                      field,
                      (basePosition as Record<string, unknown>)[field] as
                        | string
                        | number
                        | boolean
                        | null
                        | undefined,
                      value as string | number | boolean | null | undefined
                    )
                  : null
              )
              .filter(Boolean)
          : []),
      ].filter(Boolean) as string[];
      if (diffLines.length === 0) {
        diffLines.push(translate("planLabAppliedUpdated", "已更新"));
      }
      controls.push({
        id: `position-${key}`,
        titleLine: title,
        diffLines,
        isEnabled: !patch.isDisabled,
        itemIds: [`position:${key}`],
        onToggle: () => updatePositionPatch(key, { isDisabled: !patch.isDisabled }),
        onRemove: () => removePatch("position", key),
        onLocate: () => handleLocateItem(`position:${key}`),
        onView: item ? () => openScenarioItemView(item) : undefined,
      });
    });

    if (baselineSmartInvestPolicy && smartInvestPatch) {
      const patchedPolicy = applySmartInvestPatch(
        baselineSmartInvestPolicy,
        smartInvestPatch
      );
      const diffLines: string[] = [];
      if (baselineSmartInvestPolicy.enabled !== patchedPolicy.enabled) {
        const statusLine = buildDiffLine(
          translate("planLabStatusLabel", "狀態"),
          formatEnabledLabel(baselineSmartInvestPolicy.enabled ?? true),
          formatEnabledLabel(patchedPolicy.enabled ?? true)
        );
        if (statusLine) {
          diffLines.push(statusLine);
        }
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
        diffLines.push(formatSmartInvestReserveLabel(patchedPolicy.reserve));
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
        diffLines.push(
          formatSmartInvestContributionLabel(patchedPolicy.contribution)
        );
      }
      if (
        JSON.stringify(baselineSmartInvestPolicy.allocation) !==
        JSON.stringify(patchedPolicy.allocation)
      ) {
        diffLines.push(translate("planLabSmartInvestAllocationUpdated", "配置已更新"));
      }
      if (
        baselineSmartInvestPolicy.withdrawal.enabled !== patchedPolicy.withdrawal.enabled
      ) {
        diffLines.push(
          patchedPolicy.withdrawal.enabled
            ? translate("planLabSmartInvestWithdrawalsEnabled", "已啟用提取")
            : translate("planLabSmartInvestWithdrawalsDisabled", "已停用提取")
        );
      }
      if (diffLines.length === 0) {
        diffLines.push(translate("planLabAppliedUpdated", "已更新"));
      }
      controls.push({
        id: "smartInvest-baseline",
        titleLine: smartInvestLabel,
        diffLines,
        tooltip: smartInvestTooltip,
        isEnabled: patchedPolicy.enabled,
        itemIds: ["position:smartInvest"],
        onToggle: () =>
          updateSmartInvestPatch({ isDisabled: patchedPolicy.enabled }),
        onRemove: () => removePatch("position", "smartInvest"),
        onLocate: () => handleLocateItem("position:smartInvest"),
        onView: () => {
          const item = scenarioItems.find(
            (entry) => entry.positionKind === "smartInvest"
          );
          if (item) {
            openScenarioItemView(item);
          }
        },
      });
    }

    experiments.forEach((experiment) => {
      const currency = scenario.baseCurrency;
      let summaryLine = "";
      const titleLine =
        experimentTypeOptions.find((option) => option.value === experiment.type)?.label ??
        translate("planLabExperimentFallback", "實驗");
      if (experiment.type === "oneOffExpense") {
        summaryLine = translate(
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
        summaryLine = translate(
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
        summaryLine = translate(
          "planLabAppliedExperimentHomeBuy",
          `置業 · ${experiment.purchaseMonth ?? ""}`,
          {
            month: experiment.purchaseMonth ?? "",
          }
        );
      } else if (experiment.type === "carPlan") {
        summaryLine = translate(
          "planLabAppliedExperimentCarPlan",
          `汽車方案 · ${experiment.purchaseMonth ?? ""}`,
          {
            month: experiment.purchaseMonth ?? "",
          }
        );
      } else if (experiment.type === "incomeAdjust") {
        summaryLine = translate(
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
        summaryLine = translate(
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
        summaryLine =
          deltaParts.length > 0
            ? deltaParts.join(" · ")
            : translate("planLabAppliedUpdated", "已更新");
      }

      controls.push({
        id: `experiment-${experiment.id}`,
        titleLine,
        diffLines: [summaryLine],
        isEnabled: experiment.isEnabled !== false,
        onToggle: () =>
          updateExperiment(experiment.id, {
            isEnabled: experiment.isEnabled === false,
          }),
        onRemove: () => removeExperiment(experiment.id),
        onLocate: () => handleLocateItem(`experiment-${experiment.id}`),
        onView: () => openEditExperimentDrawer(experiment),
      });
    });

    return controls;
  }, [
    baselineSmartInvestPolicy,
    baselineBundleInstanceById,
    sandboxBundleCardById,
    bundleGroupById,
    bundleInstanceOverrideById,
    buildBundleChangeSummary,
    buildDiffLine,
    draftBudgetRules,
    draftEvents,
    draftMembers,
    eventPatches,
    experimentIdByPatchItemId,
    experiments,
    formatEnabledLabel,
    formatSmartInvestContributionLabel,
    formatSmartInvestReserveLabel,
    getScenarioItemSummary,
    handleViewBundle,
    handleLocateBundle,
    handleLocateItem,
    locale,
    moneyT,
    openEditExperimentDrawer,
    openEditEventDrawer,
    openEditMemberDrawer,
    openScenarioItemView,
    positionPatches,
    removeDraftBudgetRule,
    removeDraftMember,
    removeScenarioV2Event,
    removeBundleExperimentGroup,
    removeExperiment,
    unapplyExperiment,
    rulePatches,
    resolveBundleExperimentTitle,
    resolveBundleTitle,
    scenario.baseCurrency,
    scenario.eventRefs,
    scenarioIsV2,
    scenarioItems,
    scenarioV2Patches,
    setDraftBudgetRules,
    setDraftEvents,
    smartInvestLabel,
    smartInvestPatch,
    smartInvestTooltip,
    t,
    v2EventLookup,
    updateEventPatch,
    updatePositionPatch,
    updateRulePatch,
    updateSmartInvestPatch,
    experimentTypeOptions,
  ]);

  const appliedControlIdByItemId = useMemo(() => {
    if (scenarioIsV2) {
      const map = new Map<string, string>();
      experimentIdByPatchItemId.forEach((experimentId, itemId) => {
        map.set(itemId, `experiment-${experimentId}`);
      });
      return map;
    }

    const map = new Map<string, string>();
    appliedControls.forEach((control) => {
      const experimentControlId = control.id.startsWith("experiment-")
        ? control.id
        : control.id.startsWith("env-")
          ? `experiment-${control.id.slice(4)}`
          : control.id.startsWith("bundle-override-")
            ? `experiment-${control.id.slice("bundle-override-".length)}`
            : null;
      if (!experimentControlId) {
        return;
      }
      control.itemIds?.forEach((itemId) => {
        if (!map.has(itemId)) {
          map.set(itemId, experimentControlId);
        }
      });
    });
    return map;
  }, [appliedControls, experimentIdByPatchItemId, scenarioIsV2]);

  const isExperimentLibraryEmpty = scenarioIsV2
    ? experimentGroups.length === 0
    : experiments.length === 0;
  const showExperimentEmptyState = isExperimentLibraryEmpty;
  const enabledExperimentCount = scenarioIsV2
    ? experimentGroups.filter((group) => group.isEnabled).length
    : experiments.filter((experiment) => experiment.isEnabled !== false).length;

  const showBundleSection = scenarioIsV2 && visibleBundleCards.length > 0;
  // Row key ↔ source entity mapping is centralized here to avoid branch-specific metadata conversion.
  const rowSourceByKey = useMemo(() => {
    return new Map(scenarioItems.map((item) => [item.id, item]));
  }, [scenarioItems]);

  const standaloneItemsContent =
    groupedItems.length === 0 ? (
      <Text size="sm" c="dimmed">
        {translate("planLabFilterEmpty", "沒有符合條件的項目。")}
      </Text>
    ) : (
      groupedItems.map(([group, items]) => (
        <Stack key={group} gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            {group}
          </Text>
          <Accordion variant="separated" radius="xs" multiple>
            {items.map((item) => {
              const sourceItem = rowSourceByKey.get(item.id) ?? item;
              const isAffected = isItemImpactedByEnabledExperiment(sourceItem);
              const controlId = appliedControlIdByItemId.get(item.id);
              return (
                <PlanLabAccordionRow
                  key={item.id}
                  id={item.id}
                  ref={(node) => registerItemRef(item.id, node)}
                  title={sourceItem.title}
                  badges={getScenarioItemBadges(sourceItem)}
                  metaTags={getScenarioItemMetaTags(sourceItem)}
                  highlighted={highlightedItemId === sourceItem.id}
                  primaryAction={{
                    label: isAffected
                      ? translate("planLabViewDiffAction", "查看差異")
                      : translate("planLabViewDetailsAction", "查看"),
                    onClick: () => openScenarioItemView(sourceItem),
                  }}
                  secondaryAction={
                    isAffected
                      ? {
                          label: translate(
                            "planLabLocateControlAction",
                            "定位控制項"
                          ),
                          onClick: () =>
                            controlId ? handleLocateControl(controlId) : undefined,
                          disabled: !controlId,
                        }
                      : {
                          label: translate(
                            "planLabCreateExperimentAction",
                            "新增實驗"
                          ),
                          onClick: () => handleCreateExperimentFromItem(sourceItem),
                          disabled: !canCreateExperimentFromItem(sourceItem),
                        }
                  }
                  menuItems={[
                    {
                      label: translate("planLabGoToMoneyEdit", "前往 Money 編輯"),
                      onClick: () => {
                        const href = resolvePlanLabMoneyEditHref({
                          caseId,
                          scenarioId: scenario.id,
                          eventId: sourceItem.eventId,
                          category: sourceItem.category,
                        });
                        if (!href) return;
                        router.push(href);
                      },
                      disabled: !resolvePlanLabMoneyEditHref({ caseId, scenarioId: scenario.id, eventId: sourceItem.eventId, category: sourceItem.category }),
                    },
                    {
                      label: translate("planLabGoToSettingsMembers", "前往 Settings members"),
                      onClick: () => {
                        const href = resolvePlanLabSettingsMembersHref({
                          caseId,
                          scenarioId: scenario.id,
                          eventId: sourceItem.eventId,
                        });
                        if (!href) return;
                        router.push(href);
                      },
                      disabled: !resolvePlanLabSettingsMembersHref({ caseId, scenarioId: scenario.id, eventId: sourceItem.eventId }),
                    },
                  ]}
                  panel={getScenarioItemPanelContent(sourceItem)}
                />
              );
            })}
          </Accordion>
        </Stack>
      ))
    );

  const handleResetAllControls = () => {
    setBaselinePatches({
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
      smartInvestPatch: undefined,
    });
    setScenarioV2Patches(emptyPlanLabScenarioV2Patches());
    setExperiments([]);
    setExperimentGroups([]);
    setBundleExperimentCta(null);
    setDraftMembers([]);
    setDraftBudgetRules([]);
    setDraftEvents([]);
  };

  const handleResetBaseline = () => {
    setBaselinePatches({
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
      smartInvestPatch: undefined,
    });
    setScenarioV2Patches(emptyPlanLabScenarioV2Patches());
    setExperimentGroups([]);
    setBundleExperimentCta(null);
  };

  const handleLoadPlanSnapshot = (plan: PlanSnapshot) => {
    if (plan.baselineScenarioId !== scenario.id) {
      setPlanToast(
        translate(
          "planLabPlanScenarioMismatchToast",
          "This plan belongs to another scenario and cannot be loaded here."
        )
      );
      return;
    }
    if (isWorkspaceDirty) {
      const shouldContinue = window.confirm(
        translate(
          "planLabLoadPlanDirtyConfirm",
          "載入會覆蓋你未儲存的實驗/控制項，是否繼續？"
        )
      );
      if (!shouldContinue) {
        return;
      }
    }
    if (plan.baselineSignature && plan.baselineSignature !== baselineSignature) {
      const shouldContinue = window.confirm(
        translate(
          "planLabLoadPlanBaselineMismatchConfirm",
          "Baseline 已變更，載入後會以現時 baseline 重新計算。是否繼續？"
        )
      );
      if (!shouldContinue) {
        return;
      }
    }
    const snapshot = plan.snapshot;
    const baseline = snapshot.baselinePatches ?? {};
    setBaselinePatches({
      eventPatches: baseline.eventPatches ?? {},
      rulePatches: baseline.rulePatches ?? {},
      positionPatches: baseline.positionPatches ?? {},
      smartInvestPatch: baseline.smartInvestPatch,
    });
    setExperiments(snapshot.experiments ?? []);
    setScenarioV2Patches(snapshot.scenarioV2Patches ?? emptyPlanLabScenarioV2Patches());
    setExperimentGroups((snapshot.experimentGroups as PlanLabExperimentGroup[] | undefined) ?? []);
    setFirstBucketTargetAmount(
      typeof snapshot.scorecardSettings?.firstBucketTargetAmount === "number"
        ? snapshot.scorecardSettings.firstBucketTargetAmount
        : ""
    );
    setTargetMonthInput(
      parseMonthStrict(snapshot.scorecardSettings?.targetMonth ?? "").ok
        ? (snapshot.scorecardSettings?.targetMonth as string)
        : defaultTargetMonth
    );
    setDraftMembers([]);
    setDraftBudgetRules([]);
    setDraftEvents([]);
    setActivePlanId(plan.id);
    persistPlanLibrary(planLibrary, plan.id);
    setLastSyncedWorkspaceSignature(workspaceSignature);
    setMode("edit");
  };

  const handleSavePlan = (values: { name: string; notes?: string; tags?: string[] }) => {
    const timestamp = Date.now();
    const snapshot = JSON.parse(JSON.stringify(planSnapshot)) as PlanLabSnapshot;
    const nextPlan: PlanSnapshot = {
      id: nanoid(),
      baselineScenarioId: scenario.id,
      name: values.name,
      notes: values.notes,
      tags: values.tags,
      createdAt: timestamp,
      updatedAt: timestamp,
      baselineSignature,
      payload: snapshotPayload,
      snapshot,
    };
    const nextPlans = [nextPlan, ...planLibrary.filter((plan) => plan.id !== nextPlan.id)];
    persistPlanLibrary(nextPlans, nextPlan.id);
    setPlanLibrary(nextPlans);
    setActivePlanId(nextPlan.id);
    setLastSyncedWorkspaceSignature(workspaceSignature);
    setSavePlanOpen(false);
    setSavePlanNotes(undefined);
    setSavePlanTags(undefined);
    setPlanToast(translate("planLabPlanSavedToast", "Plan saved."));
  };

  const handleUpdatePlan = () => {
    if (!activePlanId) {
      return;
    }
    const existing = plans.find((plan) => plan.id === activePlanId);
    if (!existing) {
      setPlanToast(
        translate("planLabPlanNotFound", "The selected plan no longer exists.")
      );
      setActivePlanId(null);
      return;
    }
    const timestamp = Date.now();
    const snapshot = JSON.parse(JSON.stringify(planSnapshot)) as PlanLabSnapshot;
    const nextPlan: PlanSnapshot = {
      ...existing,
      notes: savePlanNotes ?? existing.notes,
      tags: savePlanTags ?? existing.tags,
      updatedAt: timestamp,
      baselineSignature,
      payload: snapshotPayload,
      snapshot,
    };
    const nextPlans = planLibrary.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan));
    persistPlanLibrary(nextPlans, nextPlan.id);
    setPlanLibrary(nextPlans);
    setLastSyncedWorkspaceSignature(workspaceSignature);
    setPlanToast(translate("planLabPlanUpdatedToast", "Plan updated."));
  };

  const handleDuplicatePlan = (plan: Plan) => {
    const timestamp = Date.now();
    const duplicated: PlanSnapshot = {
      ...plan,
      id: nanoid(),
      name: `${plan.name} (copy)`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const nextPlans = [duplicated, ...planLibrary];
    persistPlanLibrary(nextPlans, duplicated.id);
    setPlanLibrary(nextPlans);
    setPlanToast(translate("planLabPlanDuplicatedToast", "Plan duplicated."));
  };

  const handleDeletePlan = (plan: Plan) => {
    const nextPlans = planLibrary.filter((candidate) => candidate.id !== plan.id);
    persistPlanLibrary(nextPlans, activePlanId === plan.id ? null : activePlanId);
    setPlanLibrary(nextPlans);
    if (planAId === plan.id) {
      setPlanAId(null);
    }
    if (planBId === plan.id) {
      setPlanBId(null);
    }
    if (activePlanId === plan.id) {
      setActivePlanId(null);
    }
  };

  const handleRenamePlan = (plan: Plan, name: string) => {
    const nextPlans = planLibrary.map((candidate) =>
      candidate.id === plan.id
        ? {
            ...candidate,
            name,
            updatedAt: Date.now(),
          }
        : candidate
    );
    persistPlanLibrary(nextPlans, activePlanId);
    setPlanLibrary(nextPlans);
  };

  const resolveSaveValidationError = (
    errors: Array<{ code: string; field: string }>
  ) => {
    if (errors.some((error) => error.code === "required" && error.field === "assumptions.baseMonth")) {
      return t("planLabSaveMissingDraft");
    }
    if (errors.some((error) => error.code === "missing-month")) {
      return t("planLabSaveMissingDraft");
    }
    if (errors.some((error) => error.code === "invalid-month")) {
      return t("planLabSaveInvalidMonths");
    }
    return t("planLabSaveFailed");
  };

  const handleSave = () => {
    setSaveError(null);

    const buildResult = buildScenarioDraftFromPlanLab(planSnapshot, scenario, {
      budgetRules,
    });

    if (buildResult.errors.length > 0) {
      recordScenarioMigrationEvent({
        name: "scenario_save_failed",
        ts: new Date().toISOString(),
        route: "plan-lab",
        scenarioId: scenario.id,
        source: "plan-lab",
        details: { errorCount: buildResult.errors.length },
      });
      setSaveError(resolveSaveValidationError(buildResult.errors));
      return;
    }

    const submitResult = submitScenarioDraft({
      source: "plan-lab",
      target: { scenarioId: scenario.id },
      draft: buildResult.scenarioDraft,
      context: {
        assumptionsBase: scenario.assumptions,
        metaBase: scenario.meta,
        clientComputedBase: scenario.clientComputed,
      },
    });

    if (!submitResult.ok) {
      recordScenarioMigrationEvent({
        name: "scenario_save_failed",
        ts: new Date().toISOString(),
        route: "plan-lab",
        scenarioId: scenario.id,
        source: "plan-lab",
        details: { errorCount: submitResult.errors.length },
      });
      setSaveError(resolveSaveValidationError(submitResult.errors));
      return;
    }

    const savedScenario = submitPlanLabScenarioDraft({
      baselineScenario: scenario,
      scenarioName: `${scenario.name} (Copy)`,
      payload: submitResult.payload,
      eventDefinitions: buildResult.eventDefinitions,
      budgetRules: buildResult.budgetRules,
      addedMembers: buildResult.addedMembers,
      addedBudgetRules: buildResult.addedBudgetRules,
      facade: {
        createScenario,
        replaceScenario,
        setActiveScenario,
        upsertEventDefinition,
        updateBudgetRule,
        createMember,
        createBudgetRule,
      },
    });

    router.push(scenarioDashboardPath(caseId, savedScenario.id, locale as Locale));
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
    draftEvents.forEach((event) => {
      if (event.definition.rule.startMonth && !isStrictMonth(event.definition.rule.startMonth)) {
        errors.push(event.definition.id);
      }
      if (event.definition.rule.endMonth && !isStrictMonth(event.definition.rule.endMonth)) {
        errors.push(event.definition.id);
      }
      event.definition.rule.schedule?.forEach((entry) => {
        if (entry.month && !isStrictMonth(entry.month)) {
          errors.push(event.definition.id);
        }
      });
    });
    return errors;
  }, [draftBudgetRules, draftEvents, draftMembers, eventPatches, rulePatches]);

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

  const eventDraftTimelineEvent = useMemo(() => {
    if (!eventDraftDefinition) {
      return null;
    }
    return buildTimelineEventFromDefinition(
      eventDraftDefinition,
      {
        refId: eventDraftDefinition.id,
        enabled: eventDraftRef?.enabled ?? true,
        overrides: eventDraftRef?.overrides,
      },
      {
        baseCurrency: scenario.baseCurrency,
        fallbackMonth: scenario.assumptions.baseMonth,
      }
    );
  }, [eventDraftDefinition, eventDraftRef, scenario.baseCurrency, scenario.assumptions.baseMonth]);

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
    <Stack gap="xs">
      {planToast && (
        <Notification color="teal" onClose={() => setPlanToast(null)}>
          {planToast}
        </Notification>
      )}
      {experimentToast && (
        <Notification
          color={experimentToast.color}
          onClose={() => setExperimentToast(null)}
        >
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">{experimentToast.message}</Text>
            {experimentToast.actionLabel && experimentToast.onAction && (
              <Button size="compact-xs" variant="light" onClick={experimentToast.onAction}>
                {experimentToast.actionLabel}
              </Button>
            )}
          </Group>
        </Notification>
      )}
      {templatePlanUnsupportedNotice && (
        <Notification color="yellow" onClose={() => setTemplatePlanUnsupportedNotice(null)}>
          {templatePlanUnsupportedNotice}
        </Notification>
      )}
      <Card withBorder radius="xs" padding="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2}>
              <Group gap="xs" align="center" wrap="wrap">
                <Title order={3}>{t("planLabTitle")}</Title>
                <Badge color="ice" variant="light">
                  {t("planLabPreviewBadge")}
                </Badge>
                <Pill withRemoveButton={false} bg="var(--mantine-color-aurora-1)">
                  {translate("planLabFlowStepLabel", "流程：{step}", {
                    step: statusPillLabel,
                  })}
                </Pill>
              </Group>
              <Text size="xs" c="dimmed">
                {t("planLabSubtitle")}
              </Text>
            </Stack>
            <Button size="xs" variant={mode === "compare" ? "filled" : "outline"} color="polar" onClick={handleModeToggle}>
              {mode === "edit"
                ? translate("planLabEnterCompareMode", "進入比較模式")
                : translate("planLabBackToEditMode", "返回編輯模式")}
            </Button>
          </Group>

          {isMobile ? (
            <Stack gap="xs">
              <Button size="xs" color="aurora" onClick={handleAddExperimentAction}>
                {translate("planLabCreateEditExperimentGroup", "建立 / 編輯實驗")}
              </Button>
              <Group gap="xs" grow>
                <Button size="xs" variant="outline" color="polar" onClick={() => setPlanLibraryOpen(true)}>
                  {translate("planLabCompareGroup", "比較")}
                </Button>
                <Menu shadow="md" width={220}>
                  <Menu.Target>
                    <Button size="xs" variant="light" color="polar">
                      {translate("planLabSaveGroup", "保存")}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      onClick={() => {
                        setSavePlanNotes(undefined);
                        setSavePlanTags(undefined);
                        setSavePlanOpen(true);
                      }}
                    >
                      {translate("planLabSavePlan", "Save plan")}
                    </Menu.Item>
                    <Menu.Item onClick={handleUpdatePlan} disabled={!activePlanId}>
                      {translate("planLabUpdatePlan", "Update plan")}
                    </Menu.Item>
                    <Menu.Item onClick={handleSave}>
                      {translate("planLabSaveScenario", "保存到情境")}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Stack>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
              <Paper withBorder radius="xs" p="xs">
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="dimmed">
                    {translate("planLabPrimaryGroupLabel", "建立 / 編輯實驗")}
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    <Button size="xs" color="aurora" onClick={handleAddExperimentAction}>
                      {translate("planLabExperimentsAddAction", "新增實驗")}
                    </Button>
                    <Button size="xs" variant="light" color="polar" onClick={() => setPlanLibraryOpen(true)}>
                      {translate("planLabPlansButton", "Plans ({count})", {
                        count: planCount,
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
              <Paper withBorder radius="xs" p="xs">
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="dimmed">
                    {translate("planLabSecondaryGroupLabel", "比較")}
                  </Text>
                  <Group gap="xs" wrap="wrap" grow>
                    <Select
                      size="xs"
                      label={translate("planLabCompareA", "A")}
                      data={comparePlanOptions}
                      value={planAId ?? "baseline"}
                      onChange={(value) => value && setPlanAId(value)}
                    />
                    <Select
                      size="xs"
                      label={translate("planLabCompareB", "B")}
                      data={comparePlanOptions}
                      value={planBId ?? "baseline"}
                      onChange={(value) => value && setPlanBId(value)}
                    />
                  </Group>
                </Stack>
              </Paper>
              <Paper withBorder radius="xs" p="xs">
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="dimmed">
                    {translate("planLabTertiaryGroupLabel", "保存")}
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    <Button
                      size="xs"
                      variant="outline"
                      color="polar"
                      onClick={() => {
                        setSavePlanNotes(undefined);
                        setSavePlanTags(undefined);
                        setSavePlanOpen(true);
                      }}
                    >
                      {translate("planLabSavePlan", "Save plan")}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="polar"
                      onClick={handleUpdatePlan}
                      disabled={!activePlanId}
                    >
                      {translate("planLabUpdatePlan", "Update plan")}
                    </Button>
                    <MantineTooltip
                      label={translate(
                        "planLabSaveScenarioTooltip",
                        "將目前沙盒變更套用至情境"
                      )}
                      withArrow
                    >
                      <Button size="xs" variant="outline" color="polar" onClick={handleSave}>
                        {translate("planLabSaveScenario", "保存到情境")}
                      </Button>
                    </MantineTooltip>
                  </Group>
                </Stack>
              </Paper>
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      <Card display={"none"} withBorder radius="xs" padding="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
        <Text size="sm">{t("planLabSandboxBanner")}</Text>
      </Card>

      {(
        <Grid gutter="xs">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="xs">
            <Paper withBorder radius="xs" p="xs">
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <MantineTooltip
                    label={translate(
                      "planLabScenarioEditorTooltip",
                      "檢視基準情境的事件、規則與資產（只讀）。"
                    )}
                    withArrow
                  >
                    <Text fw={600}>
                      {translate("planLabScenarioEditor", "Baseline 檢視器")}
                    </Text>
                  </MantineTooltip>
                  <SegmentedControl
                    size="xs"
                    value={groupBy}
                    onChange={(value) => setGroupBy(value as PlanLabGroupBy)}
                    data={[
                      { label: translate("planLabGroupByDomain", "Domain"), value: "domain" },
                      { label: translate("planLabGroupByMember", "Member"), value: "member" },
                      { label: translate("planLabGroupByStartMonth", "Start Month"), value: "timeBucket" },
                    ]}
                  />
                </Group>
                {groupedItems.length === 0 && !showBundleSection ? (
                  <Text size="sm" c="dimmed">
                    {translate("planLabFilterEmpty", "沒有符合條件的項目。")}
                  </Text>
                ) : isMobile ? (
                  <Stack gap="xs">
                    {showBundleSection && (
                      <Accordion
                        variant="separated"
                        radius="xs"
                        defaultValue={undefined}
                      >
                        <Accordion.Item value="bundles">
                          <Accordion.Control>
                            <Group justify="space-between" align="center" wrap="wrap">
                              <Text size="sm" fw={600}>
                                {translate(
                                  "planLabBundlesSectionTitle",
                                  "人生組合"
                                )}
                              </Text>
                              <Badge variant="light" color="blue">
                                {visibleBundleCards.length}
                              </Badge>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Stack gap="xs">
                              <Accordion variant="separated" radius="xs" multiple>
                                {visibleBundleCards.map((bundle) => {
                                  const bundleItems =
                                    bundleItemsById.get(bundle.id) ?? [];
                                  const bundleBadges: PlanLabRowBadge[] = [
                                    {
                                      label: translate(
                                        "planLabBundleBadge",
                                        "組合"
                                      ),
                                    },
                                  ];
                                  const bundleIsAffected =
                                    enabledBundleExperimentIds.has(bundle.id);
                                  const bundleControlId =
                                    appliedControlIdByItemId.get(
                                      buildBundleRowId(bundle.id)
                                    );
                                  if (bundleIsAffected) {
                                    bundleBadges.unshift({
                                      label: translate("planLabBadgeAffected", "受影響"),
                                      color: "blue",
                                    });
                                  }
                                  const summaryParts: string[] = [];
                                  if (bundle.oneOffTotal > 0) {
                                    summaryParts.push(
                                      translate(
                                        "planLabBundleRowOneOff",
                                        "一次性 {amount}",
                                        {
                                          amount: formatCurrency(
                                            bundle.oneOffTotal,
                                            scenario.baseCurrency,
                                            locale
                                          ),
                                        }
                                      )
                                    );
                                  }
                                  if (bundle.hasMonthlyImpact) {
                                    summaryParts.push(
                                      translate(
                                        "planLabBundleRowMonthlyNet",
                                        "每月淨影響 {amount}",
                                        {
                                          amount: formatCurrency(
                                            bundle.monthlyNet,
                                            scenario.baseCurrency,
                                            locale
                                          ),
                                        }
                                      )
                                    );
                                  }
                                  if (bundle.hasStartMonthOneOffImpact) {
                                    summaryParts.push(
                                      moneyT("bundleSummaryStartMonthNet", {
                                        amount: formatCurrency(
                                          bundle.monthlySummary.startMonthNet,
                                          scenario.baseCurrency,
                                          locale
                                        ),
                                        month: bundle.monthlySummary.month ?? "--",
                                      })
                                    );
                                  }
                                  const summaryText =
                                    summaryParts.join(" · ") ||
                                    translate(
                                      "planLabBundleRowItemsCount",
                                      "包含 {count} 項",
                                      { count: bundleItems.length }
                                    );
                                  return (
                                    <PlanLabAccordionRow
                                      key={bundle.id}
                                      id={buildBundleRowId(bundle.id)}
                                      ref={(node) =>
                                        registerItemRef(
                                          buildBundleRowId(bundle.id),
                                          node
                                        )
                                      }
                                      title={bundle.title}
                                      badges={bundleBadges}
                                      summary={summaryText}
                                      highlighted={
                                        highlightedItemId ===
                                        buildBundleRowId(bundle.id)
                                      }
                                      primaryAction={{
                                        label: bundleIsAffected
                                          ? translate("planLabViewDiffAction", "查看差異")
                                          : translate(
                                              "planLabBundleView",
                                              "查看組合"
                                            ),
                                        onClick: () => handleViewBundle(bundle.id),
                                      }}
                                      secondaryAction={
                                        bundleIsAffected
                                          ? {
                                              label: translate(
                                                "planLabLocateControlAction",
                                                "定位控制項"
                                              ),
                                              onClick: () =>
                                                bundleControlId
                                                  ? handleLocateControl(bundleControlId)
                                                  : undefined,
                                              disabled: !bundleControlId,
                                            }
                                          : {
                                              label: translate(
                                                "planLabBundleCreateExperiment",
                                                "新增組合實驗"
                                              ),
                                              onClick: () =>
                                                handleCreateBundleExperiment(bundle.id),
                                            }
                                      }
                                      panel={
                                        bundleItems.length === 0 ? (
                                          <Text size="xs" c="dimmed">
                                            {translate(
                                              "planLabBundleItemsEmpty",
                                              "未偵測到散件"
                                            )}
                                          </Text>
                                        ) : (
                                          <Stack gap="xs">
                                            {bundleItems.map((item) => (
                                              <PlanLabBundleItemRow
                                                key={item.id}
                                                title={getBundleChildTitle(item)}
                                                badges={getScenarioItemBadges(item)}
                                                metaTags={getScenarioItemMetaTags(item)}
                                                highlighted={
                                                  highlightedItemId === item.id
                                                }
                                              />
                                            ))}
                                            <Text size="xs" c="dimmed">
                                              {translate(
                                                "planLabBundleItemsReadonly",
                                                "散件為只讀，請使用「查看組合」查看完整內容。"
                                              )}
                                            </Text>
                                          </Stack>
                                        )
                                      }
                                    />
                                  );
                                })}
                              </Accordion>
                            </Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      </Accordion>
                    )}
                    <Accordion variant="separated" radius="xs" defaultValue={undefined}>
                      <Accordion.Item value="baseline-items">
                        <Accordion.Control>
                          <Group justify="space-between" align="center" wrap="wrap">
                            <Text size="sm" fw={600}>
                              {translate(
                                "planLabBaselineItemsSectionTitle",
                                "散件"
                              )}
                            </Text>
                            <Badge variant="light" color="blue">
                              {standaloneItems.length}
                            </Badge>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>{standaloneItemsContent}</Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  </Stack>
                ) : (
                  <ScrollArea.Autosize mah={420} offsetScrollbars>
                    <Stack gap="xs">
                      {showBundleSection && (
                        <Accordion
                          variant="separated"
                          radius="xs"
                          defaultValue="bundles"
                        >
                          <Accordion.Item value="bundles">
                            <Accordion.Control>
                              <Group justify="space-between" align="center" wrap="wrap">
                                <Text size="sm" fw={600}>
                                  {translate(
                                    "planLabBundlesSectionTitle",
                                    "人生組合"
                                  )}
                                </Text>
                                <Badge variant="light" color="blue">
                                  {visibleBundleCards.length}
                                </Badge>
                              </Group>
                            </Accordion.Control>
                            <Accordion.Panel>
                              <Stack gap="xs">
                                <Accordion variant="separated" radius="xs" multiple>
                                  {visibleBundleCards.map((bundle) => {
                                    const bundleItems =
                                      bundleItemsById.get(bundle.id) ?? [];
                                    const bundleBadges: PlanLabRowBadge[] = [
                                      {
                                        label: translate(
                                          "planLabBundleBadge",
                                          "組合"
                                        ),
                                      },
                                    ];
                                    const bundleIsAffected =
                                      enabledBundleExperimentIds.has(bundle.id);
                                    const bundleControlId =
                                      appliedControlIdByItemId.get(
                                        buildBundleRowId(bundle.id)
                                      );
                                    if (bundleIsAffected) {
                                      bundleBadges.unshift({
                                        label: translate("planLabBadgeAffected", "受影響"),
                                        color: "blue",
                                      });
                                    }
                                    const summaryParts: string[] = [];
                                    if (bundle.oneOffTotal > 0) {
                                      summaryParts.push(
                                        translate(
                                          "planLabBundleRowOneOff",
                                          "一次性 {amount}",
                                          {
                                            amount: formatCurrency(
                                              bundle.oneOffTotal,
                                              scenario.baseCurrency,
                                              locale
                                            ),
                                          }
                                        )
                                      );
                                    }
                                    if (bundle.hasMonthlyImpact) {
                                      summaryParts.push(
                                        translate(
                                          "planLabBundleRowMonthlyNet",
                                          "每月淨影響 {amount}",
                                          {
                                            amount: formatCurrency(
                                              bundle.monthlyNet,
                                              scenario.baseCurrency,
                                              locale
                                            ),
                                          }
                                        )
                                      );
                                    }
                                    if (bundle.hasStartMonthOneOffImpact) {
                                      summaryParts.push(
                                        moneyT("bundleSummaryStartMonthNet", {
                                          amount: formatCurrency(
                                            bundle.monthlySummary.startMonthNet,
                                            scenario.baseCurrency,
                                            locale
                                          ),
                                          month: bundle.monthlySummary.month ?? "--",
                                        })
                                      );
                                    }
                                    const summaryText =
                                      summaryParts.join(" · ") ||
                                      translate(
                                        "planLabBundleRowItemsCount",
                                        "包含 {count} 項",
                                        { count: bundleItems.length }
                                      );
                                    return (
                                      <PlanLabAccordionRow
                                        key={bundle.id}
                                        id={buildBundleRowId(bundle.id)}
                                        ref={(node) =>
                                          registerItemRef(
                                            buildBundleRowId(bundle.id),
                                            node
                                          )
                                        }
                                        title={bundle.title}
                                        badges={bundleBadges}
                                        summary={summaryText}
                                        highlighted={
                                          highlightedItemId ===
                                          buildBundleRowId(bundle.id)
                                        }
                                        primaryAction={{
                                          label: bundleIsAffected
                                            ? translate("planLabViewDiffAction", "查看差異")
                                            : translate(
                                                "planLabBundleView",
                                                "查看組合"
                                              ),
                                          onClick: () => handleViewBundle(bundle.id),
                                        }}
                                        secondaryAction={
                                          bundleIsAffected
                                            ? {
                                                label: translate(
                                                  "planLabLocateControlAction",
                                                  "定位控制項"
                                                ),
                                                onClick: () =>
                                                  bundleControlId
                                                    ? handleLocateControl(bundleControlId)
                                                    : undefined,
                                                disabled: !bundleControlId,
                                              }
                                            : {
                                                label: translate(
                                                  "planLabBundleCreateExperiment",
                                                  "新增組合實驗"
                                                ),
                                                onClick: () =>
                                                  handleCreateBundleExperiment(bundle.id),
                                              }
                                        }
                                        panel={
                                          bundleItems.length === 0 ? (
                                            <Text size="xs" c="dimmed">
                                              {translate(
                                                "planLabBundleItemsEmpty",
                                                "未偵測到散件"
                                              )}
                                            </Text>
                                          ) : (
                                            <Stack gap="xs">
                                              {bundleItems.map((item) => {
                                                const sourceItem = rowSourceByKey.get(item.id) ?? item;
                                                return (
                                                <PlanLabBundleItemRow
                                                  key={sourceItem.id}
                                                  title={getBundleChildTitle(sourceItem)}
                                                  badges={getScenarioItemBadges(sourceItem)}
                                                  metaTags={getScenarioItemMetaTags(sourceItem)}
                                                  highlighted={
                                                    highlightedItemId === sourceItem.id
                                                  }
                                                />
                                                );
                                              })}
                                              <Text size="xs" c="dimmed">
                                                {translate(
                                                  "planLabBundleItemsReadonly",
                                                  "散件為只讀，請使用「查看組合」查看完整內容。"
                                                )}
                                              </Text>
                                            </Stack>
                                          )
                                        }
                                      />
                                    );
                                  })}
                                </Accordion>
                              </Stack>
                            </Accordion.Panel>
                          </Accordion.Item>
                        </Accordion>
                      )}
                      {standaloneItemsContent}
                    </Stack>
                  </ScrollArea.Autosize>
                )}
              </Stack>
            </Paper>

            <Accordion
              variant="separated"
              radius="xs"
              value={controlsAccordionValue}
              onChange={(value) => setControlsAccordionValue(value)}
            >
              <Accordion.Item value="experiments">
                <Accordion.Control>
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabExperimentsTitle")}</Text>
                    <Badge variant="light" color="blue">
                      {scenarioIsV2 ? experimentGroups.length : experiments.length}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <MantineTooltip
                        label={translate(
                          "planLabExperimentsTooltip",
                          "新增假設來觀察財務走勢變化。"
                        )}
                        withArrow
                      >
                        <Text size="sm" fw={600}>
                          {translate(
                            "planLabExperimentsEnabledCount",
                            "已啟用 {enabled} / 全部 {total}",
                            {
                              enabled: enabledExperimentCount,
                              total: scenarioIsV2 ? experimentGroups.length : experiments.length,
                            }
                          )}
                        </Text>
                      </MantineTooltip>
                      <Group gap="xs" wrap="wrap">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={handleResetBaseline}
                          disabled={isExperimentLibraryEmpty}
                        >
                          {translate("planLabAppliedRevertBaseline", "還原基準調整")}
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={handleResetAllControls}
                          disabled={isExperimentLibraryEmpty}
                        >
                          {translate("planLabAppliedResetAll", "全部重設")}
                        </Button>
                        {scenarioIsV2 ? (
                          !showExperimentEmptyState && (
                            <Button size="xs" onClick={openExperimentTemplatesDrawer}>
                              {translate("planLabExperimentsAddAction", "新增")}
                            </Button>
                          )
                        ) : (
                          <>
                            <Button size="xs" variant="light" onClick={openAddMemberDrawer}>
                              {translate("planLabAddMemberAction", "新增成員")}
                            </Button>
                            <Button size="xs" variant="light" onClick={() => openAddRuleDrawer()}>
                              {translate("planLabAddRuleAction", "新增規則")}
                            </Button>
                            <Button size="xs" onClick={openAddExperimentDrawer}>
                              {translate("planLabExperimentsAddAction", "新增實驗")}
                            </Button>
                          </>
                        )}
                      </Group>
                    </Group>
                    {showExperimentEmptyState && (
                      <Stack gap={6}>
                        <Text size="sm" c="dimmed">
                          {translate(
                            "planLabExperimentsEmptyCompact",
                            "新增實驗以比較 baseline 與新方案，並即時反映 KPI/圖表。"
                          )}
                        </Text>
                        <Button size="sm" onClick={handleAddExperimentAction}>
                          {translate("planLabEmptyStateCta", "新增實驗")}
                        </Button>
                      </Stack>
                    )}
                    {scenarioIsV2 && bundleExperimentCta ? (
                      <Notification color="teal" onClose={() => setBundleExperimentCta(null)}>
                        <Group justify="space-between" align="center" wrap="wrap">
                          <Text size="sm">
                            {translate(
                              "planLabBundleCta",
                              "已新增「{title}」（{count}項）" ,
                              {
                                title: bundleExperimentCta.title,
                                count: bundleExperimentCta.itemCount,
                              }
                            )}
                          </Text>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const singleItemId = bundleExperimentCta.primaryItemId;
                              if (
                                bundleExperimentCta.source === "single" &&
                                typeof singleItemId === "string"
                              ) {
                                setExperimentGroups((current) => [
                                  ...current,
                                  createSingleItemExperimentGroup({
                                    experimentId: `exp_group_${nanoid(8)}`,
                                    itemId: singleItemId,
                                    itemLabel: bundleExperimentCta.primaryItemLabel,
                                  }),
                                ]);
                              } else {
                                createExperimentGroup({
                                  title: bundleExperimentCta.title,
                                  itemIds: bundleExperimentCta.itemIds,
                                });
                              }
                              setBundleExperimentCta(null);
                            }}
                          >
                            {translate("planLabPackAsExperimentAction", "打包成實驗")}
                          </Button>
                        </Group>
                      </Notification>
                    ) : null}
                    {(!scenarioIsV2 && experiments.length === 0) ? (
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed">
                          {scenarioIsV2
                            ? translate(
                                "planLabExperimentsEmptyRich",
                                "實驗用嚟新增可開關/可調參數嘅測試。你而家新增咗項目，但未新增實驗。"
                              )
                            : t("planLabExperimentsEmpty")}
                        </Text>
                        {scenarioIsV2 ? (
                          <Group gap="xs">
                            <Button size="xs" onClick={openExperimentTemplatesDrawer}>
                              {translate("planLabCreateExperimentAction", "新增實驗")}
                            </Button>
                            {ungroupedPatchItemIds.length > 0 && (
                              <Button
                                size="xs"
                                variant="light"
                                onClick={packageUngroupedItemsAsExperiment}
                              >
                                {translate(
                                  "planLabPackUngroupedAction",
                                  "將已新增項目打包成實驗"
                                )}
                              </Button>
                            )}
                          </Group>
                        ) : (
                          <Button size="xs" onClick={openAddExperimentDrawer}>
                            {translate("planLabExperimentsAddAction", "新增實驗")}
                          </Button>
                        )}
                      </Stack>
                    ) : (
                      <ScrollArea.Autosize mah={320} offsetScrollbars>
                        <Accordion variant="separated" radius="xs" multiple>
                          {(scenarioIsV2 ? experimentGroups : experiments).map((experiment, index, list) => {
                            if (scenarioIsV2) {
                              const group = experiment as PlanLabExperimentGroup;
                              const removedItems = group.removedItems ?? [];
                              const removedSet = new Set(removedItems.map((item) => item.itemId));
                              const activeItemIds = group.itemIds.filter((itemId) => !removedSet.has(itemId));
                              const moveUpDisabled = index === 0;
                              const moveDownDisabled = index === list.length - 1;
                              const menuItems: PlanLabRowMenuItem[] = [
                                {
                                  label: translate("planLabExperimentRename", "重新命名"),
                                  onClick: () => openRenameExperimentGroup(group),
                                },
                                {
                                  label: translate("planLabExperimentMoveUp", "上移"),
                                  onClick: () =>
                                    moveExperimentGroup(group.experimentId, "up"),
                                  disabled: moveUpDisabled,
                                },
                                {
                                  label: translate("planLabExperimentMoveDown", "下移"),
                                  onClick: () =>
                                    moveExperimentGroup(group.experimentId, "down"),
                                  disabled: moveDownDisabled,
                                },
                              ];
                              const kindLabel =
                                group.kind === "MODIFY_BASELINE_EVENT"
                                  ? translate("planLabBadgeModifyBaseline", "修改基準事件")
                                  : group.kind === "ENV_OVERRIDE"
                                  ? translate("planLabBadgeEnvOverride", "環境假設")
                                  : group.kind === "BUNDLE_EXPERIMENT"
                                  ? translate("planLabBadgeBundle", "修改人生組合")
                                  : translate("planLabBadgeAddEvent", "新增事件");
                              const badges: PlanLabRowBadge[] = [
                                {
                                  label: kindLabel,
                                  color: "blue",
                                },
                              ];
                              if (!group.isEnabled) {
                                badges.push({
                                  label: translate("planLabBadgeDisabled", "已停用"),
                                  color: "red",
                                });
                              }
                              const readableChanges = group.changes ?? [];
                              const derivedTargets = deriveExperimentTargets(group, {
                                eventLabelById,
                                bundleLabelById,
                                assumptionLabelByKey: ENV_ASSUMPTION_LABELS,
                                patchItemLookup,
                              });
                              const visibleTargets = derivedTargets.slice(0, 3);
                              const hiddenTargetCount = Math.max(derivedTargets.length - visibleTargets.length, 0);
                              return (
                                <PlanLabAccordionRow
                                  key={group.experimentId}
                                  id={`experiment-group-${group.experimentId}`}
                                  ref={(node) =>
                                    registerItemRef(`experiment-group-${group.experimentId}`, node)
                                  }
                                  title={resolveExperimentGroupTitle(group.title)}
                                  badges={badges}
                                  summary={formatExperimentSummary(readableChanges)}
                                  enabled={group.isEnabled}
                                  onToggle={() =>
                                    group.isEnabled === false
                                      ? applyExperiment(group.experimentId)
                                      : unapplyExperiment(group.experimentId)
                                  }
                                  onEdit={
                                    group.bundleInstanceId
                                      ? () => handleEditBundle(group.bundleInstanceId!)
                                      : group.primaryEventId
                                      ? () => handleEditV2Event(group.primaryEventId!)
                                      : group.kind === "ENV_OVERRIDE"
                                      ? () => openEnvAssumptionsExperimentDrawer(group)
                                      : undefined
                                  }
                                  menuItems={menuItems}
                                  primaryAction={{
                                    label: translate("planLabAppliedRemove", "移除"),
                                    onClick: () => setConfirmRemoveGroupId(group.experimentId),
                                    color: "red",
                                  }}
                                  panel={
                                    <Stack gap={6}>
                                      <Text size="xs" fw={500}>
                                        {translate("planLabExperimentChangesTitle", "變更摘要")}
                                      </Text>
                                      <Stack gap={2}>
                                        {(readableChanges.length > 0
                                          ? readableChanges
                                          : [translate("planLabAppliedUpdated", "已更新")]
                                        ).map((line) => (
                                          <Text key={`${group.experimentId}-${line}`} size="xs" c="dimmed">
                                            • {line}
                                          </Text>
                                        ))}
                                      </Stack>
                                      <Text size="xs" fw={500}>
                                        {translate("planLabExperimentIncludesItems", "包含項目")}
                                      </Text>
                                      <Stack gap={4}>
                                        {derivedTargets.length === 0 ? (
                                          <Text size="xs" c="dimmed">
                                            {translate(
                                              "planLabExperimentIncludesUnknown",
                                              "未能識別（請打開查看變更摘要）"
                                            )}
                                          </Text>
                                        ) : (
                                          <Group gap={6} wrap="wrap">
                                            {visibleTargets.map((target) => (
                                              <Group key={`${group.experimentId}-${target.kind}-${"id" in target ? target.id : target.key}`} gap={4}>
                                                <Pill
                                                  size="xs"
                                                  withRemoveButton={false}
                                                >
                                                  {target.label}
                                                </Pill>
                                                {target.kind !== "assumption" && (
                                                  <Button
                                                    size="compact-xs"
                                                    variant="subtle"
                                                    onClick={() => handleLocateItem(target.locateId)}
                                                  >
                                                    {translate("planLabLocateControlAction", "定位控制項")}
                                                  </Button>
                                                )}
                                              </Group>
                                            ))}
                                            {hiddenTargetCount > 0 && (
                                              <Pill size="xs">+{hiddenTargetCount}</Pill>
                                            )}
                                          </Group>
                                        )}
                                      </Stack>
                                      {removedItems.length > 0 && (
                                        <>
                                          <Text size="xs" fw={500} mt={4}>
                                            {translate("planLabRemovedItems", "已移除項目")}
                                          </Text>
                                          <Stack gap={4}>
                                            {removedItems.map((removedItem) => {
                                              const amountText =
                                                typeof removedItem.meta.amount === "number"
                                                  ? formatCurrency(
                                                      removedItem.meta.amount,
                                                      "HKD",
                                                      locale
                                                    )
                                                  : null;
                                              return (
                                                <Group
                                                  key={`${group.experimentId}-${removedItem.itemId}-removed`}
                                                  gap={6}
                                                  wrap="wrap"
                                                >
                                                  <Text size="xs">
                                                    {removedItem.meta.label?.trim() || removedItem.itemId}
                                                  </Text>
                                                  <Badge size="xs" variant="light" color="gray">
                                                    {removedItem.meta.type}
                                                  </Badge>
                                                  {amountText && (
                                                    <Text size="xs" c="dimmed">
                                                      {amountText}
                                                    </Text>
                                                  )}
                                                  {removedItem.meta.startMonth && (
                                                    <Text size="xs" c="dimmed">
                                                      {removedItem.meta.startMonth}
                                                    </Text>
                                                  )}
                                                  <Button
                                                    size="compact-xs"
                                                    variant="subtle"
                                                    onClick={() =>
                                                      restoreItemToExperimentGroup(
                                                        group.experimentId,
                                                        removedItem.itemId
                                                      )
                                                    }
                                                  >
                                                    {translate("planLabRestore", "恢復")}
                                                  </Button>
                                                </Group>
                                              );
                                            })}
                                          </Stack>
                                        </>
                                      )}
                                    </Stack>
                                  }
                                />
                              );
                            }
                            const legacyExperiment = experiment as PlanLabExperiment;
                            const label =
                              experimentTypeOptions.find(
                                (option) => option.value === legacyExperiment.type
                              )?.label ?? translate("planLabExperimentFallback", "實驗");
                            const moveUpDisabled = index === 0;
                            const moveDownDisabled = index === list.length - 1;
                            const menuItems: PlanLabRowMenuItem[] = [
                              {
                                label: translate("planLabExperimentRename", "重新命名"),
                                onClick: () => openRenameExperiment(legacyExperiment),
                              },
                              {
                                label: translate("planLabExperimentMoveUp", "上移"),
                                onClick: () =>
                                  moveExperiment(legacyExperiment.id, "up"),
                                disabled: moveUpDisabled,
                              },
                              {
                                label: translate("planLabExperimentMoveDown", "下移"),
                                onClick: () =>
                                  moveExperiment(legacyExperiment.id, "down"),
                                disabled: moveDownDisabled,
                              },
                            ];
                            const badges: PlanLabRowBadge[] = [
                              {
                                label: translate("planLabBadgeExperiment", "實驗"),
                                color: "blue",
                              },
                            ];
                            if (legacyExperiment.isEnabled === false) {
                              badges.push({
                                label: translate("planLabBadgeDisabled", "已停用"),
                                color: "red",
                              });
                            }
                            return (
                              <PlanLabAccordionRow
                                key={legacyExperiment.id}
                                id={`experiment-${legacyExperiment.id}`}
                                ref={(node) =>
                                  registerItemRef(`experiment-${legacyExperiment.id}`, node)
                                }
                                title={legacyExperiment.title ?? label}
                                badges={badges}
                                summary={getExperimentSummary(legacyExperiment)}
                                enabled={legacyExperiment.isEnabled !== false}
                                highlighted={
                                  highlightedItemId === `experiment-${legacyExperiment.id}`
                                }
                                onToggle={() =>
                                  updateExperiment(legacyExperiment.id, {
                                    isEnabled: legacyExperiment.isEnabled === false,
                                  })
                                }
                                onEdit={() => openEditExperimentDrawer(legacyExperiment)}
                                menuItems={menuItems}
                                primaryAction={{
                                  label: translate("planLabAppliedRemove", "移除"),
                                  onClick: () => setConfirmRemoveExperimentId(legacyExperiment.id),
                                  color: "red",
                                }}
                                panel={
                                  <Text size="xs" c="dimmed">
                                    {getExperimentSummary(legacyExperiment)}
                                  </Text>
                                }
                              />
                            );
                          })}
                        </Accordion>
                      </ScrollArea.Autosize>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>


              <Accordion.Item value="warnings">
                <Accordion.Control>
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabWarningsTitle")}</Text>
                    {(saveWarnings.length > 0 || saveError) && (
                      <Badge variant="light" color="orange">
                        {saveWarnings.length + (saveError ? 1 : 0)}
                      </Badge>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <WarningsPanel
                      warnings={planLabProjection.projectionWarnings}
                      title={projectionWarningsTitle}
                      defaultOpen={false}
                    />
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
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <div style={{ position: "sticky", top: 88 }}>
            <Stack gap="xs">
              <Card withBorder radius="xs" padding="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{translate("planLabDecisionSummaryTitle", "Decision summary")}</Text>
                    <Badge variant="light" color="violet">
                      {translate("planLabDecisionSummaryBadge", "Summary layer")}
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                    <Paper withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {translate("planLabDecisionTargetTitle", "Goal timing")}
                        </Text>
                        <Text size="sm" fw={700}>{decisionSummary.targetTiming}</Text>
                      </Stack>
                    </Paper>
                    <Paper withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {translate("planLabDecisionCashRiskTitle", "Cash risk trend")}
                        </Text>
                        <Text size="sm" fw={700}>{decisionSummary.riskTrend}</Text>
                        <Text size="xs" c="dimmed">
                          {t("planLabDecisionRiskLevelLabel", { level: decisionSummary.riskLevel })}
                        </Text>
                      </Stack>
                    </Paper>
                    <Paper withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {translate("planLabDecisionRiskTimingTitle", "Risk timing")}
                        </Text>
                        <Text size="sm" fw={700}>{decisionSummary.riskTiming}</Text>
                      </Stack>
                    </Paper>
                    <Paper withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {translate("planLabDecisionPositiveDriverTitle", "Top positive driver")}
                        </Text>
                        <Text size="sm" fw={700}>
                          {decisionSummary.maxPositiveDriver?.title ?? translate("planLabDecisionNoDriver", "No significant driver")}
                        </Text>
                      </Stack>
                    </Paper>
                    <Paper withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {translate("planLabDecisionNegativeDriverTitle", "Top negative driver")}
                        </Text>
                        <Text size="sm" fw={700}>
                          {decisionSummary.maxNegativeDriver?.title ?? translate("planLabDecisionNoDriver", "No significant driver")}
                        </Text>
                      </Stack>
                    </Paper>
                  </SimpleGrid>
                  <Paper withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                    <Stack gap={6}>
                      <Text size="xs" c="dimmed">
                        {translate("planLabDecisionNextStepTitle", "Recommended next steps")}
                      </Text>
                      {decisionSummary.recommendedActions.length === 0 ? (
                        <Text size="sm" c="dimmed">
                          {translate("planLabDecisionNoAction", "No immediate action required. Continue monitoring monthly cashflow.")}
                        </Text>
                      ) : (
                        <Stack gap="xs">
                          {decisionSummary.recommendedActions.map((action) => (
                            <Paper key={action.id} withBorder radius="xs" p="xs">
                              <Stack gap={2}>
                                <Text size="sm" fw={600}>{action.label}</Text>
                                <Text size="xs" c="dimmed">{action.reason}</Text>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
              </Card>

              <Card withBorder radius="xs" padding="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{translate("planLabKpiPanelTitle", "Impact KPIs")}</Text>
                    <Badge variant="light" color={hasUnsavedChanges ? "orange" : "gray"}>
                      {hasUnsavedChanges
                        ? translate("planLabDirtyLabel", "未儲存")
                        : translate("planLabKpiBaselineLabel", "基準")}
                    </Badge>
                  </Group>
                  <Stack gap="xs">
                    <SimpleGrid cols={{ base: 2, md: 2 }} spacing="sm">
                      <MultiSelect
                        label={translate("planLabPersonaFocusLabel", "人生階段重點")}
                        data={PERSONA_FOCUS_KEYS.map((key) => ({
                          value: key,
                          label: translate(`planLabPersonaFocus.${key}`, key),
                        }))}
                        value={personaFocuses}
                        onChange={(values) =>
                          updateScenarioMeta(scenario.id, {
                            personaFocuses: values as PersonaFocus[],
                          })
                        }
                        placeholder={translate("planLabPersonaFocusPlaceholder", "可多選")}
                        searchable={false}
                        clearable
                      />
                      <Select
                        label={translate("planLabKpiTargetLabel", "目標淨資產")}
                        placeholder={translate("planLabScorecardTargetPrompt", "設定目標")}
                        data={targetPresetOptions}
                        value={targetSelectValue}
                        clearable
                        onChange={(value) => {
                          if (!value) {
                            setFirstBucketTargetAmount("");
                            return;
                          }
                          const numeric = Number(value);
                          setFirstBucketTargetAmount(Number.isFinite(numeric) ? numeric : "");
                        }}
                      />
                      <MonthField
                        label={translate("planLabKpiTargetMonthLabel", "目標月份")}
                        value={targetMonthInput}
                        onChange={(value) => setTargetMonthInput(value)}
                        onBlur={() => {
                          const parsed = parseMonthStrict(targetMonthInput);
                          setTargetMonthInput(parsed.ok ? parsed.month : defaultTargetMonth);
                        }}
                      />
                      <NumberInput
                        display={"none"}
                        label={translate("planLabScorecardTargetAmount", "目標金額")}
                        value={firstBucketTargetAmount}
                        min={0}
                        onChange={(value) =>
                          setFirstBucketTargetAmount(typeof value === "number" ? value : "")
                        }
                      />
                    </SimpleGrid>
                  </Stack>
                  {!planLabProjection.projection ? (
                    <Text size="sm" c="dimmed">
                      {t("planLabScorecardDisabled")}
                    </Text>
                  ) : (
                    <SimpleGrid cols={{ base: 2, md: 2 }} spacing="sm">
                      {personaOrderedKpiCards.map((card) => {
                        const deltaColor =  
                          card.delta?.direction === "up"
                            ? card.better === "higher" ? "teal" : "red"
                            : card.delta?.direction === "down"
                            ? card.better === "lower" ? "teal" : "red"
                            : "gray";
                        const labelA =
                          mode === "compare"
                            ? translate("planLabComparePlanLabel", "Plan {label}", {
                                label: "A",
                              })
                            : translate("planLabKpiCurrentLabel", "當前");
                        const labelB =
                          mode === "compare"
                            ? translate("planLabComparePlanLabel", "Plan {label}", {
                                label: "B",
                              })
                            : translate("planLabKpiBaselineLabel", "基準");
                        return (
                          <Paper key={card.key} withBorder radius="xs" p="xs" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                            <Stack gap={6}>
                              <Group justify="space-between" align="center" wrap="wrap">
                                <Group gap={4} align="center">
                                  <Text size="sm" fw={600} c="dimmed">
                                    {card.label}
                                  </Text>
                                  {("tooltip" in card) && card.tooltip ? (
                                    <MantineTooltip label={card.tooltip} withArrow>
                                      <Text size="xs" c="dimmed" style={{ cursor: "help" }}>ⓘ</Text>
                                    </MantineTooltip>
                                  ) : null}
                                </Group>
                                {"actionLabel" in card && card.actionLabel && (
                                  <MantineTooltip
                                    label={card.actionDisabled ? card.actionTooltip : undefined}
                                    disabled={!card.actionDisabled}
                                    withArrow
                                  >
                                    <span>
                                      <Button
                                        size="compact-xs"
                                        variant="subtle"
                                        disabled={card.actionDisabled}
                                        onClick={() =>
                                          openModal("monthlyBreakdown", {
                                            month: targetMonth,
                                            focus: "networth",
                                          })
                                        }
                                      >
                                        {card.actionLabel}
                                      </Button>
                                    </span>
                                  </MantineTooltip>
                                )}
                              </Group>
                              
                              <SimpleGrid cols={2} spacing="xs">
                                <Stack gap={2} style={{ minWidth: 0 }} data-testid="kpi-current">
                                  <Text size="xs" c="dimmed">
                                    {labelA}
                                  </Text>
                                  <Text
                                    fw={700}
                                    size="sm"
                                    style={{
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "pre-line",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {card.valueA}
                                  </Text>
                                </Stack>
                                <Stack gap={2} style={{ minWidth: 0 }} data-testid="kpi-baseline">
                                  <Text size="xs" c="dimmed">
                                    {labelB}
                                  </Text>
                                  <Text
                                    fw={700}
                                    size="sm"
                                    ta="right"
                                    style={{
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "pre-line",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {card.valueB}
                                  </Text>
                                </Stack>
                              </SimpleGrid>
                              <Group justify="space-between" align="center" wrap="wrap">
                                <Group gap={4} align="center">
                                  <Text size="xs" c="dimmed">
                                    {mode === "compare"
                                      ? translate("planLabKpiDeltaCompareLabel", "Δ（方案 A - 方案 B）")
                                      : translate("planLabKpiDeltaLabel", "Δ")}
                                  </Text>
                                  {mode === "compare" ? (
                                    <MantineTooltip
                                      label={translate(
                                        "planLabKpiDeltaCompareTooltip",
                                        "A 代表目前編輯中的方案，B 代表基準方案。"
                                      )}
                                      withArrow
                                    >
                                      <Text size="xs" c="dimmed" style={{ cursor: "help" }}>ⓘ</Text>
                                    </MantineTooltip>
                                  ) : null}
                                </Group>
                                {card.delta ? (
                                  <Badge variant="light" color={deltaColor}>
                                    {card.delta.display}
                                  </Badge>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    —
                                  </Text>
                                )}
                              </Group>
                              {card.helper && (
                                <Text size="xs" c="dimmed">
                                  {card.helper}
                                </Text>
                              )}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </SimpleGrid>
                  )}
                </Stack>
              </Card>

              <Card withBorder radius="xs" padding="xs">
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{translate("planLabTopDriversTitle", "Top Drivers / 差異原因")}</Text>
                    <Badge variant="light" color="blue">
                      {topDrivers.length}
                    </Badge>
                  </Group>
                  {topDriversLoading && topDrivers.length === 0 ? (
                    <Stack gap="xs">
                      <Skeleton height={18} radius="sm" />
                      <Skeleton height={18} radius="sm" />
                      <Skeleton height={18} radius="sm" />
                    </Stack>
                  ) : topDrivers.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {translate("planLabTopDriversEmpty", "暫無可分析改動")}
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {topDrivers.map((driver) => (
                        <Button
                          key={driver.id}
                          variant="subtle"
                          justify="space-between"
                          onClick={() => handleTopDriverClick(driver)}
                        >
                          <Text size="sm">{driver.title}</Text>
                          <Badge
                            variant="light"
                            color={driver.contribution >= 0 ? "teal" : "red"}
                          >
                            {driver.contribution >= 0 ? "+" : ""}
                            {formatCurrency(
                              driver.contribution,
                              scenario.baseCurrency,
                              locale
                            )}
                          </Badge>
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Card>

              {cashRiskScorecard && (
                <PlanLabCashRiskScorecard
                  result={cashRiskScorecard}
                  baseCurrency={scenario.baseCurrency}
                  locale={locale}
                />
              )}

              <Card withBorder radius="xs" padding="xs">
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabPreviewTitle")}</Text>
                    <Group gap="xs">
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
                      <Button size="xs" variant="light" onClick={() => setChartPreviewOpen(true)}>
                        {translate("planLabChartPreviewAction", "預覽圖表")}
                      </Button>
                    </Group>
                  </Group>
                  {renderProjectionChart(260)}
                </Stack>
              </Card>
            </Stack>
          </div>
        </Grid.Col>
        </Grid>
      )}

      <Modal
        opened={chartPreviewOpen}
        onClose={() => setChartPreviewOpen(false)}
        title={translate("planLabChartPreviewModalTitle", "預覽圖表")}
        fullScreen
        centered
        styles={{ body: { height: "calc(100vh - 64px)", padding: 0 } }}
      >
        <Stack gap="sm" h="100%" p="sm">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text fw={600}>{translate("planLabChartPreviewModalTitle", "預覽圖表")}</Text>
            <SegmentedControl
              size="sm"
              data={[
                { value: "netWorth", label: t("planLabChartNetWorth") },
                { value: "cash", label: t("planLabChartCash") },
                { value: "netCashflow", label: t("planLabChartNetCashflow") },
              ]}
              value={chartType}
              onChange={(value) => setChartType(value as ChartType)}
            />
          </Group>
          <Box style={{ flex: 1, overflowY: "auto" }}>
            <Box style={{ overflowX: "auto" }}>
              <Box style={{ position: "relative", minWidth: previewMonthScale.totalWidth }}>
                <Box style={{ minWidth: previewMonthScale.totalWidth }}>
                  {renderProjectionChart(isMobile ? 360 : 620, {
                    hideXAxis: true,
                    syncCrosshair: true,
                    fixedWidth: previewMonthScale.totalWidth,
                  })}
                </Box>
                {cursorX !== null && (
                  <Box
                    style={{
                      position: "absolute",
                      left: cursorX,
                      top: isMobile ? 16 : 24,
                      bottom: 24,
                      width: 1,
                      borderLeft: "1px dashed var(--mantine-color-blue-7)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                <Card withBorder radius="xs" padding="sm" mt="sm" style={{ minWidth: previewMonthScale.totalWidth }}>
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Text fw={600}>{translate("planLabTimelineTitle", "人生大事件")}</Text>
                      <Badge variant="light" color="blue">
                        {previewTimelineItems.length}
                      </Badge>
                    </Group>
                    {previewTimelineRange && previewTimelineItems.length > 0 ? (
                      <PlanLabTimelinePreview
                        items={previewTimelineItems}
                        monthScale={previewMonthScale}
                        isMobile={isMobile}
                        activeMonthIdx={activeMonthIdx}
                        onMonthClick={(monthIdx) => {
                          setLockedMonthIdx((current) => (current === monthIdx ? null : monthIdx));
                          setHoverMonthIdx(monthIdx);
                        }}
                        height={isMobile ? 260 : 220}
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        {translate("planLabTimelineEmpty", "暫無可展示事件")}
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Modal>

      <MonthlyBreakdownModalHost
        months={planLabProjection.months}
        ledgerByMonth={planLabProjection.ledgerByMonth}
        summaryByMonth={planLabProjection.summaryByMonth}
        positionCashflowsByMonth={planLabProjection.positionCashflowsByMonth}
        projectionNetCashflowByMonth={planLabProjection.projectionNetCashflowByMonth}
        projectionNetCashflowMode={planLabProjection.projectionNetCashflowMode}
        netWorthByMonth={planLabNetWorthByMonth}
        netWorthBreakdownByMonth={planLabProjection.netWorthBreakdownByMonth}
        currency={scenario.baseCurrency}
        scenarioId={scenario.id}
        baseMonth={scenario.assumptions.baseMonth}
        horizonMonths={scenario.assumptions.horizonMonths}
      />

      <PlanLibraryDrawer
        opened={planLibraryOpen}
        onClose={() => setPlanLibraryOpen(false)}
        scenario={scenario}
        baselineSignature={baselineSignature}
        plans={plans}
        otherPlans={otherPlans}
        locale={locale}
        eventLibrary={eventLibrary}
        members={members}
        budgetRules={budgetRules}
        translate={translate}
        onLoadPlan={(plan) => {
          handleLoadPlanSnapshot(plan);
          setPlanLibraryOpen(false);
        }}
        onSetPlanA={(plan) => {
          setPlanAId(plan.id);
          setMode("compare");
          setPlanLibraryOpen(false);
        }}
        onSetPlanB={(plan) => {
          setPlanBId(plan.id);
          setMode("compare");
          setPlanLibraryOpen(false);
        }}
        onDuplicatePlan={handleDuplicatePlan}
        onRenamePlan={handleRenamePlan}
        onDeletePlan={handleDeletePlan}
      />

      <SavePlanModal
        opened={savePlanOpen}
        onClose={() => setSavePlanOpen(false)}
        snapshot={planSnapshot}
        defaultName={defaultPlanName}
        defaultNotes={savePlanNotes}
        defaultTags={savePlanTags}
        warnings={[...planSnapshotWarnings, ...planPatchWarnings]}
        translate={translate}
        onSave={handleSavePlan}
      />

      <Drawer
        opened={memberDrawerOpen}
        onClose={() => setMemberDrawerOpen(false)}
        position="right"
        size="lg"
        zIndex={400}
        styles={drawerStyles}
        title={
          memberDrawerMode === "edit"
            ? translate("planLabMemberDrawerEditTitle", "編輯成員")
            : translate("planLabMemberDrawerTitle", "新增成員")
        }
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
            {memberDrawerMode === "add" && isChildDraft && childTemplateOptions.length > 0 && (
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
                {memberDrawerMode === "edit"
                  ? translate("planLabActionSave", "儲存")
                  : translate("planLabActionAddMember", "新增成員")}
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>

      <MortgageDetailDrawer
        opened={Boolean(mortgageDetail && mortgageDetailEvent)}
        onClose={() => {
          setMortgageDetail(null);
          setLastBundleDrawerState(null);
        }}
        onBack={
          lastBundleDrawerState
            ? () => {
                const saved = lastBundleDrawerState;
                setMortgageDetail(null);
                setLastBundleDrawerState(null);
                setBundleViewId(saved.bundleId);
                setBundleDrawerFocus(saved.focusSection);
              }
            : undefined
        }
        backLabel={
          lastBundleTitle
            ? translate("planLabBundleBackLabel", "返回：{title}", {
                title: lastBundleTitle,
              })
            : undefined
        }
        onEdit={
          mortgageDetail?.bundleId &&
          experimentGroups.some((group) => group.bundleInstanceId === mortgageDetail.bundleId)
            ? () => {
                handleEditBundle(mortgageDetail.bundleId);
                setMortgageDetail(null);
              }
            : undefined
        }
        event={mortgageDetailEvent}
        asset={mortgageDetailAsset}
        liability={mortgageDetailLiability}
        baseCurrency={scenario.baseCurrency}
        locale={locale}
        defaultTab={mortgageDetail?.tab ?? "overview"}
        currentMonth={planLabProjection.months[0] ?? scenario.assumptions.baseMonth ?? null}
      />

      <Drawer
        opened={Boolean(activeBundleCard)}
        onClose={() => {
          setBundleViewId(null);
          setBundleDrawerFocus(null);
        }}
        position="right"
        size="md"
        title={activeBundleCard?.title ?? moneyT("bundleTitleFallback")}
        styles={drawerStyles}
      >
        {activeBundleCard ? (
          <Stack gap="xs">
            <Stack gap={4} ref={bundleSummaryRef}>
              <Text size="sm" fw={600}>
                {moneyT("bundleDetailSummaryTitle")}
              </Text>
              <Text size="sm" c="dimmed">
                {moneyT("bundleSummaryOneOff", {
                  amount:
                    activeBundleCard.oneOffTotal > 0
                      ? formatCurrency(
                          activeBundleCard.oneOffTotal,
                          scenario.baseCurrency,
                          locale
                        )
                      : moneyT("amountUnset"),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {moneyT("bundleSummaryMonthlyIncome", {
                  amount: activeBundleCard.hasMonthlyImpact
                    ? formatCurrency(
                        activeBundleCard.monthlyIncome,
                        scenario.baseCurrency,
                        locale
                      )
                    : moneyT("amountUnset"),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {moneyT("bundleSummaryMonthlyExpense", {
                  amount: activeBundleCard.hasMonthlyImpact
                    ? formatCurrency(
                        activeBundleCard.monthlyExpense,
                        scenario.baseCurrency,
                        locale
                      )
                    : moneyT("amountUnset"),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {moneyT("bundleSummaryMonthlyNet", {
                  amount: activeBundleCard.hasMonthlyImpact
                    ? formatCurrency(
                        activeBundleCard.monthlyNet,
                        scenario.baseCurrency,
                        locale
                      )
                    : moneyT("amountUnset"),
                })}
              </Text>
              {activeBundleCard.hasStartMonthOneOffImpact && (
                <Text size="sm" c="dimmed">
                  {moneyT("bundleSummaryStartMonthNet", {
                    amount: formatCurrency(
                      activeBundleCard.monthlySummary.startMonthNet,
                      scenario.baseCurrency,
                      locale
                    ),
                    month: activeBundleCard.monthlySummary.month ?? "--",
                  })}
                </Text>
              )}
              {activeBundleCard.assets.map((asset) => (
                <Text size="sm" c="dimmed" key={asset.id}>
                  {moneyT("bundleSummaryAssetItem", {
                    name: asset.label ?? moneyT("assetUntitled"),
                    amount:
                      typeof asset.currentValue === "number"
                        ? formatCurrency(
                            asset.currentValue,
                            scenario.baseCurrency,
                            locale
                          )
                        : moneyT("amountUnset"),
                  })}
                </Text>
              ))}
              {activeBundleCard.liabilities.map((liability) => (
                <Text size="sm" c="dimmed" key={liability.id}>
                  {moneyT("bundleSummaryLiabilityItem", {
                    name: liability.label ?? moneyT("liabilityUntitled"),
                    amount:
                      typeof liability.principalOutstanding === "number"
                        ? formatCurrency(
                            liability.principalOutstanding,
                            scenario.baseCurrency,
                            locale
                          )
                        : moneyT("amountUnset"),
                  })}
                </Text>
              ))}
            </Stack>

            <Stack gap="xs" ref={bundleCashflowRef}>
              <Text size="sm" fw={600}>
                {moneyT("bundleDetailCashflowTitle")}
              </Text>
              {bundleDetailIncomeItems.length > 0 && (
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {moneyT("bundleDetailIncome")}
                  </Text>
                  {bundleDetailIncomeItems.map((item) => (
                    <Group key={item.id} justify="space-between" wrap="nowrap">
                      <Text size="sm">{item.label}</Text>
                      <Text size="sm" fw={500}>
                        {formatCurrency(item.amount, scenario.baseCurrency, locale)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}

              {bundleDetailExpenseItems.length > 0 && (
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {moneyT("bundleDetailExpenses")}
                  </Text>
                  {bundleDetailExpenseItems.map((item) => (
                    <Group key={item.id} justify="space-between" wrap="nowrap">
                      <Text size="sm">{item.label}</Text>
                      <Text size="sm" fw={500}>
                        {formatCurrency(item.amount, scenario.baseCurrency, locale)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}

              {bundleDetailIncomeItems.length === 0 &&
                bundleDetailExpenseItems.length === 0 && (
                  <Text size="sm" c="dimmed">
                    {moneyT("bundleDetailEmpty")}
                  </Text>
                )}
            </Stack>

            {activeBundleMortgageSummary && (
              <Stack gap="xs" ref={bundleMortgageRef}>
                <Text size="sm" fw={600}>
                  {moneyT("bundleMortgageSummaryTitle")}
                </Text>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{moneyT("bundleMortgageSummaryLoanAmount")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.loanAmount === "number"
                      ? formatCurrency(
                          activeBundleMortgageSummary.loanAmount,
                          scenario.baseCurrency,
                          locale
                        )
                      : moneyT("amountUnset")}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{moneyT("bundleMortgageSummaryRate")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.ratePct === "number"
                      ? `${formatGrowthPct(activeBundleMortgageSummary.ratePct)}%`
                      : moneyT("amountUnset")}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{moneyT("bundleMortgageSummaryTerm")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.termYears === "number"
                      ? new Intl.NumberFormat(locale).format(
                          activeBundleMortgageSummary.termYears
                        )
                      : moneyT("amountUnset")}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{moneyT("bundleMortgageSummaryPayment")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.monthlyPayment === "number"
                      ? formatCurrency(
                          activeBundleMortgageSummary.monthlyPayment,
                          scenario.baseCurrency,
                          locale
                        )
                      : moneyT("amountUnset")}
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    openMortgageDetails(
                      activeBundleCard.id,
                      activeBundleMortgageSummary.eventId,
                      "liability"
                    )
                  }
                >
                  {moneyT("bundleMortgageSummaryViewDetails")}
                </Button>
              </Stack>
            )}

            <Group justify="flex-end">
              {canEditActiveBundle ? (
                <Button onClick={() => handleEditBundle(activeBundleCard.id)}>
                  {moneyT("bundleEdit")}
                </Button>
              ) : (
                <Button
                  variant="light"
                  onClick={() => handleCreateBundleExperiment(activeBundleCard.id)}
                >
                  {translate("planLabBundleCreateExperiment", "新增組合實驗")}
                </Button>
              )}
            </Group>
          </Stack>
        ) : null}
      </Drawer>

      <ExperimentTemplatesDrawer
        opened={experimentTemplatesOpen}
        title={translate("planLabExperimentTemplatesTitle", "Experiment templates")}
        labels={{
          decisionTemplateTitle: translate("planLabDecisionTemplatesModeTitle", "Decision templates"),
          decisionTemplateDescription: translate(
            "planLabDecisionTemplatesModeDesc",
            "Apply common family decisions in one click"
          ),
          addEventTitle: translate("planLabTemplateModeAddEventTitle", "Add new event"),
          addEventDescription: translate(
            "planLabTemplateModeAddEventDesc",
            "Open template picker to add a new event"
          ),
          modifyBaselineTitle: translate("planLabTemplateModeModifyBaselineTitle", "Modify baseline event"),
          modifyBaselineDescription: translate(
            "planLabTemplateModeModifyBaselineDesc",
            "Create override experiment from baseline events"
          ),
          modifyEnvironmentTitle: translate("planLabTemplateModeModifyEnvTitle", "Adjust assumptions"),
          modifyEnvironmentDescription: translate(
            "planLabTemplateModeModifyEnvDesc",
            "Create environment override experiment"
          ),
          chooseActionLabel: translate("planLabTemplateChooseAction", "Choose"),
          applyLabel: translate("planLabTemplateApplyAction", "Apply"),
          backLabel: translate("planLabTemplateBackAction", "Back"),
          emptyDecisionTemplatesLabel: translate(
            "planLabDecisionTemplatesEmpty",
            "No decision templates available for this scenario"
          ),
          costRangeTitle: translate("planLabCostRangeTitle", "Common local cost ranges"),
          estimateGuideLabel: translate("planLabEstimateGuideLabel", "Why this estimate"),
          conservativeTierLabel: translate("planLabCostTierConservative", "Conservative"),
          medianTierLabel: translate("planLabCostTierMedian", "Median"),
          aggressiveTierLabel: translate("planLabCostTierAggressive", "Aggressive"),
        }}
        groups={[]}
        decisionTemplates={decisionTemplateOptions}
        baselineEventOptions={baselineEventTemplateOptions}
        envOptions={environmentTemplateOptions}
        onClose={() => setExperimentTemplatesOpen(false)}
        onSelect={() => {
          // no-op: add-event flow is handled by onSelectAddEvent
        }}
        onSelectDecisionTemplate={handleSelectDecisionTemplate}
        onSelectDecisionTemplateCostProfile={handleSelectDecisionTemplateCostProfile}
        onSelectAddEvent={() => {
          openPlanLabAddFlowDrawer();
        }}
        onSelectBaselineEvent={(eventId) => {
          setExperimentTemplatesOpen(false);
          const selectedEvent = (baselineScenarioV2.events ?? []).find((event) => event.id === eventId);
          const parentEventId = selectedEvent ? getSalaryAdjustmentParentId(selectedEvent) ?? undefined : undefined;
          openCreateExperimentFlow({
            eventId,
            isChild: Boolean(parentEventId),
            parentEventId,
          });
        }}
        onSelectEnvKey={handleSelectEnvironmentTemplate}
      />


      <Drawer
        opened={envAssumptionsDrawerOpen}
        onClose={() => {
          setEnvAssumptionsDrawerOpen(false);
          setEnvAssumptionsViewGroupId(null);
        }}
        position="right"
        size="md"
        title={translate("planLabEmptyStateAssumptionsAction", "修改環境假設")}
      >
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {translate(
              "planLabEnvOverrideHint",
              "你正在新增實驗，不會改動 baseline；可隨時開關比較 KPI/圖表。"
            )}
          </Text>
          <ScenarioAssumptionsOverrideForm
            values={envAssumptionOverridesDraft}
            baseline={baselineAssumptionOverrides}
            labels={{
              inflationRate: translate("inflationRate", "通脹率 (%)"),
              salaryGrowthRate: translate("salaryGrowth", "薪金增長 (%)"),
              emergencyFundMonths: translate("emergencyFundTarget", "緊急儲備目標"),
              emergencyFundValue: (months) =>
                translate("emergencyFundValue", "{months} 個月", { months }),
              rentAnnualGrowthPct: translate("rentAnnualGrowth", "租金增長 (%)"),
              propertyAppreciationPct: translate("propertyAppreciation", "房產增值 (%)"),
              cashYieldPct: translate("cashYield", "現金收益率 (%)"),
              carDepreciationRatePct: translate("carDepreciation", "汽車折舊 (%)"),
              baselinePrefix: `${translate("baseline", "基準")}：`,
              guardrailWarningTitle: translate("guardrailWarningTitle", "軟性風險提示"),
              guardrailImpactText: translate(
                "guardrailImpactText",
                "這會顯著影響長期預測結果。"
              ),
              guardrailInflationOutOfComfortRange: (inflationRate) =>
                translate(
                  "guardrailInflationOutOfComfortRange",
                  "目前通脹率 {inflationRate}% 超出常見建議區間（-5% 至 10%）。",
                  { inflationRate }
                ),
              guardrailSalaryInflationGapTooWide: (gap) =>
                translate(
                  "guardrailSalaryInflationGapTooWide",
                  "薪金增長與通脹率相差 {gap}%，假設可能過度樂觀或悲觀。",
                  { gap }
                ),
              guardrailApplySuggestion: translate("guardrailApplySuggestion", "快捷回復建議值："),
              guardrailSuggestedInflation: (value) =>
                translate("guardrailSuggestedInflation", "通脹 {value}%", { value }),
              guardrailSuggestedSalaryGrowth: (value) =>
                translate("guardrailSuggestedSalaryGrowth", "薪金增長 {value}%", { value }),
            }}
            emergencyFundRange={{ min: 0, max: 24, step: 1 }}
            onChange={(patch) =>
              setEnvAssumptionOverridesDraft((current) => ({ ...current, ...patch }))
            }
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setEnvAssumptionsDrawerOpen(false);
                setEnvAssumptionsViewGroupId(null);
              }}
            >
              {translate("planLabCancel", "取消")}
            </Button>
            <Button onClick={saveEnvAssumptionsExperiment}>
              {translate("planLabCreateExperimentAction", "新增實驗")}
            </Button>
          </Group>
        </Stack>
      </Drawer>
      <BundleWizardDrawer
        opened={bundleWizardOpen}
        template={bundleTemplate}
        mode={bundleWizardMode}
        bundleInstanceId={bundleWizardInstanceId}
        initialWizardInput={bundleWizardInitialInput}
        scenarioId={scenario.id}
        baseMonth={scenario.assumptions.baseMonth}
        baseCurrency={scenario.baseCurrency}
        scenarioEvents={sandboxScenarioV2.events ?? []}
        onClose={() => {
          setBundleWizardOpen(false);
          setBundleTemplate(null);
          setBundleWizardMode("create");
          setBundleWizardInstanceId(null);
          setBundleWizardInitialInput(null);
          setBundleWizardExperimentMode(false);
        }}
        onApplyEvents={handleApplyBundleEvents}
        allowInlineEdit={false}
      />

      <AddFlowDrawer
        opened={templatePickerOpen}
        mode="planlab"
        defaultCategory={templatePickerCategory}
        defaultIntent={templatePickerIntent}
        defaultItemCategory={templatePickerItemCategory}
        onClose={() => {
          setTemplatePickerOpen(false);
          setTemplatePlanUnsupportedNotice(null);
        }}
        onSelect={handleTemplateSelect}
      />

      {scenarioIsV2 && (
        <>
          <CashflowEventDrawer
            opened={
              v2EventDrawerOpen &&
              (v2EventDrawerType === "cashflow" || v2EventDrawerType === "adjustment")
            }
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            scenarioStartMonth={scenario.assumptions.baseMonth ?? null}
            scenarioHorizonMonths={scenario.assumptions.horizonMonths ?? null}
            incomeGrowthPct={scenario.assumptions.salaryGrowthRate ?? null}
            inflationPct={scenario.assumptions.inflationRate ?? null}
            rentGrowthPct={scenario.assumptions.rentAnnualGrowthPct ?? null}
            members={sandboxScenarioV2.members ?? []}
            event={v2EventDrawerMode === "edit" ? editingCashflowEvent : null}
            defaultKind={v2EventDefaultKind}
            initialCashflowDraft={salaryAdjustmentInitialDraft ?? templateCashflowDraft ?? undefined}
            salaryAdjustmentContext={salaryAdjustmentContext}
            onClose={closeV2EventDrawer}
            onSave={handleSaveV2Event}
          />
          <HousingEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "housing"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingHousingEvent : null}
            initialDraft={templateHousingDraft ?? undefined}
            rentGrowthPct={scenario.assumptions.rentAnnualGrowthPct ?? null}
            propertyAppreciationPct={
              scenario.assumptions.propertyAppreciationPct ?? null
            }
            onClose={closeV2EventDrawer}
            onSave={handleSaveHousingEvent}
          />
          <LoanEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "loan"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingLoanEvent : null}
            initialDraft={templateLoanDraft ?? undefined}
            onClose={closeV2EventDrawer}
            onSave={handleSaveLoanEvent}
          />
          <InsuranceEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "insurance"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingInsuranceEvent : null}
            initialDraft={templateInsuranceDraft ?? undefined}
            onClose={closeV2EventDrawer}
            onSave={handleSaveInsuranceEvent}
          />
          <Drawer
            opened={Boolean(assetDrawerItem)}
            onClose={() => setAssetDrawerItem(null)}
            position="right"
            size="md"
            title={translate("planLabAssetDrawerTitle", "資產")}
          >
            {assetDrawerItem ? (
              <Stack gap="xs">
                <Text fw={600}>{defaultAssetLabel(assetDrawerItem)}</Text>
                <Text size="sm">
                  {translate("planLabAssetDrawerKind", "類型")}: {assetDrawerItem.kind}
                </Text>
                {assetDrawerItem.currentValue != null && (
                  <Text size="sm">
                    {translate("planLabAssetDrawerValue", "現值")}:{" "}
                    {formatCurrency(
                      assetDrawerItem.currentValue ?? 0,
                      scenario.baseCurrency,
                      locale
                    )}
                  </Text>
                )}
                {assetDrawerItem.startMonth && (
                  <Text size="sm">
                    {translate("planLabAssetDrawerStartMonth", "開始月份")}:{" "}
                    {assetDrawerItem.startMonth}
                  </Text>
                )}
                {assetDrawerItem.notes && (
                  <Text size="sm">
                    {translate("planLabAssetDrawerNotes", "備註")}: {assetDrawerItem.notes}
                  </Text>
                )}
              </Stack>
            ) : null}
          </Drawer>
          <Drawer
            opened={Boolean(liabilityDrawerItem)}
            onClose={() => setLiabilityDrawerItem(null)}
            position="right"
            size="md"
            title={translate("planLabLiabilityDrawerTitle", "負債")}
          >
            {liabilityDrawerItem ? (
              <Stack gap="xs">
                <Text fw={600}>{defaultLiabilityLabel(liabilityDrawerItem)}</Text>
                <Text size="sm">
                  {translate("planLabLiabilityDrawerKind", "類型")}:{" "}
                  {liabilityDrawerItem.kind}
                </Text>
                {liabilityDrawerItem.principalOutstanding != null && (
                  <Text size="sm">
                    {translate("planLabLiabilityDrawerBalance", "餘額")}:{" "}
                    {formatCurrency(
                      liabilityDrawerItem.principalOutstanding ?? 0,
                      scenario.baseCurrency,
                      locale
                    )}
                  </Text>
                )}
                {liabilityDrawerItem.startMonth && (
                  <Text size="sm">
                    {translate("planLabLiabilityDrawerStartMonth", "開始月份")}:{" "}
                    {liabilityDrawerItem.startMonth}
                  </Text>
                )}
                {liabilityDrawerItem.notes && (
                  <Text size="sm">
                    {translate("planLabLiabilityDrawerNotes", "備註")}:{" "}
                    {liabilityDrawerItem.notes}
                  </Text>
                )}
              </Stack>
            ) : null}
          </Drawer>
          <Drawer
            opened={Boolean(viewScenarioItem)}
            onClose={() => setViewScenarioItem(null)}
            position="right"
            size="md"
            title={translate("planLabBaselineViewerTitle", "Baseline 檢視")}
          >
            {viewScenarioItem ? (
              <Stack gap="xs">
                <Text fw={600}>{viewScenarioItem.title}</Text>
                <Group gap={4} wrap="wrap">
                  {getScenarioItemBadges(viewScenarioItem).map((badge) => (
                    <Badge
                      key={`view-${viewScenarioItem.id}-${badge.label}`}
                      size="xs"
                      variant="light"
                      color={badge.color}
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </Group>
                {viewScenarioItem.category && (
                  <Text size="sm">
                    {translate("planLabBaselineViewerCategory", "分類")}:{" "}
                    {viewScenarioItem.category}
                  </Text>
                )}
                {getScenarioItemSummary(viewScenarioItem) && (
                  <Text size="sm" c="dimmed">
                    {getScenarioItemSummary(viewScenarioItem)}
                  </Text>
                )}
              </Stack>
            ) : null}
          </Drawer>
        </>
      )}

      <Drawer
        opened={eventDrawerOpen}
        onClose={() => {
          setEventDrawerOpen(false);
          setEventDraftGroup(null);
          setEventDraftType(null);
          setEventDraftDefinition(null);
          setEventDraftRef(null);
        }}
        position="right"
        size="lg"
        zIndex={400}
        styles={drawerStyles}
        title={
          eventDrawerMode === "edit"
            ? translate("planLabEventDrawerEditTitle", "編輯事件")
            : translate("planLabEventDrawerAddTitle", "新增事件")
        }
      >
        <Stack gap="sm">
          {eventDrawerMode === "add" && !eventDraftDefinition && (
            <Stack gap="xs">
              <Select
                label={translate("planLabEventGroupLabel", "事件類別")}
                data={eventGroupOptions}
                value={eventDraftGroup ?? ""}
                onChange={(value) => {
                  setEventDraftGroup(value ? (value as EventGroup) : null);
                  setEventDraftType(null);
                  setEventDraftDefinition(null);
                  setEventDraftRef(null);
                }}
              />
              <Select
                label={translate("planLabEventTypeLabel", "事件類型")}
                data={eventTypeOptions}
                value={eventDraftType ?? ""}
                onChange={handleEventDraftTypeChange}
                disabled={!eventDraftGroup}
              />
            </Stack>
          )}
          {eventDrawerMode === "add" && eventDraftDefinition && eventDraftType && (
            <Text size="sm" fw={600}>
              {translate("planLabEventTypeLabel", "事件類型")}：{" "}
              {getEventTypeDisplay(
                timeline,
                eventDraftType,
                eventDraftDefinition.incomeSubtype
              )}
            </Text>
          )}
          {eventDrawerMode === "edit" && eventDraftDefinition && (
            <Text size="sm" fw={600}>
              {translate("planLabEventTypeLabel", "事件類型")}：{" "}
              {getEventTypeDisplay(
                timeline,
                eventDraftDefinition.type,
                eventDraftDefinition.incomeSubtype
              )}
            </Text>
          )}
          {eventDraftTimelineEvent && eventDraftDefinition && (
            <TimelineEventForm
              event={eventDraftTimelineEvent}
              baseCurrency={scenario.baseCurrency}
              members={combinedMembers}
              assumptions={{
                baseMonth: scenario.assumptions.baseMonth,
                horizonMonths: scenario.assumptions.horizonMonths,
              }}
              ruleMode={eventDraftDefinition.rule.mode}
              schedule={eventDraftDefinition.rule.schedule}
              salarySteps={eventDraftDefinition.rule.salarySteps}
              onCancel={() => setEventDrawerOpen(false)}
              onSave={handleEventDraftSave}
              submitLabel={
                eventDrawerMode === "edit"
                  ? translate("planLabActionSave", "儲存")
                  : translate("planLabActionApply", "套用")
              }
            />
          )}
        </Stack>
      </Drawer>

      <Drawer
        opened={experimentDrawerOpen}
        onClose={() => setExperimentDrawerOpen(false)}
        position="right"
        size="md"
        zIndex={400}
        styles={drawerStyles}
        title={
          experimentDrawerMode === "add"
            ? translate("planLabExperimentDrawerAddTitle", "新增實驗")
            : translate("planLabExperimentDrawerEditTitle", "編輯實驗")
        }
      >
        <Stack gap="xs">
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
                      radius="xs"
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
                    "智能投資調整請先新增實驗，再於詳情中調整。"
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
        zIndex={400}
        styles={drawerStyles}
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
      <Modal
        opened={Boolean(experimentRenameDraft)}
        onClose={() => setExperimentRenameDraft(null)}
        title={translate("planLabExperimentRenameTitle", "重新命名實驗")}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label={translate("planLabExperimentRenameLabel", "實驗名稱")}
            value={experimentRenameDraft?.title ?? ""}
            onChange={(event) =>
              setExperimentRenameDraft((current) =>
                current ? { ...current, title: event.currentTarget.value } : current
              )
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setExperimentRenameDraft(null)}>
              {translate("planLabCancel", "取消")}
            </Button>
            <Button onClick={applyExperimentRename}>
              {translate("planLabSave", "儲存")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(pendingRemoveExperiment)}
        onClose={() => setConfirmRemoveExperimentId(null)}
        title={translate("planLabRemoveExperimentConfirmTitle", "移除實驗「{experimentTitle}」？", {
          experimentTitle: pendingRemoveExperiment
            ? (
                pendingRemoveExperiment.title ??
                experimentTypeOptions.find((option) => option.value === pendingRemoveExperiment.type)
                  ?.label ??
                translate("planLabExperimentFallback", "實驗")
              )
            : translate("planLabExperimentFallback", "實驗"),
        })}
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {translate(
              "planLabRemoveLegacyExperimentConfirmBody",
              "此操作會移除實驗，並撤銷其套用變更。"
            )}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmRemoveExperimentId(null)}>
              {translate("planLabCancel", "取消")}
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (pendingRemoveExperiment) {
                  removeExperiment(pendingRemoveExperiment.id);
                }
                setConfirmRemoveExperimentId(null);
              }}
            >
              {translate("planLabAppliedRemove", "移除")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={eventExperimentLandingOpen}
        onClose={() => {
          setEventExperimentLandingOpen(false);
          setEventExperimentLandingTarget(null);
          setEventExperimentLandingPresetAction(null);
        }}
        position={isMobile ? "bottom" : "right"}
        size={isMobile ? "100%" : "md"}
        title={translate("planLabExperimentLandingTitle", "新增實驗")}
        styles={drawerStyles}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {translate(
              "planLabExperimentLandingHint",
              "Baseline 只供查看；所有改動會先建立為實驗。"
            )}
          </Text>
          <Card withBorder radius="md" padding="sm">
            <Stack gap={4}>
              <Group gap={6}>
                <Text fw={600}>{eventExperimentLandingEvent?.label ?? eventExperimentLandingTarget?.eventId ?? "—"}</Text>
                <Badge size="xs" color={eventExperimentLandingTarget?.isChild ? "grape" : "blue"}>
                  {eventExperimentLandingTarget?.isChild ? "Child" : "Parent"}
                </Badge>
              </Group>
              {eventExperimentLandingEvent?.type === "cashflow" ? (
                <Text size="xs" c="dimmed">
                  {formatCurrency(eventExperimentLandingEvent.amount, scenario.baseCurrency, locale)} · {eventExperimentLandingEvent.startMonth ?? "--"} → {eventExperimentLandingEvent.endMonth ?? translate("planLabOpenEnded", "持續中")}
                </Text>
              ) : null}
            </Stack>
          </Card>
          <Button
            variant={eventExperimentLandingPresetAction === "edit" ? "filled" : "light"}
            onClick={() => handleEventExperimentLandingAction("edit")}
          >
            {translate("planLabExperimentLandingEdit", "修改現時揀選事件")}
          </Button>
          <Button
            variant={eventExperimentLandingPresetAction === "add_adjustment" ? "filled" : "light"}
            disabled={Boolean(eventExperimentLandingTarget?.isChild)}
            onClick={() => handleEventExperimentLandingAction("add_adjustment")}
          >
            {translate("planLabAddAdjustmentAction", "新增調整")}
          </Button>
          {eventExperimentLandingTarget?.isChild ? (
            <Text size="xs" c="orange">
              {translate("planLabChildAddAdjustmentHint", "需在 Parent 事件新增調整。")}
            </Text>
          ) : null}
          <Button
            color="red"
            variant={eventExperimentLandingPresetAction === "remove" ? "filled" : "light"}
            onClick={() => handleEventExperimentLandingAction("remove")}
          >
            {translate("planLabExperimentLandingRemove", "移除事件")}
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={eventExperimentDrawerOpen}
        onClose={() => setEventExperimentDrawerOpen(false)}
        position={isMobile ? "bottom" : "right"}
        size={isMobile ? "100%" : "md"}
        title={translate("planLabEventExperimentDrawerTitle", "事件實驗")}
        styles={drawerStyles}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {translate("planLabEventExperimentDrawerHint", "你正在新增實驗，不會改動 baseline。")}
          </Text>
          <Select
            label={translate("planLabEventExperimentTarget", "目標事件")}
            data={standaloneEventExperimentOptions}
            value={eventExperimentDraft.targetEventId}
            onChange={(value) =>
              setEventExperimentDraft((current) => {
                const selected = (baselineScenarioV2.events ?? []).find((event) => event.id === value);
                const baselineStart =
                  selected && selected.type === "cashflow"
                    ? selected.startMonth ?? scenario.assumptions.baseMonth ?? ""
                    : scenario.assumptions.baseMonth ?? "";
                const baselineEnd = selected && selected.type === "cashflow" ? selected.endMonth ?? "" : "";
                const selectedBirthMonth =
                  selected?.memberId
                    ? members.find((member) => member.id === selected.memberId)?.birthMonth
                    : undefined;
                const startAge = selectedBirthMonth ? yyyymmToAge(selectedBirthMonth, baselineStart) : null;
                const endAge = selectedBirthMonth && baselineEnd
                  ? yyyymmToAge(selectedBirthMonth, baselineEnd)
                  : null;
                return {
                  ...current,
                  targetEventId: value,
                  startMonthValue: baselineStart,
                  endMonthValue: baselineEnd,
                  startAgeYears: startAge?.years ?? 0,
                  startAgeMonths: startAge?.months ?? 0,
                  endAgeYears: endAge?.years ?? 0,
                  endAgeMonths: endAge?.months ?? 0,
                  setAmountValue:
                    selected && selected.type === "cashflow" ? selected.amount : current.setAmountValue,
                  clearEndMonth: false,
                };
              })
            }
            placeholder={translate("planLabEventExperimentTargetPlaceholder", "選擇散件事件")}
          />
          {selectedEventExperimentEvent?.source?.bundleInstanceId ? (
            <Text size="xs" c="orange">
              {translate(
                "planLabEventExperimentBundleHint",
                "此項目由人生組合生成，請用「新增組合實驗」修改。"
              )}
            </Text>
          ) : null}
          <SegmentedControl
            value={eventExperimentDraft.amountMode}
            onChange={(value) =>
              setEventExperimentDraft((current) => ({
                ...current,
                amountMode: value as "delta" | "set",
              }))
            }
            data={[
              { label: translate("planLabEventExperimentDeltaMode", "增減 Delta"), value: "delta" },
              { label: translate("planLabEventExperimentSetMode", "設定 Set"), value: "set" },
            ]}
          />
          {eventExperimentDraft.amountMode === "delta" ? (
            <>
              <SegmentedControl
                value={eventExperimentDraft.deltaUnit}
                onChange={(value) =>
                  setEventExperimentDraft((current) => ({
                    ...current,
                    deltaUnit: value as "percent" | "hkd",
                  }))
                }
                data={[
                  { label: "%", value: "percent" },
                  { label: "HKD", value: "hkd" },
                ]}
              />
              <NumberInput
                label={translate("planLabEventExperimentAmount", "金額變更")}
                value={eventExperimentDraft.amountValue}
                onChange={(value) =>
                  setEventExperimentDraft((current) => ({
                    ...current,
                    amountValue: typeof value === "number" ? value : 0,
                  }))
                }
                allowDecimal={eventExperimentDraft.deltaUnit === "percent"}
                step={eventExperimentDraft.deltaUnit === "percent" ? 1 : 500}
              />
            </>
          ) : (
            <NumberInput
              label={translate("planLabEventExperimentSetAmount", "設定為（HKD）")}
              value={eventExperimentDraft.setAmountValue ?? ""}
              onChange={(value) =>
                setEventExperimentDraft((current) => ({
                  ...current,
                  setAmountValue: typeof value === "number" ? value : null,
                }))
              }
              min={0}
              step={500}
            />
          )}
          {selectedEventExperimentEvent?.type === "cashflow" && (
            <Text size="sm" c="dimmed">
              {translate("planLabEventExperimentBaselineAmount", "基準：{base}", {
                base: formatCurrency(
                  selectedEventExperimentEvent.amount,
                  scenario.baseCurrency,
                  locale
                ),
              })}
            </Text>
          )}
          {eventExperimentPercentOnZero ? (
            <Text size="xs" c="orange">
              {translate("planLabEventExperimentZeroPercentHint", "基準金額為 0，% 變更不會產生效果。")}
            </Text>
          ) : null}
          {selectedEventExperimentEvent?.type === "cashflow" &&
            typeof eventExperimentPreviewAmount === "number" && (
              <Text size="sm" c="dimmed">
                {translate("planLabEventExperimentPreview", "預覽：{base} → {next}", {
                  base: formatCurrency(
                    selectedEventExperimentEvent.amount,
                    scenario.baseCurrency,
                    locale
                  ),
                  next: formatCurrency(eventExperimentPreviewAmount, scenario.baseCurrency, locale),
                })}
              </Text>
            )}
          <SegmentedControl
            value={eventExperimentDraft.startMonthMode}
            onChange={(value) =>
              setEventExperimentDraft((current) => ({
                ...current,
                startMonthMode: value as "offset" | "month" | "age",
              }))
            }
            data={[
              { label: translate("planLabEventExperimentOffsetMode", "提早/延後"), value: "offset" },
              { label: translate("planLabEventExperimentMonthMode", "指定月份"), value: "month" },
              { label: translate("planLabEventExperimentAgeMode", "指定歲數"), value: "age", disabled: !eventExperimentCanUseAgeMode },
            ]}
          />
          {eventExperimentDraft.startMonthMode === "offset" ? (
            <NumberInput
              label={translate("planLabEventExperimentStartShift", "開始月份（提早/延後）")}
              description={translate("planLabEventExperimentShiftDesc", "負數代表提早；正數代表延後（單位：月）")}
              value={eventExperimentDraft.startShiftMonths}
              onChange={(value) =>
                setEventExperimentDraft((current) => ({
                  ...current,
                  startShiftMonths: typeof value === "number" ? value : 0,
                }))
              }
              step={1}
            />
          ) : eventExperimentDraft.startMonthMode === "age" ? (
            <Stack gap="xs">
              <Group grow>
                <NumberInput
                  label={translate("planLabEventExperimentStartAgeYears", "開始年齡（歲）")}
                  value={eventExperimentDraft.startAgeYears}
                  min={0}
                  onChange={(value) =>
                    setEventExperimentDraft((current) => ({
                      ...current,
                      startAgeYears: typeof value === "number" ? value : 0,
                    }))
                  }
                  disabled={!eventExperimentCanUseAgeMode}
                />
                <NumberInput
                  label={translate("planLabEventExperimentStartAgeMonths", "開始年齡（月）")}
                  value={eventExperimentDraft.startAgeMonths}
                  min={0}
                  max={11}
                  onChange={(value) =>
                    setEventExperimentDraft((current) => ({
                      ...current,
                      startAgeMonths: typeof value === "number" ? Math.max(0, Math.min(11, Math.round(value))) : 0,
                    }))
                  }
                  disabled={!eventExperimentCanUseAgeMode}
                />
              </Group>
              <Text size="xs" c="dimmed">
                {translate("planLabEventExperimentAgeResult", "→ {month}（{friendly}）", {
                  month:
                    ageToYYYYMM(
                      selectedEventExperimentBirthMonth ?? "",
                      eventExperimentDraft.startAgeYears * 12 + eventExperimentDraft.startAgeMonths
                    ) ?? "—",
                  friendly: formatMonthFriendly(
                    ageToYYYYMM(
                      selectedEventExperimentBirthMonth ?? "",
                      eventExperimentDraft.startAgeYears * 12 + eventExperimentDraft.startAgeMonths
                    )
                  ) || "—",
                })}
              </Text>
            </Stack>
          ) : (
            <MonthField
              label={translate("planLabEventExperimentStartMonth", "開始月份")}
              value={eventExperimentDraft.startMonthValue}
              onChange={(value) =>
                setEventExperimentDraft((current) => ({ ...current, startMonthValue: value }))
              }
            />
          )}
          {!isMemberLinkedEvent(selectedEventExperimentEvent) ? (
            <Text size="xs" c="orange">
              {translate("planLabEventExperimentAgeNoMember", "此事件未綁定成員，不能用歲數定位。")}
            </Text>
          ) : null}
          {isMemberLinkedEvent(selectedEventExperimentEvent) && !selectedEventExperimentBirthMonth ? (
            <Text size="xs" c="orange">
              {translate("planLabEventExperimentAgeMissingBirthMonth", "要用歲數定位，請先在「成員」補充出生年月（YYYY-MM）。")}
            </Text>
          ) : null}
          <SegmentedControl
            value={eventExperimentDraft.endMonthMode}
            onChange={(value) =>
              setEventExperimentDraft((current) => ({
                ...current,
                endMonthMode: value as "offset" | "month" | "age",
              }))
            }
            data={[
              { label: translate("planLabEventExperimentOffsetMode", "提早/延後"), value: "offset" },
              { label: translate("planLabEventExperimentMonthMode", "指定月份"), value: "month" },
              { label: translate("planLabEventExperimentAgeMode", "指定歲數"), value: "age", disabled: !eventExperimentCanUseAgeMode },
            ]}
          />
          {eventExperimentDraft.endMonthMode === "offset" ? (
            <NumberInput
              label={translate("planLabEventExperimentEndShift", "結束月份（提前/延後）")}
              description={translate("planLabEventExperimentShiftDesc", "負數代表提前；正數代表延後（單位：月）")}
              value={eventExperimentDraft.endShiftMonths}
              onChange={(value) =>
                setEventExperimentDraft((current) => ({
                  ...current,
                  endShiftMonths: typeof value === "number" ? value : 0,
                }))
              }
              step={1}
            />
          ) : eventExperimentDraft.endMonthMode === "age" ? (
            <Stack gap="xs">
              <Group grow>
                <NumberInput
                  label={translate("planLabEventExperimentEndAgeYears", "結束年齡（歲）")}
                  value={eventExperimentDraft.endAgeYears}
                  min={0}
                  onChange={(value) =>
                    setEventExperimentDraft((current) => ({
                      ...current,
                      endAgeYears: typeof value === "number" ? value : 0,
                    }))
                  }
                  disabled={!eventExperimentCanUseAgeMode}
                />
                <NumberInput
                  label={translate("planLabEventExperimentEndAgeMonths", "結束年齡（月）")}
                  value={eventExperimentDraft.endAgeMonths}
                  min={0}
                  max={11}
                  onChange={(value) =>
                    setEventExperimentDraft((current) => ({
                      ...current,
                      endAgeMonths: typeof value === "number" ? Math.max(0, Math.min(11, Math.round(value))) : 0,
                    }))
                  }
                  disabled={!eventExperimentCanUseAgeMode}
                />
              </Group>
              <Text size="xs" c="dimmed">
                {translate("planLabEventExperimentAgeResult", "→ {month}（{friendly}）", {
                  month:
                    ageToYYYYMM(
                      selectedEventExperimentBirthMonth ?? "",
                      eventExperimentDraft.endAgeYears * 12 + eventExperimentDraft.endAgeMonths
                    ) ?? "—",
                  friendly: formatMonthFriendly(
                    ageToYYYYMM(
                      selectedEventExperimentBirthMonth ?? "",
                      eventExperimentDraft.endAgeYears * 12 + eventExperimentDraft.endAgeMonths
                    )
                  ) || "—",
                })}
              </Text>
            </Stack>
          ) : (
            <Stack gap="xs">
              <MonthField
                label={translate("planLabEventExperimentEndMonth", "結束月份")}
                value={eventExperimentDraft.endMonthValue}
                onChange={(value) =>
                  setEventExperimentDraft((current) => ({
                    ...current,
                    endMonthValue: value,
                    clearEndMonth: false,
                  }))
                }
                disabled={eventExperimentDraft.clearEndMonth}
              />
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  setEventExperimentDraft((current) => ({
                    ...current,
                    clearEndMonth: true,
                    endMonthValue: "",
                  }))
                }
              >
                {translate("planLabEventExperimentClearEnd", "清除結束月份")}
              </Button>
            </Stack>
          )}
          {!isMemberLinkedEvent(selectedEventExperimentEvent) ? (
            <Text size="xs" c="orange">
              {translate("planLabEventExperimentAgeNoMember", "此事件未綁定成員，不能用歲數定位。")}
            </Text>
          ) : null}
          {isMemberLinkedEvent(selectedEventExperimentEvent) && !selectedEventExperimentBirthMonth ? (
            <Text size="xs" c="orange">
              {translate("planLabEventExperimentAgeMissingBirthMonth", "要用歲數定位，請先在「成員」補充出生年月（YYYY-MM）。")}
            </Text>
          ) : null}
          {startMonthInputInvalid ? (
            <Text size="xs" c="red">
              {translate("planLabEventExperimentMonthInvalid", "請輸入有效月份（YYYY-MM）。")}
            </Text>
          ) : null}
          {endMonthInputInvalid ? (
            <Text size="xs" c="red">
              {translate("planLabEventExperimentMonthInvalid", "請輸入有效月份（YYYY-MM）。")}
            </Text>
          ) : null}
          {eventExperimentRangeInvalid ? (
            <Text size="xs" c="red">
              {translate("planLabEventExperimentRangeInvalid", "結束月份不可早於開始月份。")}
            </Text>
          ) : null}
          <Select
            label={translate("planLabEventExperimentGrowth", "成長假設")}
            data={[
              {
                value: "unchanged",
                label: translate("planLabEventExperimentGrowthUnchanged", "維持不變"),
              },
              {
                value: "assumption",
                label: translate("planLabEventExperimentGrowthAssumption", "跟隨環境假設"),
              },
              {
                value: "custom",
                label: translate("planLabEventExperimentGrowthCustom", "自訂成長率"),
              },
              {
                value: "none",
                label: translate("planLabEventExperimentGrowthNone", "不成長"),
              },
            ]}
            value={eventExperimentDraft.growthMode}
            onChange={(value) =>
              setEventExperimentDraft((current) => ({
                ...current,
                growthMode: (value as EventExperimentDraft["growthMode"]) ?? "unchanged",
              }))
            }
          />
          {eventExperimentDraft.growthMode === "custom" && (
            <NumberInput
              label={translate("planLabEventExperimentGrowthRate", "自訂成長率（%）")}
              value={eventExperimentDraft.growthRate}
              onChange={(value) =>
                setEventExperimentDraft((current) => ({
                  ...current,
                  growthRate: typeof value === "number" ? value : 0,
                }))
              }
              step={0.1}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEventExperimentDrawerOpen(false)}>
              {translate("planLabActionCancel", "取消")}
            </Button>
            <Button onClick={submitEventExperiment} disabled={!canSubmitEventExperiment}>
              {translate("planLabEventExperimentCreate", "新增實驗")}
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Modal
        opened={Boolean(pendingRemoveGroup)}
        onClose={() => setConfirmRemoveGroupId(null)}
        title={translate(
          "planLabRemoveExperimentConfirmTitle",
          "移除實驗「{experimentTitle}」？",
          { experimentTitle: resolveExperimentGroupTitle(pendingRemoveGroup?.title) }
        )}
        centered
      >
        <Stack gap="xs">
          <Text size="sm">
            {translate(
              "planLabRemoveExperimentConfirmBody",
              "此操作只會移除實驗及其 {count} 個變更，不會刪除基準事件。",
              { count: String(pendingRemoveGroupCount) }
            )}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmRemoveGroupId(null)}>
              {translate("planLabActionCancel", "取消")}
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (pendingRemoveGroup) {
                  deleteExperiment(pendingRemoveGroup.experimentId);
                }
                setConfirmRemoveGroupId(null);
              }}
            >
              {translate("planLabAppliedRemove", "移除")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
