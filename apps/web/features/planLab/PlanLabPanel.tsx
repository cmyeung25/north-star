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
  Paper,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip as MantineTooltip,
} from "@mantine/core";
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
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { monthIndex, type EventGroup, type EventType } from "@north-star/engine";
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
  ScenarioEventDraft as ScenarioV2EventDraft,
} from "../../src/domain/scenarioV2/events";
import { ScenarioEventSchema } from "../../src/domain/scenarioV2/events";
import { normalizeMonthInput, parseMonthStrict } from "../../src/utils/month";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import {
  computeProjectionWithSmartInvest,
  useProjectionWithLedger,
} from "../../src/engine/useProjectionWithLedger";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import type { TimeSeriesPoint } from "../overview/types";
import WarningsPanel from "../../components/WarningsPanel";
import { computePlanLabKpis, diffPlanLabKpis } from "../../src/domain/planLab/kpis";
import {
  computeCashRiskScorecard,
  computeBufferThresholdFromLedger,
} from "../../src/domain/planLab/scorecard/cashRisk";
import { PlanLabCashRiskScorecard } from "../../components/PlanLabCashRiskScorecard";
import TemplatePickerDrawer from "../../components/eventTemplates/TemplatePickerDrawer";
import type { TemplateCategory, TemplateDef } from "../../src/domain/eventTemplates/types";
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
import {
  deletePlanSnapshot,
  duplicatePlanSnapshot,
  listAllPlanSnapshots,
  listPlanSnapshots,
  renamePlanSnapshot,
  savePlanSnapshot,
} from "../../src/persistence/planLibrary";
import CashflowEventDrawer, {
  type CashflowEventDraft,
  type ScenarioEventDraft as PlanLabScenarioEventDraft,
} from "../moneyFlow/CashflowEventDrawer";
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
  filterScenarioV2PatchesByExperimentGroups,
  resolveExperimentGroupTitle,
  resolveSingleItemExperimentTitle,
  type PlanLabExperimentGroup,
} from "./experimentGroups";


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
type PlanLabDriverSource = "event" | "rule" | "position" | "experiment";

type PlanLabTopDriver = {
  id: string;
  itemId: string;
  source: PlanLabDriverSource;
  title: string;
  contribution: number;
};

type PlanLabChangedDriverCandidate = {
  id: string;
  source: PlanLabDriverSource;
  title: string;
};

const MAX_TOP_DRIVER_CANDIDATES = 8;
const TOP_DRIVER_COUNT = 5;
const TOP_DRIVER_DEBOUNCE_MS = 300;


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
  enabled?: boolean;
  highlighted?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  primaryAction?: PlanLabRowAction;
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
      enabled,
      highlighted,
      onToggle,
      onEdit,
      primaryAction,
      menuItems,
      panel,
    },
    ref
  ) {
    return (
      <Box
        ref={ref}
        style={{
          borderRadius: 12,
          outline: highlighted ? "2px solid rgba(18, 184, 134, 0.7)" : "none",
          outlineOffset: 2,
        }}
      >
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
      </Box>
    );
  })
);

PlanLabAccordionRow.displayName = "PlanLabAccordionRow";

const useDebouncedValue = <T,>(value: T, delayMs = 200) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
};
const hashString = (input: string) => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const buildTopDriverCacheKey = (signature: string, candidateId: string) =>
  `${signature}:${candidateId}:minCash`;

const normalizeTopDrivers = (drivers: PlanLabTopDriver[]) =>
  drivers
    .map((driver) => ({
      ...driver,
      contribution: Number(driver.contribution.toFixed(2)),
    }))
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, TOP_DRIVER_COUNT);

const areTopDriversEqual = (
  left: PlanLabTopDriver[],
  right: PlanLabTopDriver[]
) => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((driver, index) => {
    const candidate = right[index];
    if (!candidate) {
      return false;
    }
    return (
      driver.id === candidate.id &&
      driver.itemId === candidate.itemId &&
      driver.title === candidate.title &&
      driver.source === candidate.source &&
      driver.contribution === candidate.contribution
    );
  });
};


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
  const [mode, setMode] = useState<"edit" | "compare">(initialMode ?? "edit");
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
  const [experimentGroups, setExperimentGroups] = useState<PlanLabExperimentGroup[]>([]);
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
  const [listTab, setListTab] = useState<"changed" | "all" | "risky">("changed");
  const [filterKind, setFilterKind] = useState<
    "all" | "positions" | "assets" | "events" | "rules"
  >("all");
  const [activeOnly, setActiveOnly] = useState(false);
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
  const [confirmRemoveGroupId, setConfirmRemoveGroupId] = useState<string | null>(null);
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
  const [assetDrawerItem, setAssetDrawerItem] = useState<ScenarioAsset | null>(null);
  const [liabilityDrawerItem, setLiabilityDrawerItem] =
    useState<ScenarioLiability | null>(null);

  const monthInvalidMessage = t("planLabMonthInvalid");
  const showChangedOnly = listTab === "changed";
  const showRiskyOnly = listTab === "risky";
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [topDriversLoading, setTopDriversLoading] = useState(false);
  const [topDrivers, setTopDrivers] = useState<PlanLabTopDriver[]>([]);
  const attributionGenerationRef = useRef(0);
  const attributionCacheRef = useRef(new Map<string, number>());

  const registerItemRef = useCallback((id: string, node: HTMLDivElement | null) => {
    itemRefs.current.set(id, node);
  }, []);

  const handleLocateItem = useCallback((id: string) => {
    setListTab((current) => (current === "changed" ? current : "changed"));
    const node = itemRefs.current.get(id);
    if (!node) {
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedItemId((current) => (current === id ? current : id));
  }, []);

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
  }, [scenario.id, scenarioIsV2]);

  const refreshPlanLibrary = useCallback(() => {
    let plans = listPlanSnapshots(scenario.id);
    const legacyPlans = scenario.plans ?? [];
    if (plans.length === 0 && legacyPlans.length > 0) {
      legacyPlans.forEach((plan) => {
        const legacy = plan as Plan & { sourceScenarioId?: string };
        savePlanSnapshot({
          id: plan.id,
          baselineScenarioId: legacy.sourceScenarioId ?? scenario.id,
          name: plan.name,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          baselineSignature,
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
    setOtherPlans(listAllPlanSnapshots().filter((plan) => plan.baselineScenarioId !== scenario.id));
  }, [
    baselineSignature,
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
  const statusPillLabel = useMemo(() => {
    if (mode === "compare") {
      return translate("planLabStatusCompare", "比較模式");
    }
    if (activePlanId) {
      return translate("planLabStatusLoaded", "已載入方案");
    }
    return translate("planLabStatusDraft", "沙盒草稿");
  }, [activePlanId, mode, translate]);

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

  const toggleExperimentGroup = useCallback((experimentId: string) => {
    setExperimentGroups((current) =>
      current.map((group) =>
        group.experimentId === experimentId
          ? { ...group, isEnabled: !group.isEnabled }
          : group
      )
    );
  }, []);

  const deleteExperimentGroup = useCallback((experimentId: string) => {
    setExperimentGroups((current) =>
      current.filter((group) => group.experimentId !== experimentId)
    );
  }, []);

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
    setTemplatePickerIntent(null);
    setTemplatePickerItemCategory(null);
    setTemplatePlanUnsupportedNotice(null);
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
    if (template.isBundle) {
      setTemplatePlanUnsupportedNotice(null);
      setBundleTemplate(template);
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

  const createExperimentGroup = useCallback((title: string, itemIds: string[]) => {
    if (itemIds.length === 0) {
      return;
    }
    setExperimentGroups((current) => [
      ...current,
      {
        experimentId: `exp_group_${nanoid(8)}`,
        title: resolveExperimentGroupTitle(title),
        isEnabled: true,
        itemIds,
        createdAt: Date.now(),
      },
    ]);
  }, []);

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
      options?: { packAsExperiment?: boolean; experimentTitle?: string }
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

      const nextPatches: PlanLabScenarioV2Patches = {
        ...scenarioV2Patches,
        events: {
          add: [...scenarioV2Patches.events.add, ...parsedEvents],
          update: scenarioV2Patches.events.update,
          remove: scenarioV2Patches.events.remove.filter(
            (id) => !parsedEvents.some((event) => event.id === id)
          ),
        },
      };
      setScenarioV2Patches(nextPatches);
      const nextIds = collectPatchItemIds(nextPatches);
      const newItemIds = nextIds.filter((itemId) => !prevIds.has(itemId));

      const shouldPack = options?.packAsExperiment !== false;
      const experimentTitle =
        options?.experimentTitle?.trim() ||
        translate("planLabBundleExperimentFallback", "人生事件組合");

      if (shouldPack) {
        createExperimentGroup(experimentTitle, newItemIds);
      } else {
        setBundleExperimentCta({
          source: "bundle",
          title: experimentTitle,
          itemCount: newItemIds.length,
          itemIds: newItemIds,
        });
      }

      setPlanToast(
        translate(
          "planLabBundleAppliedToast",
          "已新增「{title}」（{count}項）",
          {
            title: experimentTitle,
            count: String(newItemIds.length),
          }
        )
      );

      const firstEventId = parsedEvents[0]?.id;
      setBundleWizardOpen(false);
      setBundleTemplate(null);
      if (firstEventId) {
        handleLocateItem(`event:${firstEventId}`);
      }
      return { ok: true };
    },
    [
      createExperimentGroup,
      handleLocateItem,
      scenarioIsV2,
      scenarioV2Patches,
      translate,
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

  const hasScenarioV2Edits = useMemo(() => {
    const patchSets = [
      scenarioV2Patches.events,
      scenarioV2Patches.assets,
      scenarioV2Patches.liabilities,
      scenarioV2Patches.members,
      scenarioV2Patches.rules,
    ];
    return patchSets.some(
      (patch) =>
        patch.add.length > 0 ||
        patch.remove.length > 0 ||
        Object.keys(patch.update).length > 0
    );
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
      showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
      closeV2EventDrawer();
      handleLocateItem(`event:${payload.id}`);
      return;
    }

    const payload: CashflowEvent = {
      id: createdEventId,
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
    upsertScenarioV2Event(payload, "create");
    showSingleItemPackPrompt(`events:${payload.id}`, payload.label);
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
  const debouncedPlanLabDraft = useDebouncedValue(planLabDraft, 200);

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
  const experimentGroupsKey = useMemo(
    () => JSON.stringify(experimentGroups),
    [experimentGroups]
  );
  const projectionScenarioV2Patches = useMemo(
    () => filterScenarioV2PatchesByExperimentGroups(scenarioV2Patches, experimentGroups),
    [experimentGroupsKey, scenarioV2PatchesKey]
  );
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
    createExperimentGroup(
      translate("planLabUngroupedExperimentTitle", "已新增項目"),
      ungroupedPatchItemIds
    );
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
  const pendingRemoveGroup = useMemo(
    () =>
      confirmRemoveGroupId
        ? experimentGroups.find((group) => group.experimentId === confirmRemoveGroupId) ?? null
        : null,
    [confirmRemoveGroupId, experimentGroupsKey]
  );
  const pendingRemoveGroupCount = pendingRemoveGroup?.itemIds?.length ?? 0;
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

  const legacyPlanLabProjection = usePlanLabProjectionWithLedger(
    scenarioIsV2 ? null : debouncedPlanLabDraft,
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
    scenarioIsV2 ? (debouncedSandboxScenarioV2 as unknown as Scenario) : null,
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
    setTemplateCashflowDraft(null);
    setTemplateHousingDraft(null);
    setTemplateLoanDraft(null);
    setTemplateInsuranceDraft(null);
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

  const getScenarioItemBadges = useCallback(
    (item: ScenarioEditorItem): PlanLabRowBadge[] => {
      const badges: PlanLabRowBadge[] = [];
      const changeBadge = getScenarioItemChangeBadge(item);
      if (changeBadge) {
        badges.push(changeBadge);
      }
      const categoryLabel = categoryLabels[item.category] ?? item.category;
      if (categoryLabel) {
        badges.push({ label: categoryLabel });
      }
      if (item.memberName) {
        badges.push({ label: item.memberName, color: "gray" });
      }
      if (item.endMonth) {
        badges.push({ label: translate("planLabBadgeEnded", "已結束"), color: "yellow" });
      }
      return badges;
    },
    [categoryLabels, getScenarioItemChangeBadge, translate]
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
      if (showChangedOnly && !getScenarioItemChangeStatus(item)) {
        return false;
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
    filterKind,
    getScenarioItemChangeStatus,
    scenarioIsV2,
    scenarioItems,
    searchQuery,
    showChangedOnly,
    showRiskyOnly,
  ]);

  const groupedItems = useMemo(() => {
    const prioritizeChanges = listTab === "all";
    const groups = new Map<string, ScenarioEditorItem[]>();
    filteredItems.forEach((item) => {
      const groupKey = getGroupLabel(groupBy, item);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, items]) => {
        const sortedItems = [...items].sort((left, right) => {
          if (prioritizeChanges) {
            const leftChanged = Boolean(getScenarioItemChangeStatus(left));
            const rightChanged = Boolean(getScenarioItemChangeStatus(right));
            if (leftChanged !== rightChanged) {
              return leftChanged ? -1 : 1;
            }
          }
          return left.title.localeCompare(right.title);
        });
        return [group, sortedItems] as [string, ScenarioEditorItem[]];
      });
  }, [
    filteredItems,
    getScenarioItemChangeStatus,
    groupBy,
    listTab,
    combinedMembers,
    categoryLabels,
    scenarioIsV2,
  ]);

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
  const baselineKpis = useMemo(
    () => computePlanLabKpis(baselineProjection.projection, firstBucketTargetValue),
    [baselineProjection.projection, firstBucketTargetValue]
  );
  const optionKpis = useMemo(
    () => computePlanLabKpis(planLabProjection.projection, firstBucketTargetValue),
    [firstBucketTargetValue, planLabProjection.projection]
  );

  const changedDriverCandidates = useMemo<PlanLabChangedDriverCandidate[]>(() => {
    const changedItems = scenarioItems.filter(
      (item) => getScenarioItemChangeStatus(item) !== null
    );
    const mapped = changedItems.map((item) => {
      const source: PlanLabDriverSource =
        item.kind === "event"
          ? "event"
          : item.kind === "rule"
          ? "rule"
          : item.kind === "position"
          ? "position"
          : "experiment";
      return {
        id: item.id,
        source,
        title: item.title,
      };
    });
    return mapped.slice(0, MAX_TOP_DRIVER_CANDIDATES);
  }, [getScenarioItemChangeStatus, scenarioItems]);

  const changedDriverIds = useMemo(
    () => changedDriverCandidates.map((candidate) => candidate.id),
    [changedDriverCandidates]
  );

  const topDriverOverlaySignature = useMemo(() => {
    if (scenarioIsV2) {
      return hashString(
        [
          "v2",
          scenario.id,
          snapshotPayload.eventsPatch.add.map((event) => event.id).sort().join("|"),
          snapshotPayload.eventsPatch.update.map((entry) => entry.id).sort().join("|"),
          snapshotPayload.eventsPatch.remove.slice().sort().join("|"),
          (snapshotPayload.rulesPatch?.add ?? []).map((rule) => rule.id).sort().join("|"),
          (snapshotPayload.rulesPatch?.update ?? []).map((entry) => entry.id).sort().join("|"),
          (snapshotPayload.rulesPatch?.remove ?? []).slice().sort().join("|"),
          changedDriverIds.join("|"),
        ].join("::")
      );
    }
    return hashString(
      [
        "legacy",
        scenario.id,
        sandboxPatches.length,
        changedDriverIds.join("|"),
      ].join("::")
    );
  }, [
    changedDriverIds,
    sandboxPatches.length,
    scenario.id,
    scenarioIsV2,
    snapshotPayload.eventsPatch.add,
    snapshotPayload.eventsPatch.remove,
    snapshotPayload.eventsPatch.update,
    snapshotPayload.rulesPatch?.add,
    snapshotPayload.rulesPatch?.remove,
    snapshotPayload.rulesPatch?.update,
  ]);

  useEffect(() => {
    const baseMinCash = baselineKpis?.minCash?.value;
    const currentMinCash = optionKpis?.minCash?.value;
    if (
      !planLabProjection.projection ||
      typeof baseMinCash !== "number" ||
      typeof currentMinCash !== "number" ||
      changedDriverCandidates.length === 0
    ) {
      setTopDrivers((current) => (current.length === 0 ? current : []));
      setTopDriversLoading(false);
      return;
    }

    const generation = attributionGenerationRef.current + 1;
    attributionGenerationRef.current = generation;
    setTopDriversLoading(true);

    const timeout = setTimeout(() => {
      const nextDrivers: PlanLabTopDriver[] = [];
      const currentDelta = currentMinCash - baseMinCash;

      changedDriverCandidates.forEach((candidate) => {
        const cacheKey = buildTopDriverCacheKey(topDriverOverlaySignature, candidate.id);
        const cached = attributionCacheRef.current.get(cacheKey);
        if (typeof cached === "number") {
          nextDrivers.push({
            id: candidate.id,
            itemId: candidate.id,
            source: candidate.source,
            title: candidate.title,
            contribution: cached,
          });
          return;
        }

        let variantMinCash: number | null = null;

        if (scenarioIsV2) {
          const nextPatches: PlanLabScenarioV2Patches = {
            events: {
              add: [...scenarioV2Patches.events.add],
              update: { ...scenarioV2Patches.events.update },
              remove: [...scenarioV2Patches.events.remove],
            },
            assets: {
              add: [...scenarioV2Patches.assets.add],
              update: { ...scenarioV2Patches.assets.update },
              remove: [...scenarioV2Patches.assets.remove],
            },
            liabilities: {
              add: [...scenarioV2Patches.liabilities.add],
              update: { ...scenarioV2Patches.liabilities.update },
              remove: [...scenarioV2Patches.liabilities.remove],
            },
            members: {
              add: [...scenarioV2Patches.members.add],
              update: { ...scenarioV2Patches.members.update },
              remove: [...scenarioV2Patches.members.remove],
            },
            rules: {
              add: [...scenarioV2Patches.rules.add],
              update: { ...scenarioV2Patches.rules.update },
              remove: [...scenarioV2Patches.rules.remove],
            },
          };

          const [kind, rawId] = candidate.id.split(":");
          if (kind === "event") {
            nextPatches.events.add = nextPatches.events.add.filter((item) => item.id !== rawId);
            delete nextPatches.events.update[rawId];
            nextPatches.events.remove = nextPatches.events.remove.filter((id) => id !== rawId);
          }
          if (kind === "rule") {
            nextPatches.rules.add = nextPatches.rules.add.filter((item) => item.id !== rawId);
            delete nextPatches.rules.update[rawId];
            nextPatches.rules.remove = nextPatches.rules.remove.filter((id) => id !== rawId);
          }
          if (kind === "asset") {
              const id = rawId;
              nextPatches.assets.add = nextPatches.assets.add.filter((item) => item.id !== id);
              delete nextPatches.assets.update[id];
              nextPatches.assets.remove = nextPatches.assets.remove.filter((entry) => entry !== id);
            }
            if (kind === "liability") {
              const id = rawId;
              nextPatches.liabilities.add = nextPatches.liabilities.add.filter((item) => item.id !== id);
              delete nextPatches.liabilities.update[id];
              nextPatches.liabilities.remove = nextPatches.liabilities.remove.filter((entry) => entry !== id);
          }

          const variantScenarioV2 = applyPlanLabScenarioV2Patches(
            baselineScenarioV2,
            nextPatches
          );
          const variantProjection = computeProjectionWithSmartInvest(
            variantScenarioV2 as unknown as Scenario,
            eventLibrary,
            {
              members: variantScenarioV2.members ?? [],
              budgetRules: [],
            }
          ).projection;
          variantMinCash = computePlanLabKpis(
            variantProjection,
            firstBucketTargetValue
          )?.minCash?.value ?? null;
        } else {
          const variantSnapshot: PlanLabSnapshot = {
            baselinePatches: {
              eventPatches: { ...(planSnapshot.baselinePatches?.eventPatches ?? {}) },
              rulePatches: { ...(planSnapshot.baselinePatches?.rulePatches ?? {}) },
              positionPatches: { ...(planSnapshot.baselinePatches?.positionPatches ?? {}) },
              smartInvestPatch: planSnapshot.baselinePatches?.smartInvestPatch,
            },
            experiments: [...(planSnapshot.experiments ?? [])],
            scorecardSettings: planSnapshot.scorecardSettings,
          };

          const [kind, rawId] = candidate.id.split(":");
          if (kind === "event") {
            delete variantSnapshot.baselinePatches?.eventPatches?.[rawId];
          }
          if (kind === "rule") {
            delete variantSnapshot.baselinePatches?.rulePatches?.[rawId];
          }
          if (kind === "position") {
            delete variantSnapshot.baselinePatches?.positionPatches?.[rawId];
          }
          if (kind === "experiment") {
            const experimentId = rawId.replace("experiment-", "");
            variantSnapshot.experiments = variantSnapshot.experiments?.filter(
              (experiment) => experiment.id !== experimentId
            );
          }

          const applyResult = applyPlanPatches({
            scenario,
            snapshot: variantSnapshot,
            patches: buildPlanPatchesFromSnapshot(variantSnapshot),
            eventLibrary,
            budgetRules,
            members,
          });
          const variantProjection = computeProjectionWithSmartInvest(
            applyResult.scenario,
            [...eventLibrary, ...applyResult.eventDefinitions],
            {
              members: applyResult.members,
              budgetRules: applyResult.budgetRules,
            }
          ).projection;
          variantMinCash =
            computePlanLabKpis(variantProjection, firstBucketTargetValue)?.minCash?.value ?? null;
        }

        const contribution =
          typeof variantMinCash === "number" ? currentDelta - (variantMinCash - baseMinCash) : 0;
        attributionCacheRef.current.set(cacheKey, contribution);
        nextDrivers.push({
          id: candidate.id,
          itemId: candidate.id,
          source: candidate.source,
          title: candidate.title,
          contribution,
        });
      });

      if (attributionGenerationRef.current !== generation) {
        return;
      }
      const normalized = normalizeTopDrivers(nextDrivers);
      setTopDrivers((current) => (areTopDriversEqual(current, normalized) ? current : normalized));
      setTopDriversLoading(false);
    }, TOP_DRIVER_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    baselineKpis?.minCash?.value,
    baselineScenarioV2,
    budgetRules,
    changedDriverCandidates,
    eventLibrary,
    firstBucketTargetValue,
    members,
    optionKpis?.minCash?.value,
    planLabProjection.projection,
    planSnapshot,
    scenario,
    scenarioIsV2,
    scenarioV2Patches,
    topDriverOverlaySignature,
  ]);

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

  const targetPresetOptions = useMemo(() => {
    const netWorthSeries = baselineProjection.projection?.netWorth ?? [];
    const baselineEndNetWorth = netWorthSeries[netWorthSeries.length - 1];
    if (!Number.isFinite(baselineEndNetWorth) || baselineEndNetWorth <= 0) {
      return [];
    }
    const multipliers = [0.5, 1, 1.5, 2];
    const rawValues = multipliers.map((multiplier) =>
      Math.round((baselineEndNetWorth ?? 0) * multiplier)
    );
    const roundedValues = Array.from(
      new Set(rawValues.map((value) => Math.round(value / 10000) * 10000))
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
          : String(absValue);
      const sign = deltaValue > 0 ? "+" : deltaValue < 0 ? "-" : "±";
      return {
        direction,
        display: `${arrow} ${sign}${valueDisplay}${unit ? ` ${unit}` : ""}`,
      };
    },
    [locale, scenario.baseCurrency]
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

    const endNetWorthA = optionKpis?.endNetWorth ?? null;
    const endNetWorthB = baselineKpis?.endNetWorth ?? null;
    const endNetWorthAValue =
      endNetWorthA !== null
        ? formatCurrency(endNetWorthA, scenario.baseCurrency, locale)
        : notAvailable;
    const endNetWorthBValue =
      endNetWorthB !== null
        ? formatCurrency(endNetWorthB, scenario.baseCurrency, locale)
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
        label: translate("planLabKpiMinCash", "最低現金結餘"),
        valueA: minCashAValue,
        valueB: minCashBValue,
        delta: formatDeltaDisplay(kpiDiff.minCash, null),
      },
      {
        key: "negativeCash",
        label: translate("planLabKpiNegativeCash", "現金轉負最早月份"),
        valueA: negativeAValue,
        valueB: negativeBValue,
        delta: formatDeltaDisplay(
          kpiDiff.firstNegativeCashMonth,
          translate("planLabKpiMonthsUnit", "個月")
        ),
      },
      {
        key: "endNetWorth",
        label: translate("planLabKpiEndNetWorth", "期末淨資產"),
        valueA: endNetWorthAValue,
        valueB: endNetWorthBValue,
        delta: formatDeltaDisplay(kpiDiff.endNetWorth, null),
      },
      {
        key: "targetMonth",
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
    ];
  }, [
    baselineKpis,
    firstBucketTargetValue,
    formatDeltaDisplay,
    formatMonthLabel,
    kpiDiff,
    locale,
    optionKpis,
    scenario.baseCurrency,
    translate,
  ]);

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
      onLocate?: () => void;
    }> = [];

    if (scenarioIsV2) {
      scenarioV2Patches.events.add.forEach((event) => {
        controls.push({
          id: `event-add-${event.id}`,
          titleLine: event.label ?? event.id,
          diffLines: [translate("planLabAppliedAddedEvent", "新增事件")],
          isEnabled: true,
          onRemove: () => removeScenarioV2Event(event.id),
          onLocate: () => handleLocateItem(`event:${event.id}`),
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
          onLocate: () => handleLocateItem(`event:${eventId}`),
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
        onLocate: () => openEditMemberDrawer(member),
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
        onLocate: () => handleLocateItem(`rule:${rule.id}`),
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
        onLocate: () => handleLocateItem(`event:${event.definition.id}`),
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
        onLocate: () => handleLocateItem(`event:${refId}`),
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
        onLocate: () => handleLocateItem(`rule:${ruleId}`),
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
        onLocate: () => handleLocateItem(`position:${key}`),
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
        onLocate: () => handleLocateItem("position:smartInvest"),
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
        onLocate: () => handleLocateItem(`experiment-${experiment.id}`),
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
    handleLocateItem,
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
      baselineSignature,
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
    deletePlanSnapshot(plan.baselineScenarioId, plan.id);
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
    renamePlanSnapshot(plan.baselineScenarioId, plan.id, name);
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
      {templatePlanUnsupportedNotice && (
        <Notification color="yellow" onClose={() => setTemplatePlanUnsupportedNotice(null)}>
          {templatePlanUnsupportedNotice}
        </Notification>
      )}
      <Card withBorder radius="md" padding="lg" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs" align="center" wrap="wrap">
              <Title order={3}>{t("planLabTitle")}</Title>
              <Badge color="ice" variant="light">
                {t("planLabPreviewBadge")}
              </Badge>
              <Badge color="neutral" variant="light">
                {statusPillLabel}
              </Badge>
              {hasUnsavedChanges && (
                <Badge color="orange" variant="light">
                  ● {translate("planLabDirtyLabel", "未儲存")}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              {t("planLabSubtitle")}
            </Text>
          </Stack>
          <Group gap="xs" wrap="wrap">
            {mode === "edit" && (
              <Button
                size="sm"
                color="aurora"
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
                variant="outline"
                onClick={handleUpdatePlan}
                disabled={!activePlanId}
              >
                {translate("planLabUpdatePlan", "Update plan")}
              </Button>
            )}
            <Button size="sm" variant="subtle" onClick={() => setPlanLibraryOpen(true)}>
              {translate("planLabPlansButton", "Plans ({count})", {
                count: planCount,
              })}
            </Button>
            {mode === "edit" && (
              <MantineTooltip
                label={translate(
                  "planLabSaveScenarioTooltip",
                  "將目前沙盒變更套用至情境"
                )}
                withArrow
              >
                <Button size="sm" variant="outline" onClick={handleSave}>
                  {translate("planLabSaveScenario", "保存到情境")}
                </Button>
              </MantineTooltip>
            )}
            <SegmentedControl
              size="sm"
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
          </Group>

        </Group>
      </Card>

      <Card display={"none"} withBorder radius="md" padding="md" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
        <Text size="sm">{t("planLabSandboxBanner")}</Text>
      </Card>

      {(
        <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
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
                    <Popover position="bottom-end" withArrow shadow="md">
                      <Popover.Target>
                        <Button size="sm" variant="light">
                          {translate("planLabFilterPopoverLabel", "篩選")}
                        </Button>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Stack gap="sm">
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
                          <Stack gap={4}>
                            <Text size="xs" fw={600}>
                              {translate("planLabFilterKindLabel", "分類")}
                            </Text>
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
                                        label: translate(
                                          "planLabFilterPositionsLabel",
                                          "資產"
                                        ),
                                      },
                                      {
                                        value: "events",
                                        label: translate("planLabFilterEventsLabel", "事件"),
                                      },
                                      {
                                        value: "rules",
                                        label: translate("planLabFilterRulesLabel", "規則"),
                                      },
                                    ]
                                  : [
                                      {
                                        value: "all",
                                        label: translate("planLabFilterAllLabel", "全部"),
                                      },
                                      {
                                        value: "positions",
                                        label: translate(
                                          "planLabFilterPositionsLabel",
                                          "資產"
                                        ),
                                      },
                                      {
                                        value: "events",
                                        label: translate("planLabFilterEventsLabel", "事件"),
                                      },
                                      {
                                        value: "rules",
                                        label: translate("planLabFilterRulesLabel", "規則"),
                                      },
                                    ]
                              }
                              value={filterKind}
                              onChange={(value) => setFilterKind(value as typeof filterKind)}
                            />
                          </Stack>
                          <Stack gap={4}>
                            <Text size="xs" fw={600}>
                              {translate("planLabGroupLabel", "分組")}
                            </Text>
                            <SegmentedControl
                              size="sm"
                              data={[
                                {
                                  value: "category",
                                  label: translate("planLabGroupCategoryLabel", "分類"),
                                },
                                {
                                  value: "member",
                                  label: translate("planLabGroupMemberLabel", "成員"),
                                },
                                {
                                  value: "timeline",
                                  label: translate("planLabGroupTimelineLabel", "時間"),
                                },
                              ]}
                              value={groupBy}
                              onChange={(value) => setGroupBy(value as typeof groupBy)}
                            />
                          </Stack>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                  </Group>
                  <Tabs
                    value={listTab}
                    onChange={(value) => value && setListTab(value as typeof listTab)}
                  >
                    <Tabs.List>
                      <Tabs.Tab value="changed">
                        {translate("planLabTabChanged", "已變更")}
                      </Tabs.Tab>
                      <Tabs.Tab value="all">
                        {translate("planLabTabAll", "全部")}
                      </Tabs.Tab>
                      <Tabs.Tab value="risky">
                        {translate("planLabTabRisky", "高風險")}
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs>
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
                                  ref={(node) => registerItemRef(item.id, node)}
                                  title={item.title}
                                  badges={getScenarioItemBadges(item)}
                                  summary={getScenarioItemSummary(item)}
                                  enabled={item.enabled}
                                  highlighted={highlightedItemId === item.id}
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

            <Accordion variant="separated" radius="lg" defaultValue="experiments">
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
                          {translate("planLabControlsTitle", "控制項")}
                        </Text>
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
                          onClick={openAddEventDrawer}
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
                    {scenarioIsV2 && bundleExperimentCta ? (
                      <Notification color="teal" onClose={() => setBundleExperimentCta(null)}>
                        <Group justify="space-between" align="center" wrap="wrap">
                          <Text size="sm">
                            {translate(
                              "planLabBundleCta",
                              "已新增「{title}」（{count}項）" ,
                              {
                                title: bundleExperimentCta.title,
                                count: String(bundleExperimentCta.itemCount),
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
                                createExperimentGroup(
                                  bundleExperimentCta.title,
                                  bundleExperimentCta.itemIds
                                );
                              }
                              setBundleExperimentCta(null);
                            }}
                          >
                            {translate("planLabPackAsExperimentAction", "打包成實驗")}
                          </Button>
                        </Group>
                      </Notification>
                    ) : null}
                    {(scenarioIsV2 ? experimentGroups.length === 0 : experiments.length === 0) ? (
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed">
                          {scenarioIsV2
                            ? translate(
                                "planLabExperimentsEmptyRich",
                                "實驗用嚟建立可開關/可調參數嘅測試。你而家新增咗項目，但未建立實驗。"
                              )
                            : t("planLabExperimentsEmpty")}
                        </Text>
                        {scenarioIsV2 ? (
                          <Group gap="xs">
                            <Button size="xs" onClick={openAddEventDrawer}>
                              {translate("planLabCreateExperimentAction", "建立實驗")}
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
                        <Accordion variant="separated" radius="md" multiple>
                          {(scenarioIsV2 ? experimentGroups : experiments).map((experiment) => {
                            if (scenarioIsV2) {
                              const group = experiment as PlanLabExperimentGroup;
                              const badges: PlanLabRowBadge[] = [
                                {
                                  label: translate("planLabBadgeExperiment", "實驗"),
                                  color: "blue",
                                },
                              ];
                              if (!group.isEnabled) {
                                badges.push({
                                  label: translate("planLabBadgeDisabled", "已停用"),
                                  color: "red",
                                });
                              }
                              return (
                                <PlanLabAccordionRow
                                  key={group.experimentId}
                                  id={`experiment-group-${group.experimentId}`}
                                  ref={(node) =>
                                    registerItemRef(`experiment-group-${group.experimentId}`, node)
                                  }
                                  title={resolveExperimentGroupTitle(group.title)}
                                  badges={badges}
                                  summary={translate(
                                    "planLabExperimentGroupCount",
                                    "{count}項",
                                    { count: String(group.itemIds.length) }
                                  )}
                                  enabled={group.isEnabled}
                                  onToggle={() => toggleExperimentGroup(group.experimentId)}
                                  primaryAction={{
                                    label: translate("planLabAppliedRemove", "移除"),
                                    onClick: () => setConfirmRemoveGroupId(group.experimentId),
                                    color: "red",
                                  }}
                                  panel={
                                    <Stack gap={6}>
                                      <Text size="xs" c="dimmed">
                                        {translate("planLabExperimentGroupCount", "{count}項", {
                                          count: String(group.itemIds.length),
                                        })}
                                      </Text>
                                      <Text size="xs" fw={500}>
                                        {translate("planLabExperimentIncludesItems", "包含項目")}
                                      </Text>
                                      <Stack gap={4}>
                                        {group.itemIds.slice(0, 3).map((itemId) => {
                                          const item = patchItemLookup.get(itemId);
                                          const label = item?.label?.trim() || "—";
                                          const type = item?.type ?? "—";
                                          const amountText =
                                            typeof item?.amount === "number"
                                              ? formatCurrency(item.amount, "HKD", locale)
                                              : "—";
                                          const startMonth = item?.startMonth?.trim() || "—";
                                          return (
                                            <Group key={`${group.experimentId}-${itemId}`} gap={6} wrap="wrap">
                                              <Text size="xs">{label}</Text>
                                              <Badge size="xs" variant="light" color="gray">
                                                {type}
                                              </Badge>
                                              <Text size="xs" c="dimmed">
                                                {amountText}
                                              </Text>
                                              <Text size="xs" c="dimmed">
                                                {startMonth}
                                              </Text>
                                            </Group>
                                          );
                                        })}
                                        {group.itemIds.length > 3 && (
                                          <Text size="xs" c="dimmed">
                                            +{group.itemIds.length - 3}
                                          </Text>
                                        )}
                                      </Stack>
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
                            const menuItems: PlanLabRowMenuItem[] = [
                              {
                                label: translate("planLabActionDuplicate", "複製"),
                                onClick: () => duplicateExperiment(legacyExperiment),
                              },
                              {
                                label: translate("planLabAppliedRemove", "移除"),
                                onClick: () => removeExperiment(legacyExperiment.id),
                              },
                            ];
                            return (
                              <PlanLabAccordionRow
                                key={legacyExperiment.id}
                                id={`experiment-${legacyExperiment.id}`}
                                ref={(node) =>
                                  registerItemRef(`experiment-${legacyExperiment.id}`, node)
                                }
                                title={label}
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

              <Accordion.Item value="applied-controls">
                <Accordion.Control>
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabAppliedControlsTitle")}</Text>
                    <Badge variant="light" color="blue">
                      {appliedControls.length}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <MantineTooltip
                        label={translate(
                          "planLabAppliedControlsTooltip",
                          "快速檢視目前啟用的改動，並可逐一關閉。"
                        )}
                        withArrow
                      >
                        <Text size="sm" fw={600}>
                          {translate("planLabAppliedSummary", "已套用改動")} (
                          {appliedControls.length})
                        </Text>
                      </MantineTooltip>
                      <Group gap="xs" wrap="wrap">
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
                                      <Text
                                        key={`${control.id}-diff-${index}`}
                                        size="xs"
                                        c="dimmed"
                                      >
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
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      onClick={() => control.onLocate?.()}
                                      disabled={!control.onLocate}
                                    >
                                      {translate("planLabAppliedLocate", "定位")}
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="light"
                                      color="red"
                                      onClick={() => control.onRemove()}
                                    >
                                      {translate("planLabAppliedRevert", "復原")}
                                    </Button>
                                  </Group>
                                </Group>
                              </Paper>
                            );
                            if (control.tooltip) {
                              return (
                                <MantineTooltip
                                  key={control.id}
                                  label={control.tooltip}
                                  withArrow
                                >
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
            <Stack gap="lg">
              <Card withBorder radius="md" padding="lg" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
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
                    <NumberInput
                      label={translate("planLabScorecardTargetAmount", "目標金額")}
                      value={firstBucketTargetAmount}
                      min={0}
                      onChange={(value) =>
                        setFirstBucketTargetAmount(typeof value === "number" ? value : "")
                      }
                    />
                  </Stack>
                  {!planLabProjection.projection ? (
                    <Text size="sm" c="dimmed">
                      {t("planLabScorecardDisabled")}
                    </Text>
                  ) : (
                    <SimpleGrid cols={{ base: 1, md: 1 }} spacing="sm">
                      {kpiCards.map((card) => {
                        const deltaColor =
                          card.delta?.direction === "up"
                            ? "teal"
                            : card.delta?.direction === "down"
                            ? "red"
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
                          <Paper key={card.key} withBorder radius="md" p="md" shadow="xs" style={{ borderColor: "var(--mantine-color-neutral-2)" }}>
                            <Stack gap={6}>
                              <Text size="sm" fw={600} c="dimmed">
                                {card.label}
                              </Text>
                              <SimpleGrid cols={2} spacing="lg">
                                <Stack gap={2} style={{ minWidth: 0 }} data-testid="kpi-current">
                                  <Text size="xs" c="dimmed">
                                    {labelA}
                                  </Text>
                                  <Text
                                    fw={700}
                                    size="xl"
                                    style={{
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "pre-line",
                                      overflow: "hidden",
                                      // textOverflow: "ellipsis",
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
                                    size="xl"
                                    ta="right"
                                    style={{
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "pre-line",
                                      overflow: "hidden",
                                      // textOverflow: "ellipsis",
                                    }}
                                  >
                                    {card.valueB}
                                  </Text>
                                </Stack>
                              </SimpleGrid>
                              <Group justify="space-between" align="center" wrap="wrap">
                                <Text size="xs" c="dimmed">
                                  {mode === "compare" ? "Δ (A-B)" : "Δ"}
                                </Text>
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

              <Card withBorder radius="md" padding="md">
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
                          onClick={() => handleLocateItem(driver.itemId)}
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
                    </ResponsiveContainer>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </div>
        </Grid.Col>
        </Grid>
      )}



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

      <BundleWizardDrawer
        opened={bundleWizardOpen}
        template={bundleTemplate}
        scenarioId={scenario.id}
        baseMonth={scenario.assumptions.baseMonth}
        baseCurrency={scenario.baseCurrency}
        scenarioEvents={sandboxScenarioV2.events ?? []}
        onClose={() => {
          setBundleWizardOpen(false);
          setBundleTemplate(null);
        }}
        onApplyEvents={handleApplyBundleEvents}
        allowInlineEdit={false}
      />

      <TemplatePickerDrawer
        opened={templatePickerOpen}
        defaultCategory={templatePickerCategory}
        showIntentScreen
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
            members={sandboxScenarioV2.members ?? []}
            event={v2EventDrawerMode === "edit" ? editingCashflowEvent : null}
            defaultKind={v2EventDefaultKind}
            initialCashflowDraft={templateCashflowDraft ?? undefined}
            onClose={closeV2EventDrawer}
            onSave={handleSaveV2Event}
          />
          <HousingEventDrawer
            opened={v2EventDrawerOpen && v2EventDrawerType === "housing"}
            mode={v2EventDrawerMode}
            baseCurrency={scenario.baseCurrency}
            event={v2EventDrawerMode === "edit" ? editingHousingEvent : null}
            initialDraft={templateHousingDraft ?? undefined}
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
        <Stack gap="md">
          <Text size="sm">
            {translate(
              "planLabRemoveExperimentConfirmBody",
              "此操作會解除打包並移除實驗開關，但會保留 {count} 個項目於 Plan Lab。",
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
                  deleteExperimentGroup(pendingRemoveGroup.experimentId);
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
