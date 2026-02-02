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
  Notification,
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
import type { EventGroup, EventType } from "@north-star/engine";
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
  ScenarioLiability,
  ScenarioMember,
  ScenarioMemberKind,
} from "../../src/store/scenarioStore";
import {
  createBudgetRuleId,
  createMemberId,
  isScenarioV2,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import type {
  AdjustmentEvent,
  CashflowEvent,
  HousingEvent,
  InsuranceEvent,
  LoanEvent,
  ScenarioEvent,
} from "../../src/domain/scenarioV2/events";
import { normalizeMonthInput, parseMonthStrict } from "../../src/utils/month";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import { useProjectionWithLedger } from "../../src/engine/useProjectionWithLedger";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import type { TimeSeriesPoint } from "../overview/types";
import WarningsPanel from "../../components/WarningsPanel";
import { computeFirstBucket } from "../../src/domain/planLab/computeFirstBucket";
import {
  computeCashRiskScorecard,
  computeBufferThresholdFromLedger,
} from "../../src/domain/planLab/scorecard/cashRisk";
import { PlanLabCashRiskScorecard } from "../../components/PlanLabCashRiskScorecard";
import TemplatePickerDrawer from "../../components/eventTemplates/TemplatePickerDrawer";
import type { TemplateCategory, TemplateDef } from "../../src/domain/eventTemplates/types";
import { buildTimelineDefinitionFromTemplate } from "../../src/domain/eventTemplates/presets";
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
import { buildDefaultSmartInvestPolicy } from "../../src/domain/smartInvest/defaultPolicy";
import type { SmartInvestPolicy } from "../../src/domain/smartInvest/types";
import { applySmartInvestPatch } from "../../src/domain/planLab/smartInvestAdjust";
import { appliesToScenario } from "../../src/domain/applyScope";
import { buildChildBudgetRuleTemplates } from "../../src/domain/planLab/childBudgetTemplates";
import { materializePlanLabDraft } from "../../src/domain/planLab/materializePlanLabDraft";
import { getMemberAgeYears } from "../../src/domain/members/age";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";
import { PlanLibraryDrawer } from "./PlanLibraryDrawer";
import { SavePlanModal } from "./SavePlanModal";
import { PlanCompareMode } from "./PlanCompareMode";
import {
  buildPlanPatchesFromSnapshot,
  validatePlanPatches,
} from "../../src/domain/planLab/planPatches";
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
import {
  deletePlanSnapshot,
  duplicatePlanSnapshot,
  listAllPlanSnapshots,
  listPlanSnapshots,
  renamePlanSnapshot,
  savePlanSnapshot,
} from "../../src/persistence/planLibrary";
import CashflowEventDrawer, {
  type ScenarioEventDraft as CashflowEventDraft,
} from "../moneyFlow/CashflowEventDrawer";
import HousingEventDrawer, {
  type HousingEventDraft,
} from "../moneyFlow/HousingEventDrawer";
import LoanEventDrawer, { type LoanEventDraft } from "../moneyFlow/LoanEventDrawer";
import InsuranceEventDrawer, {
  type InsuranceEventDraft,
} from "../moneyFlow/InsuranceEventDrawer";


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
  startMonth?: string;
  endMonth?: string | null;
  enabled: boolean;
  changed?: boolean;
  risky?: boolean;
  amount?: number | null;
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
};

type PlanLabDraftEventAddition = {
  definition: EventDefinition;
  ref: ScenarioEventRef;
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
  const items: ScenarioEditorItem[] = [];

  (scenario.events ?? []).forEach((event) => {
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
      eventSource: changed.addedEvents.has(event.id) ? "draft" : "baseline",
      risky: event.type === "housing" || event.type === "loan",
      amount,
    });
  });

  (scenario.assets ?? []).forEach((asset) => {
    const memberName = asset.ownerMemberId
      ? memberLookup.get(asset.ownerMemberId) ?? null
      : null;
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
      changed: changed.assets.has(asset.id),
      amount: asset.currentValue ?? null,
      assetId: asset.id,
      positionKey: asset.id,
      positionKind: "asset",
      position: asset,
    });
  });

  (scenario.liabilities ?? []).forEach((liability) => {
    const memberName = liability.ownerMemberId
      ? memberLookup.get(liability.ownerMemberId) ?? null
      : null;
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
      changed: changed.liabilities.has(liability.id),
      amount: liability.principalOutstanding ?? null,
      liabilityId: liability.id,
      positionKey: liability.id,
      positionKind: "liability",
      position: liability,
    });
  });

  rules.forEach((rule) => {
    const memberName = rule.memberId ? memberLookup.get(rule.memberId) ?? null : null;
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
  const warningsT = useTranslations();
  const timeline = useTranslations("timeline");
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
  const [mode, setMode] = useState<"edit" | "compare">("edit");
  const [planLibraryOpen, setPlanLibraryOpen] = useState(false);
  const [savePlanOpen, setSavePlanOpen] = useState(false);
  const [savePlanNotes, setSavePlanNotes] = useState<string | undefined>(undefined);
  const [savePlanTags, setSavePlanTags] = useState<string[] | undefined>(undefined);
  const [planToast, setPlanToast] = useState<string | null>(null);
  const planToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planAId, setPlanAId] = useState<string | null>(null);
  const [planBId, setPlanBId] = useState<string | null>(null);
  const [planLibrary, setPlanLibrary] = useState<PlanSnapshot[]>([]);
  const [otherPlans, setOtherPlans] = useState<PlanSnapshot[]>([]);
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
  const [draftMembers, setDraftMembers] = useState<ScenarioMember[]>([]);
  const [draftBudgetRules, setDraftBudgetRules] = useState<BudgetRule[]>([]);
  const [draftEvents, setDraftEvents] = useState<PlanLabDraftEventAddition[]>([]);
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
  const [filterKind, setFilterKind] = useState<
    "all" | "positions" | "assets" | "events" | "rules"
  >("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [showRiskyOnly, setShowRiskyOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<"category" | "member" | "timeline">("category");
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
  const [v2EventDrawerOpen, setV2EventDrawerOpen] = useState(false);
  const [v2EventDrawerMode, setV2EventDrawerMode] = useState<"create" | "edit">(
    "create"
  );
  const [v2EventDrawerType, setV2EventDrawerType] =
    useState<ScenarioV2DrawerType | null>(null);
  const [editingV2EventId, setEditingV2EventId] = useState<string | null>(null);
  const [v2EventDefaultKind, setV2EventDefaultKind] =
    useState<CashflowEvent["kind"]>("income");
  const [assetDrawerItem, setAssetDrawerItem] = useState<ScenarioAsset | null>(null);
  const [liabilityDrawerItem, setLiabilityDrawerItem] =
    useState<ScenarioLiability | null>(null);

  const monthInvalidMessage = t("planLabMonthInvalid");
  const drawerStyles = useMemo(
    () => ({
      body: {
        paddingBottom:
          "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)",
      },
    }),
    []
  );

  useEffect(() => {
    const stored = localStorage.getItem("planLabActiveOnly");
    if (stored === "true") {
      setActiveOnly(true);
    }
    if (stored === "false") {
      setActiveOnly(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("planLabActiveOnly", String(activeOnly));
  }, [activeOnly]);

  useEffect(() => {
    if (!scenarioIsV2) {
      return;
    }
    if (filterKind === "positions") {
      setFilterKind("assets");
    }
  }, [filterKind, scenarioIsV2]);

  const baselineScenarioV2 = useMemo(
    () => buildScenarioV2FromScenario(scenario, eventLibrary),
    [eventLibrary, scenario]
  );
  const baselineFingerprint = useMemo(
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
  }, [scenario.id, scenarioIsV2]);

  const refreshPlanLibrary = useCallback(() => {
    let plans = listPlanSnapshots(scenario.id);
    const legacyPlans = scenario.plans ?? [];
    if (plans.length === 0 && legacyPlans.length > 0) {
      legacyPlans.forEach((plan) => {
        const legacy = plan as Plan & { sourceScenarioId?: string };
        savePlanSnapshot({
          id: plan.id,
          scenarioId: legacy.sourceScenarioId ?? scenario.id,
          name: plan.name,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          baselineFingerprint,
          payload: buildSnapshotPayload(
            baselineScenarioV2,
            baselineScenarioV2,
            budgetRules,
            budgetRules
          ),
          snapshot: plan.snapshot,
        });
      });
      plans = listPlanSnapshots(scenario.id);
    }
    setPlanLibrary(plans);
    setOtherPlans(listAllPlanSnapshots().filter((plan) => plan.scenarioId !== scenario.id));
  }, [
    baselineFingerprint,
    baselineScenarioV2,
    budgetRules,
    scenario.id,
    scenario.plans,
  ]);

  useEffect(() => {
    refreshPlanLibrary();
  }, [refreshPlanLibrary]);

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

  const openAddEventDrawer = () => {
    setTemplatePickerCategory("popular");
    setTemplatePickerOpen(true);
  };

  const openEditEventDrawer = (addition: PlanLabDraftEventAddition) => {
    setEventDrawerMode("edit");
    setEventDraftGroup(getEventMeta(addition.definition.type).group as EventGroup);
    setEventDraftType(addition.definition.type);
    setEventDraftDefinition(addition.definition);
    setEventDraftRef(addition.ref);
    setEventDrawerOpen(true);
  };

  const handleTemplateSelect = (template: TemplateDef) => {
    const definition = buildTimelineDefinitionFromTemplate(template.id, timeline, {
      baseCurrency: scenario.baseCurrency,
      baseMonth: scenario.assumptions.baseMonth,
      memberId: scenarioMembers[0]?.id,
    });
    setEventDrawerMode("add");
    setEventDraftGroup(getEventMeta(definition.type).group as EventGroup);
    setEventDraftType(definition.type);
    setEventDraftDefinition(definition);
    setEventDraftRef(createScenarioEventRef(definition.id));
    setEventDrawerOpen(true);
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
    const buildSet = (patches: PlanLabScenarioV2Patches[keyof PlanLabScenarioV2Patches]) =>
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

  const handleSaveV2Event = (draft: CashflowEventDraft) => {
    if (!scenarioIsV2) {
      return;
    }
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
      upsertScenarioV2Event(payload, draft.id ? "edit" : "create");
      closeV2EventDrawer();
      return;
    }
    const payload: CashflowEvent = {
      id: ensureScenarioV2EventId(draft.id),
      type: "cashflow",
      label: draft.label.trim() || undefined,
      kind: draft.kind,
      cadence: draft.cadence,
      amount: Number(draft.amount),
      startMonth: draft.cadence === "oneOff" ? undefined : draft.startMonth || undefined,
      endMonth: draft.cadence === "oneOff" ? undefined : draft.endMonth || undefined,
      occurrenceMonth: draft.cadence === "oneOff" ? draft.occurrenceMonth : undefined,
      everyNMonths: draft.cadence === "everyNMonths" ? Number(draft.everyNMonths) : undefined,
      memberId: draft.memberId || undefined,
      tags: draft.tags && draft.tags.length > 0 ? draft.tags : undefined,
    };
    upsertScenarioV2Event(payload, draft.id ? "edit" : "create");
    closeV2EventDrawer();
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
            }
          : undefined,
      propertyAssetId: draft.kind === "mortgage" ? draft.propertyAssetId : undefined,
      mortgageLiabilityId:
        draft.kind === "mortgage" ? draft.mortgageLiabilityId : undefined,
      memberId: draft.memberId || undefined,
    };
    upsertScenarioV2Event(payload, draft.id ? "edit" : "create");
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
    closeV2EventDrawer();
  };

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
    ]
  );

  const planSnapshot = useMemo<PlanLabSnapshot>(() => {
    const cloneSerializable = <T,>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
    return {
      baselinePatches: cloneSerializable(baselinePatches ?? {}),
      experiments: cloneSerializable(experiments ?? []),
      scorecardSettings:
        typeof firstBucketTargetAmount === "number"
          ? { firstBucketTargetAmount }
          : undefined,
    };
  }, [baselinePatches, experiments, firstBucketTargetAmount]);

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
  const sandboxScenarioV2 = useMemo(
    () =>
      scenarioIsV2
        ? applyPlanLabScenarioV2Patches(baselineScenarioV2, scenarioV2Patches)
        : buildScenarioV2FromScenario(
            sandboxMaterialized.scenario,
            sandboxEventLibrary
          ),
    [
      baselineScenarioV2,
      sandboxEventLibrary,
      sandboxMaterialized.scenario,
      scenarioIsV2,
      scenarioV2PatchesKey,
    ]
  );
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

  const legacyPlanLabProjection = usePlanLabProjectionWithLedger(
    scenarioIsV2 ? null : planLabDraft,
    scenarioIsV2 ? null : baselineScenarioSnapshot,
    eventLibrary,
    { members, budgetRules, patches: scenarioIsV2 ? [] : sandboxPatches }
  );
  const legacyBaselineProjection = usePlanLabProjectionWithLedger(
    null,
    scenarioIsV2 ? null : baselineScenarioSnapshot,
    eventLibrary,
    { members, budgetRules, patches: [] }
  );
  const v2PlanLabProjection = useProjectionWithLedger(
    scenarioIsV2 ? (sandboxScenarioV2 as unknown as Scenario) : null,
    eventLibrary,
    { members: sandboxScenarioV2.members ?? [], budgetRules: [] }
  );
  const v2BaselineProjection = useProjectionWithLedger(
    scenarioIsV2 ? (baselineScenarioV2 as unknown as Scenario) : null,
    eventLibrary,
    { members: baselineScenarioV2.members ?? [], budgetRules: [] }
  );

  const planLabProjection = scenarioIsV2 ? v2PlanLabProjection : legacyPlanLabProjection;
  const baselineProjection = scenarioIsV2 ? v2BaselineProjection : legacyBaselineProjection;

  const openV2EventDrawer = useCallback(
    (mode: "create" | "edit", type: ScenarioV2DrawerType, eventId?: string) => {
      setV2EventDrawerMode(mode);
      setV2EventDrawerType(type);
      setEditingV2EventId(eventId ?? null);
      setV2EventDrawerOpen(true);
    },
    []
  );

  const closeV2EventDrawer = useCallback(() => {
    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
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

  const scenarioItems = useMemo<ScenarioEditorItem[]>(() => {
    if (scenarioIsV2) {
      return deriveInputsFromScenarioV2({
        scenario: sandboxScenarioV2,
        members: sandboxScenarioV2.members ?? [],
        rules: sandboxBudgetRules,
        changed: scenarioV2Changed,
      });
    }
    const items: ScenarioEditorItem[] = [];
    const combinedEventLibrary = [...eventLibrary, ...draftEventDefinitions];
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
      if (filterKind === "assets") {
        if (item.kind !== "position") {
          return false;
        }
        if (item.positionKind !== "asset" && item.positionKind !== "liability") {
          return false;
        }
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
        if (scenarioIsV2) {
          if (!item.changed) {
            return false;
          }
        } else {
          if (item.kind === "event" && item.eventDefinitionId) {
            if (item.eventSource === "draft") {
              return true;
            }
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
    scenarioIsV2,
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
  }, [filteredItems, groupBy, combinedMembers, categoryLabels, scenarioIsV2]);

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

  const appliedControls = useMemo(() => {
    const controls: Array<{
      id: string;
      titleLine: string;
      diffLines: string[];
      tooltip?: string;
      isEnabled: boolean;
      onToggle?: () => void;
      onRemove: () => void;
      onEdit?: () => void;
    }> = [];

    if (scenarioIsV2) {
      scenarioV2Patches.events.add.forEach((event) => {
        controls.push({
          id: `event-add-${event.id}`,
          titleLine: event.label ?? event.id,
          diffLines: [translate("planLabAppliedAddedEvent", "新增事件")],
          isEnabled: true,
          onRemove: () => removeScenarioV2Event(event.id),
          onEdit: () => handleEditV2Event(event.id),
        });
      });
      Object.keys(scenarioV2Patches.events.update).forEach((eventId) => {
        const updated = v2EventLookup.get(eventId);
        controls.push({
          id: `event-update-${eventId}`,
          titleLine: updated?.label ?? eventId,
          diffLines: [translate("planLabAppliedUpdated", "已更新")],
          isEnabled: true,
          onRemove: () => removeScenarioV2Event(eventId),
          onEdit: () => handleEditV2Event(eventId),
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
        onEdit: () => openEditMemberDrawer(member),
      });
    });

    draftBudgetRules.forEach((rule) => {
      const diffLines = [translate("planLabAppliedAddedRule", "新增規則")];
      controls.push({
        id: `rule-add-${rule.id}`,
        titleLine: rule.name,
        diffLines,
        isEnabled: rule.enabled,
        onToggle: () =>
          setDraftBudgetRules((current) =>
            current.map((entry) =>
              entry.id === rule.id ? { ...entry, enabled: !entry.enabled } : entry
            )
          ),
        onRemove: () => removeDraftBudgetRule(rule.id),
        onEdit: () => {
          const item = scenarioItems.find((entry) => entry.ruleId === rule.id);
          if (item) {
            openEditingItem(item);
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
        onEdit: () => openEditEventDrawer(event),
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
        onToggle: () => updateEventPatch(refId, { isDisabled: !nextEnabled }),
        onRemove: () => removePatch("event", refId),
        onEdit: item ? () => openEditingItem(item) : undefined,
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
        onToggle: () => updateRulePatch(ruleId, { isDisabled: !nextEnabled }),
        onRemove: () => removePatch("rule", ruleId),
        onEdit: item ? () => openEditingItem(item) : undefined,
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
        onToggle: () => updatePositionPatch(key, { isDisabled: !patch.isDisabled }),
        onRemove: () => removePatch("position", key),
        onEdit: item ? () => openEditingItem(item) : undefined,
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
        onToggle: () =>
          updateSmartInvestPatch({ isDisabled: patchedPolicy.enabled }),
        onRemove: () => removePatch("position", "smartInvest"),
        onEdit: () => {
          const item = scenarioItems.find(
            (entry) => entry.positionKind === "smartInvest"
          );
          if (item) {
            openEditingItem(item);
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
        onEdit: () => openEditExperimentDrawer(experiment),
      });
    });

    return controls;
  }, [
    baselineSmartInvestPolicy,
    buildDiffLine,
    draftBudgetRules,
    draftEvents,
    draftMembers,
    eventPatches,
    experiments,
    formatEnabledLabel,
    formatSmartInvestContributionLabel,
    formatSmartInvestReserveLabel,
    getScenarioItemSummary,
    locale,
    openEditExperimentDrawer,
    openEditEventDrawer,
    handleEditV2Event,
    openEditMemberDrawer,
    openEditingItem,
    positionPatches,
    removeDraftBudgetRule,
    removeDraftMember,
    removeScenarioV2Event,
    removeExperiment,
    rulePatches,
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
    translate,
    v2EventLookup,
    updateEventPatch,
    updatePositionPatch,
    updateRulePatch,
    updateSmartInvestPatch,
    experimentTypeOptions,
  ]);

  const handleResetAllControls = () => {
    setBaselinePatches({
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
      smartInvestPatch: undefined,
    });
    setScenarioV2Patches(emptyPlanLabScenarioV2Patches());
    setExperiments([]);
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
  };

  const handleLoadPlanSnapshot = (plan: PlanSnapshot) => {
    if (plan.scenarioId !== scenario.id) {
      setPlanToast(
        translate(
          "planLabPlanScenarioMismatchToast",
          "This plan belongs to another scenario and cannot be loaded here."
        )
      );
      return;
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
    setFirstBucketTargetAmount(
      typeof snapshot.scorecardSettings?.firstBucketTargetAmount === "number"
        ? snapshot.scorecardSettings.firstBucketTargetAmount
        : ""
    );
    setDraftMembers([]);
    setDraftBudgetRules([]);
    setDraftEvents([]);
    setActivePlanId(plan.id);
    setMode("edit");
  };

  const handleSavePlan = (values: { name: string; notes?: string; tags?: string[] }) => {
    const timestamp = Date.now();
    const snapshot = JSON.parse(JSON.stringify(planSnapshot)) as PlanLabSnapshot;
    const nextPlan: PlanSnapshot = {
      id: nanoid(),
      scenarioId: scenario.id,
      name: values.name,
      notes: values.notes,
      tags: values.tags,
      createdAt: timestamp,
      updatedAt: timestamp,
      baselineFingerprint,
      payload: snapshotPayload,
      snapshot,
    };
    savePlanSnapshot(nextPlan);
    refreshPlanLibrary();
    setActivePlanId(nextPlan.id);
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
    savePlanSnapshot({
      ...existing,
      notes: savePlanNotes ?? existing.notes,
      tags: savePlanTags ?? existing.tags,
      updatedAt: timestamp,
      baselineFingerprint,
      payload: snapshotPayload,
      snapshot,
    });
    refreshPlanLibrary();
    setPlanToast(translate("planLabPlanUpdatedToast", "Plan updated."));
  };

  const handleDuplicatePlan = (plan: Plan) => {
    duplicatePlanSnapshot(plan);
    refreshPlanLibrary();
    setPlanToast(translate("planLabPlanDuplicatedToast", "Plan duplicated."));
  };

  const handleDeletePlan = (plan: Plan) => {
    deletePlanSnapshot(plan.scenarioId, plan.id);
    refreshPlanLibrary();
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
    renamePlanSnapshot(plan.scenarioId, plan.id, name);
    refreshPlanLibrary();
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
    <Stack gap="lg">
      {planToast && (
        <Notification color="teal" onClose={() => setPlanToast(null)}>
          {planToast}
        </Notification>
      )}
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
          <Group gap="xs" wrap="wrap">
            <SegmentedControl
              size="xs"
              data={[
                {
                  value: "edit",
                  label: translate("planLabModeEdit", "Edit"),
                },
                {
                  value: "compare",
                  label: translate("planLabModeCompare", "Compare"),
                },
              ]}
              value={mode}
              onChange={(value) => setMode(value as "edit" | "compare")}
            />
            {mode === "edit" && (
              <Button
                size="sm"
                variant="light"
                onClick={() => {
                  setSavePlanNotes(undefined);
                  setSavePlanTags(undefined);
                  setSavePlanOpen(true);
                }}
              >
                {translate("planLabSavePlan", "Save plan")}
              </Button>
            )}
            {mode === "edit" && (
              <Button
                size="sm"
                variant="light"
                onClick={handleUpdatePlan}
                disabled={!activePlanId}
              >
                {translate("planLabUpdatePlan", "Update plan")}
              </Button>
            )}
            <Button size="sm" variant="light" onClick={() => setPlanLibraryOpen(true)}>
              {translate("planLabPlansButton", "Plans ({count})", {
                count: planCount,
              })}
            </Button>
            {mode === "edit" && (
              <Button size="sm" variant="light" onClick={handleSave}>
                {t("planLabSave")}
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="md" padding="sm">
        <Text size="sm">{t("planLabSandboxBanner")}</Text>
      </Card>

      {mode === "edit" ? (
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
                    data={
                      scenarioIsV2
                        ? [
                            {
                              value: "all",
                              label: translate("planLabFilterAllLabel", "全部"),
                            },
                            {
                              value: "assets",
                              label: translate("planLabFilterPositionsLabel", "資產"),
                            },
                            {
                              value: "events",
                              label: translate("planLabFilterEventsLabel", "事件"),
                            },
                            { value: "rules", label: translate("planLabFilterRulesLabel", "規則") },
                          ]
                        : [
                            {
                              value: "all",
                              label: translate("planLabFilterAllLabel", "全部"),
                            },
                            {
                              value: "positions",
                              label: translate("planLabFilterPositionsLabel", "資產"),
                            },
                            {
                              value: "events",
                              label: translate("planLabFilterEventsLabel", "事件"),
                            },
                            { value: "rules", label: translate("planLabFilterRulesLabel", "規則") },
                          ]
                    }
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
                              if (scenarioIsV2) {
                                if (item.kind === "event" && item.eventId) {
                                  menuItems.push({
                                    label: translate("planLabAppliedRemove", "移除"),
                                    onClick: () => removeScenarioV2Event(item.eventId ?? item.id),
                                  });
                                }
                              } else {
                                if (
                                  (item.kind === "event" && item.eventSource !== "draft") ||
                                  item.kind === "rule"
                                ) {
                                  menuItems.push({
                                    label: translate("planLabActionEnd", "設定結束月份"),
                                    onClick: () => openEditingItem(item, "validity"),
                                  });
                                }
                                if (item.kind === "event" && item.eventSource === "draft") {
                                  menuItems.push({
                                    label: translate("planLabAppliedRemove", "移除"),
                                    onClick: () =>
                                      setDraftEvents((current) =>
                                        current.filter(
                                          (event) =>
                                            event.definition.id !== item.eventDefinitionId
                                        )
                                      ),
                                  });
                                }
                                if (item.kind === "rule" && item.ruleSource === "draft") {
                                  menuItems.push({
                                    label: translate("planLabAppliedRemove", "移除"),
                                    onClick: () => removeDraftBudgetRule(item.ruleId ?? item.id),
                                  });
                                }
                              }
                              return (
                                <PlanLabAccordionRow
                                  key={item.id}
                                  id={item.id}
                                  title={item.title}
                                  badges={getScenarioItemBadges(item)}
                                  summary={getScenarioItemSummary(item)}
                                  enabled={item.enabled}
                                  onToggle={
                                    scenarioIsV2
                                      ? undefined
                                      : () => {
                                          if (item.kind === "event" && item.eventDefinitionId) {
                                            if (item.eventSource === "draft") {
                                              setDraftEvents((current) =>
                                                current.map((event) =>
                                                  event.definition.id === item.eventDefinitionId
                                                    ? {
                                                        ...event,
                                                        ref: {
                                                          ...event.ref,
                                                          enabled: !event.ref.enabled,
                                                        },
                                                      }
                                                    : event
                                                )
                                              );
                                            } else {
                                              updateEventPatch(item.eventDefinitionId, {
                                                isDisabled: item.enabled,
                                              });
                                            }
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
                                        }
                                  }
                                  onEdit={() => {
                                    if (scenarioIsV2) {
                                      if (item.kind === "event" && item.eventId) {
                                        handleEditV2Event(item.eventId);
                                      }
                                      if (item.positionKind === "asset") {
                                        setAssetDrawerItem(item.position ?? null);
                                      }
                                      if (item.positionKind === "liability") {
                                        setLiabilityDrawerItem(item.position ?? null);
                                      }
                                      return;
                                    }
                                    if (item.kind === "event" && item.eventSource === "draft") {
                                      const addition = draftEvents.find(
                                        (event) =>
                                          event.definition.id === item.eventDefinitionId
                                      );
                                      if (addition) {
                                        openEditEventDrawer(addition);
                                      }
                                      return;
                                    }
                                    openEditingItem(item);
                                  }}
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
                  <Group gap="xs" wrap="wrap">
                    {!scenarioIsV2 && (
                      <Button size="xs" variant="light" onClick={openAddMemberDrawer}>
                        {translate("planLabAddMemberAction", "新增成員")}
                      </Button>
                    )}
                    {!scenarioIsV2 && (
                      <Button size="xs" variant="light" onClick={() => openAddRuleDrawer()}>
                        {translate("planLabAddRuleAction", "新增規則")}
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="light"
                      onClick={
                        scenarioIsV2
                          ? () => {
                              setV2EventDefaultKind("income");
                              openV2EventDrawer("create", "cashflow");
                            }
                          : openAddEventDrawer
                      }
                    >
                      {translate("planLabAddEventAction", "新增事件")}
                    </Button>
                    {!scenarioIsV2 && (
                      <Button size="xs" onClick={openAddExperimentDrawer}>
                        {translate("planLabExperimentsAddAction", "新增實驗")}
                      </Button>
                    )}
                  </Group>
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
                  <ScrollArea.Autosize mah={240} offsetScrollbars>
                    <Stack gap="xs">
                      {appliedControls.map((control) => {
                        const content = (
                          <Paper key={control.id} withBorder radius="md" p="xs">
                            <Group
                              justify="space-between"
                              align="flex-start"
                              wrap="nowrap"
                            >
                              <Stack gap={4} style={{ flex: 1 }}>
                                <Text size="sm" fw={600}>
                                  {control.titleLine}
                                </Text>
                                {control.diffLines.map((line, index) => (
                                  <Text key={`${control.id}-diff-${index}`} size="xs" c="dimmed">
                                    {line}
                                  </Text>
                                ))}
                              </Stack>
                              <Group gap="xs" wrap="nowrap">
                                {control.onToggle && (
                                  <Switch
                                    size="xs"
                                    checked={control.isEnabled}
                                    onChange={() => control.onToggle?.()}
                                  />
                                )}
                                {control.onEdit && (
                                  <Button
                                    size="xs"
                                    variant="subtle"
                                    onClick={() => control.onEdit?.()}
                                  >
                                    {translate("planLabAppliedEdit", "編輯")}
                                  </Button>
                                )}
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => control.onRemove()}
                                >
                                  <Text size="xs">×</Text>
                                </ActionIcon>
                              </Group>
                            </Group>
                          </Paper>
                        );
                        if (control.tooltip) {
                          return (
                            <MantineTooltip key={control.id} label={control.tooltip} withArrow>
                              {content}
                            </MantineTooltip>
                          );
                        }
                        return content;
                      })}
                    </Stack>
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
      ) : (
        <PlanCompareMode
          scenario={scenario}
          plans={plans}
          planAId={planAId}
          planBId={planBId}
          onPlanAChange={setPlanAId}
          onPlanBChange={setPlanBId}
          onSwapPlans={() => {
            setPlanAId(planBId);
            setPlanBId(planAId);
          }}
        onLoadPlan={(plan) => handleLoadPlanSnapshot(plan)}
        baselineFingerprint={baselineFingerprint}
        displayMode={displayMode}
        deflateSeries={deflateSeries}
        locale={locale}
          eventLibrary={eventLibrary}
          members={members}
          budgetRules={budgetRules}
          translate={translate}
        />
      )}

      <PlanLibraryDrawer
        opened={planLibraryOpen}
        onClose={() => setPlanLibraryOpen(false)}
        scenario={scenario}
        baselineFingerprint={baselineFingerprint}
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

      <TemplatePickerDrawer
        opened={templatePickerOpen}
        defaultCategory={templatePickerCategory}
        filterTemplates={(template) => !template.isBundle}
        onClose={() => setTemplatePickerOpen(false)}
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
            members={sandboxScenarioV2.members ?? []}
            event={v2EventDrawerMode === "edit" ? editingCashflowEvent : null}
            defaultKind={v2EventDefaultKind}
            onClose={closeV2EventDrawer}
            onSave={handleSaveV2Event}
          />
          <HousingEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "housing"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingHousingEvent : null}
            onClose={closeV2EventDrawer}
            onSave={handleSaveHousingEvent}
          />
          <LoanEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "loan"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingLoanEvent : null}
            onClose={closeV2EventDrawer}
            onSave={handleSaveLoanEvent}
          />
          <InsuranceEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "insurance"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingInsuranceEvent : null}
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
    </Stack>
  );
}
