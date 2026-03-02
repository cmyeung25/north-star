"use client";

import {
  Accordion,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Notification,
  NumberInput,
  MultiSelect,
  Select,
  SegmentedControl,
  Stack,
  Tabs,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { signInWithGoogle, signOutUser } from "../../lib/authActions";
import { isFirebaseConfigured } from "../../lib/firebaseClient";
import {
  downloadCloudStateToLocal,
  fetchCloudSummary,
  requiresSchemaUpgrade,
  uploadLocalStateToCloud,
  type CloudSummary,
} from "../../lib/sync/firestoreSync";
import { useAuthState } from "../../src/hooks/useAuthState";
import { useScenarioContext } from "../../src/hooks/useScenarioContext";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
  createBudgetRuleId,
  createMemberId,
  type MemberMilestone,
  type ScenarioMemberKind,
} from "../../src/store/scenarioStore";
import { appliesToScenario, type ApplyScope } from "../../src/domain/applyScope";
import { useSettingsStore } from "../../src/store/settingsStore";
import { buildMoneyAssetsUrl } from "../../src/utils/scenarioContext";
import ScenarioAssumptionsOverrideForm from "../ScenarioAssumptionsOverrideForm";
import type { ScenarioAssumptionsOverride } from "../ScenarioAssumptionsOverrideForm";
import { Link } from "../../src/i18n/navigation";
import { buildMonthRange } from "@north-star/engine";
import { getMemberAgeYears } from "../../src/domain/members/age";
import { isValidMonthStr, normalizeMonthStrict } from "../../src/utils/month";
import {
  compileBudgetRuleToMonthlySeries,
  type BudgetRuleMonthlyEntry,
} from "../../src/domain/budget/compileBudgetRules";
import DataManagementSection from "../DataManagementSection";
import DateOrAgeBasisPicker, {
  type DateOrAgeBasis,
} from "../DateOrAgeBasisPicker";
import PositionDetailList from "../timeline/PositionDetailList";
import {
  buildScenarioEventViews,
  buildScenarioTimelineEvents,
} from "../../src/domain/events/utils";
import { getEventMeta } from "../../src/events/eventCatalog";
import { buildDefaultSmartInvestPolicy } from "../../src/domain/smartInvest/defaultPolicy";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";
import {
  DEFAULT_PLANNING_HORIZON_YEARS,
  PLANNING_HORIZON_YEARS,
  resolvePlanningHorizonMonths,
} from "../../src/domain/assumptions/planningHorizon";
import { buildDefaultsForNewMember } from "../../src/domain/onboarding/buildDefaultsForNewMember";
import { useProjectionWithLedger } from "../../src/engine/useProjectionWithLedger";
import {
  scenarioDashboardPath,
  scenarioMoneyPath,
} from "../../lib/routes/appRoutes";
import { computeDashboardMetrics } from "../../src/domain/dashboard/metrics";
import ProjectionPreviewPanel, { type PreviewScope } from "../ProjectionPreviewPanel";
import {
  analyzeAssumptionImpact,
  type AssumptionImpactKey,
} from "../../src/domain/assumptions/impactAnalyzer";
import {
  ASSUMPTION_PRESETS,
  type AssumptionsPresetKey,
} from "../../src/domain/assumptions/presets";
import { buildOnboardingAssumptionsDraft } from "../../src/domain/onboarding/v2/assumptions";
import {
  buildOnboardingAssumptionsAutoFillPatch,
  getOnboardingAssumptionsAutoApplyFlagKey,
  shouldAutoApplyOnboardingAssumptions,
} from "../../src/domain/assumptions/onboardingAutoApply";

type SettingsTabKey = "data" | "global" | "members" | "budget" | "other";

type ScenarioSettingsWorkspaceProps = {
  scenarioId?: string;
  titleKey?: "settingsTitle" | "peopleTitle";
  subtitleKey?: "settingsSubtitle" | "peopleSubtitle";
  defaultTab?: SettingsTabKey;
  tabOrder?: SettingsTabKey[];
  initialAction?: string;
  initialRuleId?: string;
};

type ToastState = {
  message: string;
  color?: string;
};

const isHousingCategory = (category: string) => category === "housing";

export default function ScenarioSettingsWorkspace({
  scenarioId,
  titleKey = "settingsTitle",
  subtitleKey = "settingsSubtitle",
  defaultTab = "global",
  tabOrder,
  initialAction,
  initialRuleId,
}: ScenarioSettingsWorkspaceProps) {
  const locale = useLocale();
  const t = useTranslations("assumptions");
  const membersText = useTranslations("members");
  const budgetText = useTranslations("budgetRules");
  const common = useTranslations("common");
  const timelineText = useTranslations("timeline");
  const errors = useTranslations("errors");
  const validation = useTranslations("validation");
  const horizonOptions = PLANNING_HORIZON_YEARS.map((years) => ({
    value: String(resolvePlanningHorizonMonths(years)),
    label: t(`horizonYears${years}`),
  }));
  const baseMonthHelper = t("baseMonthHelper");
  const authState = useAuthState();
  const scenarioContext = useScenarioContext();
  const caseId = scenarioContext?.caseId ?? "";
  const scenarioIdFromQuery = scenarioId ?? null;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const setGlobalHorizonMonths = useScenarioStore(
    (state) => state.setGlobalHorizonMonths
  );
  const setGlobalBaseMonth = useScenarioStore((state) => state.setGlobalBaseMonth);
  const setAnnualInflationPct = useScenarioStore(
    (state) => state.setAnnualInflationPct
  );
  const setViewMode = useScenarioStore((state) => state.setViewMode);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const deleteMember = useScenarioStore((state) => state.deleteMember);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);
  const removeBudgetRule = useScenarioStore((state) => state.removeBudgetRule);
  const upsertEventDefinition = useScenarioStore(
    (state) => state.upsertEventDefinition
  );
  const upsertScenarioEventRef = useScenarioStore(
    (state) => state.upsertScenarioEventRef
  );
  const autoSyncEnabled = useSettingsStore((state) => state.autoSyncEnabled);
  const lastAutoSyncAt = useSettingsStore((state) => state.lastAutoSyncAt);
  const autoSyncError = useSettingsStore((state) => state.autoSyncError);
  const setAutoSyncEnabled = useSettingsStore((state) => state.setAutoSyncEnabled);
  const setAutoSyncError = useSettingsStore((state) => state.setAutoSyncError);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [previewScope, setPreviewScope] = useState<PreviewScope>("12m");
  const [syncToast, setSyncToast] = useState<ToastState | null>(null);
  const [baseMonthInput, setBaseMonthInput] = useState("");
  const [baseMonthError, setBaseMonthError] = useState<string | null>(null);
  const [memberBirthMonthInputs, setMemberBirthMonthInputs] = useState<
    Record<string, string>
  >({});
  const [memberBirthMonthErrors, setMemberBirthMonthErrors] = useState<
    Record<string, string | null>
  >({});
  const resolvedTabOrder = useMemo<SettingsTabKey[]>(() =>
    ((tabOrder ?? [
      "global",
      "members",
      "data",
      "other",
      "budget",
    ]) as SettingsTabKey[]).filter((k) => k !== "budget") as SettingsTabKey[],
    [tabOrder]
  );
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(defaultTab);
  const tabLabels: Record<SettingsTabKey, string> = useMemo(
    () => ({
      data: common("settingsTabDataAction"),
      global: common("settingsTabGlobalAction"),
      members: common("settingsTabMembersAction"),
      budget: common("settingsTabBudget"),
      other: common("settingsTabOtherAction"),
    }),
    [common]
  );
  const [budgetMonthInputs, setBudgetMonthInputs] = useState<
    Record<string, { startMonth: string; endMonth: string }>
  >({});
  const [budgetMonthErrors, setBudgetMonthErrors] = useState<
    Record<string, { startMonth?: string; endMonth?: string }>
  >({});
  const [budgetRuleBasis, setBudgetRuleBasis] = useState<
    Record<string, DateOrAgeBasis>
  >({});
  const [expandedBudgetRuleId, setExpandedBudgetRuleId] = useState<string | null>(
    null
  );
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [cloudSummary, setCloudSummary] = useState<CloudSummary | null>(null);
  const [syncingAction, setSyncingAction] = useState<null | "upload" | "download">(
    null
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [seedDefaultsOnAddMember, setSeedDefaultsOnAddMember] = useState(true);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [affectedAssumptionKey, setAffectedAssumptionKey] = useState<
    keyof ScenarioAssumptionsOverride | null
  >(null);
  const [selectedAssumptionPreset, setSelectedAssumptionPreset] =
    useState<AssumptionsPresetKey>("baseline");
  const [resetAssumptionsModalOpen, setResetAssumptionsModalOpen] = useState(false);
  const [hasAppliedOnboardingBaseline, setHasAppliedOnboardingBaseline] =
    useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHandledInitialAction = useRef(false);
  const autoAppliedScenarioIdsRef = useRef<Set<string>>(new Set());
  const prevMemberMonthRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setBudgetRuleBasis((current) => {
      const next = { ...current };
      budgetRules.forEach((rule) => {
        if (!next[rule.id]) {
          next[rule.id] =
            rule.startMonth?.trim() || rule.endMonth?.trim() ? "month" : "age";
        }
      });
      Object.keys(next).forEach((ruleId) => {
        if (!budgetRules.some((rule) => rule.id === ruleId)) {
          delete next[ruleId];
        }
      });
      return next;
    });
  }, [budgetRules]);

  useEffect(() => {
    if (
      scenarioIdFromQuery &&
      scenarioIdFromQuery !== activeScenarioId &&
      scenarios.some((scenario) => scenario.id === scenarioIdFromQuery)
    ) {
      setActiveScenario(scenarioIdFromQuery);
    }
  }, [activeScenarioId, scenarioIdFromQuery, scenarios, setActiveScenario]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hash = window.location.hash.replace("#", "");
    if (hash && resolvedTabOrder.includes(hash as SettingsTabKey)) {
      setActiveTab(hash as SettingsTabKey);
    }
  }, [resolvedTabOrder]);

  const handleTabChange = (value: string | null) => {
    const nextTab = (value ?? defaultTab) as SettingsTabKey;
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${nextTab}`);
    }
  };

  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioIdFromQuery, activeScenarioId, scenarios),
    [activeScenarioId, scenarioIdFromQuery, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const includeBudgetRulesInProjection =
    scenario?.assumptions.includeBudgetRulesInProjection ?? true;
  const defaultSmartInvestPolicy = useMemo(
    () => buildDefaultSmartInvestPolicy(t("smartInvestDefaultAllocation")),
    [t]
  );
  const smartInvestPolicy = scenario?.assumptions.smartInvest ?? defaultSmartInvestPolicy;
  const hasExpenseEvents = useMemo(() => {
    if (!scenario) {
      return false;
    }
    const events = buildScenarioTimelineEvents(scenario, eventLibrary);
    return events.some(
      (event) => event.enabled && getEventMeta(event.type).group === "expense"
    );
  }, [eventLibrary, scenario]);
  const { projection, ledgerByMonth, projectionNetCashflowByMonth } = useProjectionWithLedger(
    scenario,
    eventLibrary,
    { members, budgetRules }
  );
  const dashboardMetrics = useMemo(
    () => computeDashboardMetrics(projection, projectionNetCashflowByMonth, ledgerByMonth),
    [ledgerByMonth, projection, projectionNetCashflowByMonth]
  );
  const currentMonth = projection?.months[0] ?? null;
  const currentMonthIndex = currentMonth ? projection?.months.indexOf(currentMonth) ?? -1 : -1;
  const currentMonthCash = currentMonthIndex >= 0 ? projection?.cashBalance[currentMonthIndex] ?? null : null;
  const currentMonthNetWorth = currentMonthIndex >= 0 ? projection?.netWorth[currentMonthIndex] ?? null : null;
  const currentMonthNetCashflow = currentMonth ? (ledgerByMonth[currentMonth] ?? []).reduce((sum, item) => sum + item.amount, 0) : null;
  const impactAnalysis = useMemo(() => {
    if (!scenario) {
      return null;
    }
    return analyzeAssumptionImpact(scenario, scenario.assumptions);
  }, [scenario]);
  const selectedPresetPatch = ASSUMPTION_PRESETS[selectedAssumptionPreset];
  const assumptionPresetPreviewValues = useMemo(() => {
    if (!scenario) {
      return null;
    }
    return {
      ...scenario.assumptions,
      ...selectedPresetPatch,
    };
  }, [scenario, selectedPresetPatch]);
  const assumptionPresetImpactAnalysis = useMemo(() => {
    if (!scenario || !assumptionPresetPreviewValues) {
      return null;
    }
    return analyzeAssumptionImpact(scenario, assumptionPresetPreviewValues);
  }, [assumptionPresetPreviewValues, scenario]);
  const impactCountByKey = useMemo<
    Partial<Record<keyof ScenarioAssumptionsOverride, number>>
  >(
    () => ({
      inflationRate: impactAnalysis?.byAssumptionKey.inflationRate?.count ?? 0,
      salaryGrowthRate: impactAnalysis?.byAssumptionKey.salaryGrowthRate?.count ?? 0,
      emergencyFundMonths: 0,
      rentAnnualGrowthPct: impactAnalysis?.byAssumptionKey.rentAnnualGrowthPct?.count ?? 0,
      propertyAppreciationPct:
        impactAnalysis?.byAssumptionKey.propertyAppreciationPct?.count ?? 0,
      cashYieldPct: impactAnalysis?.byAssumptionKey.cashYieldPct?.count ?? 0,
      carDepreciationRatePct:
        impactAnalysis?.byAssumptionKey.carDepreciationRatePct?.count ?? 0,
    }),
    [impactAnalysis]
  );
  const assumptionPresetImpactCountByKey = useMemo<
    Partial<Record<keyof ScenarioAssumptionsOverride, number>>
  >(
    () => ({
      inflationRate:
        assumptionPresetImpactAnalysis?.byAssumptionKey.inflationRate?.count ?? 0,
      salaryGrowthRate:
        assumptionPresetImpactAnalysis?.byAssumptionKey.salaryGrowthRate?.count ?? 0,
      emergencyFundMonths: 0,
      rentAnnualGrowthPct:
        assumptionPresetImpactAnalysis?.byAssumptionKey.rentAnnualGrowthPct?.count ?? 0,
      propertyAppreciationPct:
        assumptionPresetImpactAnalysis?.byAssumptionKey.propertyAppreciationPct?.count ?? 0,
      cashYieldPct:
        assumptionPresetImpactAnalysis?.byAssumptionKey.cashYieldPct?.count ?? 0,
      carDepreciationRatePct:
        assumptionPresetImpactAnalysis?.byAssumptionKey.carDepreciationRatePct?.count ?? 0,
    }),
    [assumptionPresetImpactAnalysis]
  );
  const assumptionPresetDiffRows = useMemo(() => {
    if (!scenario) {
      return [] as Array<{
        key: keyof ScenarioAssumptionsOverride;
        beforeValue: number | undefined;
        afterValue: number | undefined;
        beforeImpact: number;
        afterImpact: number;
      }>;
    }
    return (Object.keys(selectedPresetPatch) as Array<keyof ScenarioAssumptionsOverride>)
      .map((key) => {
        const beforeValue = scenario.assumptions[key];
        const afterValue = selectedPresetPatch[key];
        if (beforeValue === afterValue) {
          return null;
        }
        return {
          key,
          beforeValue,
          afterValue,
          beforeImpact: impactCountByKey[key] ?? 0,
          afterImpact: assumptionPresetImpactCountByKey[key] ?? 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [
    assumptionPresetImpactCountByKey,
    impactCountByKey,
    scenario,
    selectedPresetPatch,
  ]);
  const impactLabelByKey = useMemo<
    Record<AssumptionImpactKey | "emergencyFundMonths", string>
  >(
    () => ({
      inflationRate: t("inflationRate"),
      salaryGrowthRate: t("salaryGrowth"),
      emergencyFundMonths: t("emergencyFundTarget"),
      rentAnnualGrowthPct: t("rentAnnualGrowth"),
      propertyAppreciationPct: t("propertyAppreciation"),
      cashYieldPct: t("cashYield"),
      carDepreciationRatePct: t("carDepreciation"),
    }),
    [t]
  );
  const affectedEntityList = useMemo(() => {
    if (!scenario || !affectedAssumptionKey || !impactAnalysis) {
      return [] as Array<{ id: string; label: string }>;
    }
    const ids =
      impactAnalysis.byAssumptionKey[affectedAssumptionKey as AssumptionImpactKey]
        ?.eventIds ?? [];
    return ids.map((id) => {
      const event = scenario.events?.find((entry) => entry.id === id);
      if (event) {
        return {
          id,
          label: event.label ?? `${event.type}`,
        };
      }
      const asset = scenario.assets?.find((entry) => entry.id === id);
      if (asset) {
        return {
          id,
          label: asset.label ?? `${t("impactAssetFallbackLabel")} (${asset.kind})`,
        };
      }
      return {
        id,
        label: t("impactUnknownEntityLabel"),
      };
    });
  }, [affectedAssumptionKey, impactAnalysis, scenario, t]);
  const baseCurrency = scenario?.baseCurrency ?? "";
  const formatCurrency = useCallback(
    (value: number) => {
      if (!baseCurrency) {
        return value.toLocaleString(locale);
      }
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: baseCurrency,
        maximumFractionDigits: 0,
      }).format(value);
    },
    [baseCurrency, locale]
  );
  const smartInvestSummaryItems = useMemo(() => {
    const reserveValue =
      smartInvestPolicy.reserve.mode === "fixed"
        ? formatCurrency(smartInvestPolicy.reserve.amount ?? 0)
        : timelineText("smartInvestReserveMonths", {
            months: smartInvestPolicy.reserve.months ?? 0,
          });
    const contributionValue =
      smartInvestPolicy.contribution.mode === "percentOfIncome"
        ? timelineText("smartInvestContributionIncome", {
            pct: smartInvestPolicy.contribution.pct ?? 0,
          })
        : smartInvestPolicy.contribution.mode === "percentOfSurplus"
          ? timelineText("smartInvestContributionSurplus", {
              pct: smartInvestPolicy.contribution.pct ?? 0,
            })
          : smartInvestPolicy.contribution.mode === "excessCash"
            ? timelineText("smartInvestContributionExcessSummary", {
                pct: smartInvestPolicy.contribution.investPct ?? 100,
                threshold: formatCurrency(
                  smartInvestPolicy.contribution.thresholdAmount ?? 0
                ),
              })
            : timelineText("smartInvestContributionRebalance");
    const allocationValue = smartInvestPolicy.allocation
      .map((allocation) =>
        timelineText("smartInvestAllocationItem", {
          name: allocation.name,
          pct: allocation.targetPct,
          returnPct: allocation.assumedAnnualReturnPct,
        })
      )
      .join(" · ");
    return [
      {
        label: timelineText("smartInvestSummaryReserve"),
        value: reserveValue,
      },
      {
        label: timelineText("smartInvestSummaryContribution"),
        value: contributionValue,
      },
      {
        label: timelineText("smartInvestSummaryAllocation"),
        value: allocationValue,
      },
    ];
  }, [formatCurrency, smartInvestPolicy, timelineText]);

  useEffect(() => {
    setBaseMonthInput(appSettings.globalBaseMonth ?? "");
    setBaseMonthError(null);
  }, [appSettings.globalBaseMonth]);

  useEffect(() => {
    setMemberBirthMonthInputs((current) => {
      const next = { ...current };
      const previous = prevMemberMonthRef.current;
      members.forEach((member) => {
        const stored = member.birthMonth ?? "";
        if (next[member.id] === undefined || next[member.id] === previous[member.id]) {
          next[member.id] = stored;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!members.some((member) => member.id === key)) {
          delete next[key];
        }
      });
      prevMemberMonthRef.current = members.reduce<Record<string, string>>(
        (acc, member) => {
          acc[member.id] = member.birthMonth ?? "";
          return acc;
        },
        {}
      );
      return next;
    });
  }, [members]);

  useEffect(() => {
    let active = true;

    const loadCloudSummary = async () => {
      if (authState.status !== "signed-in" || !authState.user) {
        setCloudSummary(null);
        setSyncError(null);
        return;
      }

      try {
        const summary = await fetchCloudSummary(authState.user.uid);
        if (active) {
          setCloudSummary(summary);
          setSyncError(null);
        }
      } catch (error) {
        if (active) {
          setSyncError(
            error instanceof Error
              ? error.message
              : errors("syncStatusLoadFailed")
          );
        }
      }
    };

    void loadCloudSummary();

    return () => {
      active = false;
    };
  }, [authState.status, authState.user, errors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnlineChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", handleOnlineChange);
    window.addEventListener("offline", handleOnlineChange);

    return () => {
      window.removeEventListener("online", handleOnlineChange);
      window.removeEventListener("offline", handleOnlineChange);
    };
  }, []);

  const showToast = useCallback((message: string, color?: string) => {
    setToast({ message, color });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2000);
  }, []);

  const showSyncToast = (message: string, color?: string) => {
    setSyncToast({ message, color });
    if (syncToastTimeoutRef.current) {
      clearTimeout(syncToastTimeoutRef.current);
    }
    syncToastTimeoutRef.current = setTimeout(() => {
      setSyncToast(null);
    }, 3000);
  };

  const createBudgetRuleForMember = useCallback(
    (memberId?: string) => {
      const nextRule = {
        id: createBudgetRuleId(),
        name: budgetText("defaultRuleName", {
          index: budgetRules.length + 1,
        }),
        enabled: true,
        memberId,
        category: "health" as const,
        ageBand: { fromYears: 0, toYears: 3 },
        monthlyAmount: 0,
        annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
        applyScope: { scope: "all" } as ApplyScope,
      };
      createBudgetRule(nextRule);
      setExpandedBudgetRuleId(nextRule.id);
      showToast(common("saved"), "teal");
      return nextRule.id;
    },
    [
      budgetRules.length,
      budgetText,
      common,
      createBudgetRule,
      setExpandedBudgetRuleId,
      showToast,
    ]
  );

  const handleCreateBudgetRule = useCallback(() => {
    createBudgetRuleForMember(members[0]?.id);
  }, [createBudgetRuleForMember, members]);

  const handleAddMember = () => {
    const newMember = {
      id: createMemberId(),
      name: membersText("defaultName"),
      kind: "person" as const,
      ageAtBaseMonth: 0,
      applyScope: { scope: "all" } as ApplyScope,
      milestones: buildDefaultMilestones("person"),
    };

    createMember(newMember);

    if (scenario && seedDefaultsOnAddMember) {
      const eventViews = buildScenarioEventViews(scenario, eventLibrary);
      const { eventDefinitionsToUpsert, budgetRulesToUpsert } =
        buildDefaultsForNewMember({
          member: newMember,
          members: [...members, newMember],
          baseMonth: scenario.assumptions.baseMonth ?? "",
          scenarioId: scenario.id,
          baseCurrency: scenario.baseCurrency,
          existingBudgetRules: budgetRules,
          existingEventViews: eventViews,
        });

      eventDefinitionsToUpsert.forEach((definition) => {
        upsertEventDefinition(definition);
        upsertScenarioEventRef(scenario.id, {
          refId: definition.id,
          enabled: true,
        });
      });

      budgetRulesToUpsert.forEach((rule) => {
        createBudgetRule(rule);
      });
    }

    showToast(common("saved"), "teal");
  };

  useEffect(() => {
    if (hasHandledInitialAction.current) {
      return;
    }
    if (initialAction !== "rule") {
      return;
    }
    hasHandledInitialAction.current = true;
    if (resolvedTabOrder.includes("budget")) {
      setActiveTab("budget");
    } else {
      setActiveTab(defaultTab);
    }
    handleCreateBudgetRule();
  }, [handleCreateBudgetRule, initialAction, resolvedTabOrder, defaultTab]);

  useEffect(() => {
    if (!initialRuleId) {
      return;
    }
    if (resolvedTabOrder.includes("budget")) {
      setActiveTab("budget");
    } else {
      setActiveTab(defaultTab);
    }
    setExpandedBudgetRuleId(initialRuleId);
  }, [initialRuleId, resolvedTabOrder, defaultTab]);

  const isSignedIn = authState.status === "signed-in" && authState.user;
  const cloudHasData = (cloudSummary?.scenarioCount ?? 0) > 0;
  const localHasData = scenarios.length > 0;
  const schemaUpgradeRequired = requiresSchemaUpgrade(cloudSummary);
  const hasConflict = isSignedIn && cloudHasData && localHasData;
  const autoSyncStatusLabel = isSignedIn
    ? autoSyncEnabled
      ? common("autoSyncOn")
      : common("autoSyncOff")
    : common("autoSyncSignIn");
  const autoSyncDetails = isSignedIn && autoSyncEnabled
    ? isOnline
      ? lastAutoSyncAt
        ? common("lastSyncAt", {
            time: new Date(lastAutoSyncAt).toLocaleString(locale),
          })
        : common("lastSyncNotYet")
      : common("offlineSyncNotice")
    : null;

  const refreshCloudSummary = async () => {
    if (!authState.user) {
      setCloudSummary(null);
      return;
    }

    const summary = await fetchCloudSummary(authState.user.uid);
    setCloudSummary(summary);
  };

  const handleUpload = async (force = false) => {
    if (!authState.user) {
      return;
    }

    if (schemaUpgradeRequired) {
      setSyncError(errors("syncUpgradeRequired"));
      return;
    }

    if (hasConflict && !force) {
      setConflictModalOpen(true);
      return;
    }

    setSyncingAction("upload");
    setSyncError(null);
    try {
      const result = await uploadLocalStateToCloud(authState.user.uid);
      showSyncToast(
        common("syncUploadSuccess", { count: result.scenarioCount }),
        "teal"
      );
      await refreshCloudSummary();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : errors("uploadFailed")
      );
    } finally {
      setSyncingAction(null);
    }
  };

  const handleDownload = async (force = false) => {
    if (!authState.user) {
      return;
    }

    if (schemaUpgradeRequired) {
      setSyncError(errors("syncUpgradeRequired"));
      return;
    }

    if (hasConflict && !force) {
      setConflictModalOpen(true);
      return;
    }

    setSyncingAction("download");
    setSyncError(null);
    try {
      const result = await downloadCloudStateToLocal(authState.user.uid);
      showSyncToast(
        common("syncDownloadSuccess", { count: result.scenarioCount }),
        "teal"
      );
      await refreshCloudSummary();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : errors("downloadFailed")
      );
    } finally {
      setSyncingAction(null);
    }
  };

  const handleAssumptionChange = (
    patch: Parameters<typeof updateScenarioAssumptions>[1]
  ) => {
    if (!scenario) {
      return;
    }
    updateScenarioAssumptions(scenario.id, patch);
    showToast(common("saved"), "teal");
  };

  const handleApplyAssumptionPreset = () => {
    if (!scenario || assumptionPresetDiffRows.length === 0) {
      return;
    }
    updateScenarioAssumptions(scenario.id, selectedPresetPatch);
    showToast(common("saved"), "teal");
  };

  const defaultAssumptionsForReset = useMemo<ScenarioAssumptionsOverride>(() => {
    const onboardingDefaults = buildOnboardingAssumptionsDraft();
    return {
      inflationRate: onboardingDefaults.inflationPct ?? undefined,
      salaryGrowthRate: onboardingDefaults.incomeGrowthPct ?? undefined,
      rentAnnualGrowthPct: onboardingDefaults.rentGrowthPct ?? undefined,
      propertyAppreciationPct: onboardingDefaults.propertyAppreciationPct ?? undefined,
      cashYieldPct: onboardingDefaults.cashYieldPct ?? undefined,
      carDepreciationRatePct: onboardingDefaults.carDepreciationPct ?? undefined,
    };
  }, []);

  const resetAssumptionDiffRows = useMemo(() => {
    if (!scenario) {
      return [] as Array<{
        key: keyof ScenarioAssumptionsOverride;
        beforeValue: number | undefined;
        afterValue: number | undefined;
        delta: number;
      }>;
    }

    return (Object.keys(defaultAssumptionsForReset) as Array<keyof ScenarioAssumptionsOverride>)
      .map((key) => {
        const beforeValue = scenario.assumptions[key];
        const afterValue = defaultAssumptionsForReset[key];
        if (typeof beforeValue !== "number" || typeof afterValue !== "number") {
          return null;
        }
        const delta = Number((afterValue - beforeValue).toFixed(2));
        if (delta === 0) {
          return null;
        }
        return { key, beforeValue, afterValue, delta };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [defaultAssumptionsForReset, scenario]);

  const handleConfirmResetAssumptions = useCallback(() => {
    if (!scenario) {
      return;
    }
    updateScenarioAssumptions(scenario.id, defaultAssumptionsForReset);
    setResetAssumptionsModalOpen(false);
    showToast(t("resetDefaultsSaved"), "teal");
  }, [defaultAssumptionsForReset, scenario, showToast, t, updateScenarioAssumptions]);

  useEffect(() => {
    if (!scenario || typeof window === "undefined") {
      setHasAppliedOnboardingBaseline(false);
      return;
    }

    const flagKey = getOnboardingAssumptionsAutoApplyFlagKey(scenario.id);
    const hasAppliedFlag = window.localStorage.getItem(flagKey) === "true";
    setHasAppliedOnboardingBaseline(hasAppliedFlag);

    if (autoAppliedScenarioIdsRef.current.has(scenario.id)) {
      return;
    }
    autoAppliedScenarioIdsRef.current.add(scenario.id);

    if (!shouldAutoApplyOnboardingAssumptions({ scenario, hasAppliedFlag })) {
      return;
    }

    const patch = buildOnboardingAssumptionsAutoFillPatch(scenario.assumptions);
    if (Object.keys(patch).length === 0) {
      return;
    }

    updateScenarioAssumptions(scenario.id, patch);
    window.localStorage.setItem(flagKey, "true");
    setHasAppliedOnboardingBaseline(true);
    showToast(t("onboardingBaselineAppliedToast"), "teal");
  }, [scenario, showToast, t, updateScenarioAssumptions]);

  const handleClearOnboardingBaselineMarker = useCallback(() => {
    if (!scenario || typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(
      getOnboardingAssumptionsAutoApplyFlagKey(scenario.id)
    );
    setHasAppliedOnboardingBaseline(false);
    showToast(t("onboardingBaselineMarkerCleared"), "gray");
  }, [scenario, showToast, t]);

  useEffect(() => {
    setBudgetMonthInputs((current) => {
      const next = { ...current };
      budgetRules.forEach((rule) => {
        if (!next[rule.id]) {
          next[rule.id] = {
            startMonth: rule.startMonth ?? "",
            endMonth: rule.endMonth ?? "",
          };
        }
      });
      Object.keys(next).forEach((ruleId) => {
        if (!budgetRules.some((rule) => rule.id === ruleId)) {
          delete next[ruleId];
        }
      });
      return next;
    });
  }, [budgetRules]);

  const updateBudgetMonthInput = (
    ruleId: string,
    field: "startMonth" | "endMonth",
    value: string
  ) => {
    setBudgetMonthInputs((current) => ({
      ...current,
      [ruleId]: {
        startMonth: current[ruleId]?.startMonth ?? "",
        endMonth: current[ruleId]?.endMonth ?? "",
        [field]: value,
      },
    }));
    setBudgetMonthErrors((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], [field]: undefined },
    }));
  };

  const validateBudgetMonth = (
    ruleId: string,
    field: "startMonth" | "endMonth"
  ) => {
    if (!scenario) {
      return;
    }
    const rawValue = budgetMonthInputs[ruleId]?.[field] ?? "";
    const trimmed = rawValue.trim();

    if (trimmed === "") {
      updateBudgetRule(ruleId, { [field]: undefined });
      setBudgetMonthErrors((current) => ({
        ...current,
        [ruleId]: { ...current[ruleId], [field]: undefined },
      }));
      updateBudgetMonthInput(ruleId, field, "");
      return;
    }

    const normalized = normalizeMonthStrict(trimmed);
    if (!normalized.ok) {
      setBudgetMonthErrors((current) => ({
        ...current,
        [ruleId]: { ...current[ruleId], [field]: validation("useYearMonth") },
      }));
      return;
    }

    updateBudgetRule(ruleId, { [field]: normalized.month });
    setBudgetMonthErrors((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], [field]: undefined },
    }));
    updateBudgetMonthInput(ruleId, field, normalized.month);
  };

  const scenarioOptions = useMemo(
    () =>
      scenarios.map((entry) => ({
        value: entry.id,
        label: entry.name,
      })),
    [scenarios]
  );

  const baseMonth = appSettings.globalBaseMonth;
  const horizonMonths = appSettings.globalHorizonMonths;
  const scopedBudgetRules = scenario
    ? budgetRules.filter((rule) => appliesToScenario(rule.applyScope, scenario.id))
    : [];
  const hasHousingRules = scopedBudgetRules.some((rule) =>
    isHousingCategory(rule.category)
  );
  const horizonValue = horizonOptions.some(
    (option) => Number(option.value) === horizonMonths
  )
    ? String(horizonMonths)
    : String(resolvePlanningHorizonMonths(DEFAULT_PLANNING_HORIZON_YEARS));
  const horizonEndMonth =
    baseMonth && horizonMonths > 0
      ? buildMonthRange(baseMonth, horizonMonths).at(-1) ?? null
      : null;
  const formatAgeYears = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  const buildZeroPreview = useCallback(
    (rule: (typeof budgetRules)[number]): BudgetRuleMonthlyEntry[] => {
      if (!baseMonth || horizonMonths <= 0) {
        return [];
      }
      return buildMonthRange(baseMonth, horizonMonths).map(
        (month) => ({
          month,
          amount: 0,
          source: "budget",
          sourceId: rule.id,
          memberId: rule.memberId,
          label: rule.name,
          category: rule.category,
        })
      );
    },
    [baseMonth, horizonMonths]
  );
  const budgetCategoryLabels: Record<string, string> = {
    health: budgetText("categoryHealth"),
    childcare: budgetText("categoryChildcare"),
    education: budgetText("categoryEducation"),
    eldercare: budgetText("categoryEldercare"),
    petcare: budgetText("categoryPetcare"),
  };
  const householdBudgetRules = useMemo(
    () => budgetRules.filter((rule) => !rule.memberId),
    [budgetRules]
  );
  const formatApplyScopeLabel = (applyScope: ApplyScope | undefined) => {
    const scope = applyScope?.scope ?? "all";
    if (scope === "include") {
      return common("applyScopeInclude");
    }
    if (scope === "exclude") {
      return common("applyScopeExclude");
    }
    return common("applyScopeAll");
  };

  const expandedRule = useMemo(
    () => budgetRules.find((rule) => rule.id === expandedBudgetRuleId) ?? null,
    [budgetRules, expandedBudgetRuleId]
  );
  const expandedRulePreview = useMemo(() => {
    if (!expandedRule || !scenario) {
      return [];
    }
    return expandedRule.enabled
      ? compileBudgetRuleToMonthlySeries(expandedRule, scenario, members)
      : buildZeroPreview(expandedRule);
  }, [buildZeroPreview, expandedRule, members, scenario]);

  const recoveryHref =
    caseId && scenarios[0]?.id
      ? scenarioDashboardPath(caseId, scenarios[0].id)
      : "/";

  if (!scenario) {
    return (
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>{common("settingsTitle")}</Title>
          <Text c="dimmed" size="sm">
            {common("settingsMissingScenario")}
          </Text>
        </Stack>
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Text fw={600}>{common("settingsRecoveryTitle")}</Text>
            <Text size="sm" c="dimmed">
              {common("settingsRecoveryDescription")}
            </Text>
            <Group>
              <Button component={Link} href={recoveryHref} variant="light">
                {common("actionContinue")}
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  }

  const { assumptions } = scenario;

  const lastSyncedLabel = cloudSummary?.lastSyncedAt
    ? common("lastSyncedAt", {
        time: new Date(cloudSummary.lastSyncedAt).toLocaleString(locale),
      })
    : common("notSyncedYet");
  const syncStatusLabel = isSignedIn
    ? common("signedInStatus", { status: lastSyncedLabel })
    : common("localModeStatus");

  const normalizeApplyScope = (applyScope?: ApplyScope): ApplyScope =>
    applyScope ?? { scope: "all" };

  const renderApplyScope = (
    value: ApplyScope | undefined,
    onChange: (next: ApplyScope) => void,
    description?: string
  ) => {
    const scope = value?.scope ?? "all";
    const scenarioIds =
      value?.scope === "include" || value?.scope === "exclude"
        ? value.scenarioIds
        : [];

    return (
      <Stack gap={4}>
        <SegmentedControl
          data={[
            { value: "all", label: common("applyScopeAll") },
            { value: "include", label: common("applyScopeInclude") },
            { value: "exclude", label: common("applyScopeExclude") },
          ]}
          value={scope}
          onChange={(next) => {
            if (next === "all") {
              onChange({ scope: "all" });
              return;
            }
            onChange({ scope: next as "include" | "exclude", scenarioIds });
          }}
        />
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
        {scope !== "all" && (
          <MultiSelect
            data={scenarioOptions}
            value={scenarioIds}
            onChange={(next: string[]) =>
              onChange({ scope: scope as "include" | "exclude", scenarioIds: next })
            }
            placeholder={common("applyScopePlaceholder")}
          />
        )}
      </Stack>
    );
  };

  const createMilestoneId = () => `milestone-${nanoid(8)}`;

  const buildDefaultMilestones = (kind: ScenarioMemberKind): MemberMilestone[] => {
    if (kind !== "person") {
      return [];
    }
    return [
      {
        id: createMilestoneId(),
        kind: "schoolStart",
        label: membersText("milestoneSchoolStart"),
        atAgeYears: 6,
        applyScope: { scope: "all" } as ApplyScope,
      },
      {
        id: createMilestoneId(),
        kind: "graduation",
        label: membersText("milestoneGraduation"),
        atAgeYears: 22,
        applyScope: { scope: "all" } as ApplyScope,
      },
      {
        id: createMilestoneId(),
        kind: "retirement",
        label: membersText("milestoneRetirement"),
        atAgeYears: 65,
        applyScope: { scope: "all" } as ApplyScope,
      },
    ];
  };


  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>{common(titleKey)}</Title>
        <Text c="dimmed" size="sm">
          {common(subtitleKey, { name: scenario.name })}
        </Text>
      </Stack>

      {toast && (
        <Notification color={toast.color} onClose={() => setToast(null)}>
          {toast.message}
        </Notification>
      )}


      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          {resolvedTabOrder.map((tabKey) => (
            <Tabs.Tab key={tabKey} value={tabKey}>
              {tabLabels[tabKey]}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="data" pt="md">
          <Text size="sm" c="dimmed" mb="md">
            {common("settingsSectionDataMicrocopy")}
          </Text>
          <Card withBorder radius="md" padding="md" id="sync">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600}>{common("syncTitle")}</Text>
                <Text size="xs" c="dimmed">
                  {syncStatusLabel}
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                {common("syncSubtitle")}
              </Text>

              {syncToast && (
                <Notification
                  color={syncToast.color}
                  onClose={() => setSyncToast(null)}
                >
                  {syncToast.message}
                </Notification>
              )}

              {syncError && (
                <Notification color="red" onClose={() => setSyncError(null)}>
                  {syncError}
                </Notification>
              )}

              {autoSyncError && (
                <Notification color="yellow" onClose={() => setAutoSyncError(null)}>
                  {autoSyncError}
                </Notification>
              )}

              {!isFirebaseConfigured && !isSignedIn && (
                <Notification color="yellow">
                  {common("firebaseNotConfigured")}
                </Notification>
              )}

              {schemaUpgradeRequired && (
                <Notification color="yellow">
                  {errors("syncUpgradeRequired")}
                </Notification>
              )}

              {!isSignedIn && (
                <Group>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                      } catch (error) {
                        setSyncError(
                          error instanceof Error
                            ? error.message
                            : errors("signInFailed")
                        );
                      }
                    }}
                    disabled={!isFirebaseConfigured}
                  >
                    {common("signInToSync")}
                  </Button>
                  <Text size="xs" c="dimmed">
                    {common("signInHint")}
                  </Text>
                </Group>
              )}

              <Stack gap="sm">
                {hasConflict && (
                  <Notification color="orange">
                    {common("syncConflictNotice")}
                  </Notification>
                )}
                <Stack gap={4}>
                  <Switch
                    label={common("autoSyncLabel")}
                    checked={autoSyncEnabled}
                    disabled={!isSignedIn}
                    onChange={(event) =>
                      setAutoSyncEnabled(event.currentTarget.checked)
                    }
                    description={common("autoSyncDescription")}
                  />
                  <Text size="xs" c="dimmed">
                    {autoSyncStatusLabel}
                    {autoSyncDetails ? ` · ${autoSyncDetails}` : ""}
                  </Text>
                </Stack>
                {isSignedIn && (
                  <>
                    <Group wrap="wrap">
                      <Button
                        size="sm"
                        onClick={() => void handleUpload()}
                        loading={syncingAction === "upload"}
                        disabled={schemaUpgradeRequired}
                      >
                        {common("uploadLocalToCloud")}
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => void handleDownload()}
                        loading={syncingAction === "download"}
                        disabled={schemaUpgradeRequired}
                      >
                        {common("downloadCloudToLocal")}
                      </Button>
                    </Group>
                    <Divider />
                    <Group justify="space-between" align="center">
                      <Text size="sm" c="dimmed">
                        {common("signedInAs", {
                          email: authState.user?.email ?? common("googleUser"),
                        })}
                      </Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={async () => {
                          await signOutUser();
                          setCloudSummary(null);
                        }}
                      >
                        {common("signOut")}
                      </Button>
                    </Group>
                  </>
                )}
              </Stack>
            </Stack>
          </Card>

          <Modal
            opened={conflictModalOpen}
            onClose={() => setConflictModalOpen(false)}
            title={common("resolveSyncTitle")}
            centered
          >
            <Stack>
              <Text size="sm">
                {common("resolveSyncSubtitle")}
              </Text>
              <Group grow>
                <Button
                  onClick={async () => {
                    setConflictModalOpen(false);
                    await handleUpload(true);
                  }}
                >
                  {common("useLocalData")}
                </Button>
                <Button
                  variant="light"
                  onClick={async () => {
                    setConflictModalOpen(false);
                    await handleDownload(true);
                  }}
                >
                  {common("useCloudData")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Accordion variant="separated" mt="md">
            <Accordion.Item value="data-advanced">
              <Accordion.Control>{common("advancedDataManagementLabel")}</Accordion.Control>
              <Accordion.Panel>
                <DataManagementSection onNotify={showToast} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Tabs.Panel>

        <Tabs.Panel value="global" pt="md">
          <Text size="sm" c="dimmed" mb="md">
            {common("settingsSectionGlobalMicrocopy")}
          </Text>
          <Accordion variant="separated">
            <Accordion.Item value="global-advanced-how">
              <Accordion.Control>{common("advancedSettingsLabel")}</Accordion.Control>
              <Accordion.Panel>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Text fw={600}>{common("assumptionsHowTitle")}</Text>
                    <Text size="sm" c="dimmed">
                      {common("assumptionsHowLine1")}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {common("assumptionsHowLine2")}
                    </Text>
                  </Stack>
                </Card>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Card withBorder radius="md" padding="md" mt="md">
            <Stack gap="md">
              <Stack gap={6}>
                <Text fw={600}>{t("planningHorizon")}</Text>
                <SegmentedControl
                  data={horizonOptions}
                  value={horizonValue}
                  onChange={(value) => {
                    setGlobalHorizonMonths(Number(value));
                    showToast(common("saved"), "teal");
                  }}
                />
              </Stack>

              <Stack gap={6}>
                <TextInput
                  label={t("baseMonth")}
                  placeholder={common("yearMonthPlaceholder")}
                  value={baseMonthInput}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setBaseMonthInput(nextValue);
                    if (baseMonthError) {
                      setBaseMonthError(null);
                    }
                  }}
                  onBlur={() => {
                    const trimmed = baseMonthInput.trim();
                    if (trimmed === "") {
                      setGlobalBaseMonth(null);
                      setBaseMonthError(null);
                      return;
                    }
                    const normalized = normalizeMonthStrict(trimmed);
                    if (!normalized.ok) {
                      setBaseMonthError(validation("useYearMonth"));
                      return;
                    }
                    setGlobalBaseMonth(normalized.month);
                    setBaseMonthInput(normalized.month);
                    setBaseMonthError(null);
                  }}
                  error={baseMonthError ?? undefined}
                />
                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">
                    {baseMonthHelper}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setBaseMonthInput("");
                      setGlobalBaseMonth(null);
                    }}
                  >
                    {common("actionAuto")}
                  </Button>
                </Group>
              </Stack>

              <Group grow>
                <Card withBorder radius="md" padding="sm">
                  <Stack gap={4}>
                    <Text size="sm" fw={600}>
                      {t("displayModeTitle")}
                    </Text>
                    <NumberInput
                      label={t("annualInflationPctDisplayLabel")}
                      description={t("annualInflationPctDisplayHint")}
                      value={appSettings.annualInflationPct}
                      min={0}
                      step={0.1}
                      decimalScale={2}
                      onChange={(value) =>
                        setAnnualInflationPct(typeof value === "number" ? value : 0)
                      }
                    />
                    <Stack gap={4}>
                      <Text size="sm" fw={500}>
                        {t("viewModeLabel")}
                      </Text>
                      <SegmentedControl
                        data={[
                          { value: "nominal", label: t("viewNominal") },
                          { value: "real", label: t("viewReal") },
                        ]}
                        value={appSettings.viewMode}
                        onChange={(value) => setViewMode(value as "nominal" | "real")}
                      />
                      <Text size="xs" c="dimmed">
                        {t("viewRealHint")}
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md" mt="md">
            <Stack gap="md">
              <Stack gap={2}>
                <Text fw={600}>{t("scenarioAssumptionsTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("scenarioAssumptionsHint")}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("inflationRateProjectionHint")}
                </Text>
              </Stack>
              <Card withBorder radius="md" padding="sm">
                <Text size="sm" c="dimmed">
                  {t("initialCashMovedHint")}{" "}
                  <Link
                    href={buildMoneyAssetsUrl(caseId, scenario.id, { focus: "cash" })}
                  >
                    {t("initialCashMovedLink")}
                  </Link>
                </Text>
              </Card>
              <ScenarioAssumptionsOverrideForm
                values={assumptions}
                baseline={assumptions}
                impactCountByKey={impactCountByKey}
                onViewAffectedEvents={(key) => setAffectedAssumptionKey(key)}
                labels={{
                  inflationRate: t("inflationRateModelLabel"),
                  salaryGrowthRate: t("salaryGrowth"),
                  emergencyFundMonths: t("emergencyFundTarget"),
                  emergencyFundValue: (months) => t("emergencyFundValue", { months }),
                  rentAnnualGrowthPct: t("rentAnnualGrowth"),
                  propertyAppreciationPct: t("propertyAppreciation"),
                  cashYieldPct: t("cashYield"),
                  carDepreciationRatePct: t("carDepreciation"),
                  baselinePrefix: `${t("baseline")}：`,
                  impactCount: (count) => t("impactCount", { count }),
                  impactView: t("impactView"),
                  guardrailWarningTitle: t("guardrailWarningTitle"),
                  guardrailImpactText: t("guardrailImpactText"),
                  guardrailInflationOutOfComfortRange: (inflationRate) =>
                    t("guardrailInflationOutOfComfortRange", { inflationRate }),
                  guardrailSalaryInflationGapTooWide: (gap) =>
                    t("guardrailSalaryInflationGapTooWide", { gap }),
                  guardrailApplySuggestion: t("guardrailApplySuggestion"),
                  guardrailSuggestedInflation: (value) =>
                    t("guardrailSuggestedInflation", { value }),
                  guardrailSuggestedSalaryGrowth: (value) =>
                    t("guardrailSuggestedSalaryGrowth", { value }),
                }}
                onChange={handleAssumptionChange}
              />
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={handleClearOnboardingBaselineMarker}
                  disabled={!hasAppliedOnboardingBaseline}
                >
                  {t("onboardingBaselineMarkerReset")}
                </Button>
                <Button
                  variant="default"
                  onClick={() => setResetAssumptionsModalOpen(true)}
                  disabled={resetAssumptionDiffRows.length === 0}
                >
                  {t("resetDefaultsAction")}
                </Button>
              </Group>
              <Divider />
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    {t("assumptionSourceLabel")}
                  </Text>
                  <Badge color={hasAppliedOnboardingBaseline ? "teal" : "gray"}>
                    {hasAppliedOnboardingBaseline
                      ? t("assumptionSourceOnboardingBaseline")
                      : t("assumptionSourceManual")}
                  </Badge>
                </Group>
                <Group align="end" grow>
                  <Select
                    label={t("presetLabel")}
                    data={[
                      { value: "conservative", label: t("presetConservative") },
                      { value: "baseline", label: t("presetBaseline") },
                      { value: "growth", label: t("presetGrowth") },
                    ]}
                    value={selectedAssumptionPreset}
                    onChange={(value) => {
                      if (value) {
                        setSelectedAssumptionPreset(value as AssumptionsPresetKey);
                      }
                    }}
                  />
                  <Button
                    onClick={handleApplyAssumptionPreset}
                    disabled={assumptionPresetDiffRows.length === 0}
                  >
                    {t("presetApply")}
                  </Button>
                </Group>
                <Text size="sm" c="dimmed">
                  {t("presetDiffHint")}
                </Text>
                {assumptionPresetDiffRows.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("presetDiffEmpty")}
                  </Text>
                ) : (
                  <Stack gap={8}>
                    {assumptionPresetDiffRows.map((row) => (
                      <Group key={row.key} justify="space-between" wrap="wrap">
                        <Text size="sm">{impactLabelByKey[row.key]}</Text>
                        <Group gap={8}>
                          <Badge variant="light" color="gray">
                            {t("presetBeforeValue", {
                              value:
                                typeof row.beforeValue === "number"
                                  ? row.beforeValue
                                  : t("notAvailable"),
                            })}
                          </Badge>
                          <Text size="sm">→</Text>
                          <Badge variant="light" color="teal">
                            {t("presetAfterValue", {
                              value:
                                typeof row.afterValue === "number"
                                  ? row.afterValue
                                  : t("notAvailable"),
                            })}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {t("presetImpactDiff", {
                              before: row.beforeImpact,
                              after: row.afterImpact,
                            })}
                          </Text>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Card>

          <Modal
            opened={resetAssumptionsModalOpen}
            onClose={() => setResetAssumptionsModalOpen(false)}
            title={t("resetDefaultsModalTitle")}
            centered
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {t("resetDefaultsModalBody")}
              </Text>
              {resetAssumptionDiffRows.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("resetDefaultsNoDiff")}
                </Text>
              ) : (
                <Stack gap={6}>
                  {resetAssumptionDiffRows.map((row) => (
                    <Group key={row.key} justify="space-between" wrap="nowrap">
                      <Text size="sm">{impactLabelByKey[row.key]}</Text>
                      <Text size="sm" fw={600}>
                        {row.beforeValue}% → {row.afterValue}% ({row.delta > 0 ? "+" : ""}
                        {row.delta}%)
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
              <Group justify="flex-end" mt="xs">
                <Button variant="default" onClick={() => setResetAssumptionsModalOpen(false)}>
                  {common("cancel")}
                </Button>
                <Button
                  color="red"
                  onClick={handleConfirmResetAssumptions}
                  disabled={resetAssumptionDiffRows.length === 0}
                >
                  {t("resetDefaultsConfirm")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={Boolean(affectedAssumptionKey)}
            onClose={() => setAffectedAssumptionKey(null)}
            title={
              affectedAssumptionKey
                ? t("impactModalTitle", {
                    assumption: impactLabelByKey[affectedAssumptionKey],
                  })
                : undefined
            }
            centered
          >
            <Stack gap="xs">
              {affectedEntityList.length > 0 ? (
                affectedEntityList.map((entity) => (
                  <Text key={entity.id} size="sm">
                    • {entity.label}
                  </Text>
                ))
              ) : (
                <Text size="sm" c="dimmed">
                  {t("impactEmpty")}
                </Text>
              )}
            </Stack>
          </Modal>

          <Card withBorder radius="md" padding="md" mt="md">
            <ProjectionPreviewPanel
              title={t("previewTitle")}
              currency={scenario?.baseCurrency ?? "USD"}
              scope={previewScope}
              onScopeChange={setPreviewScope}
              labels={{
                month: t("previewScopeMonth"),
                twelveMonths: t("previewScope12m"),
                horizon: t("previewScopeHorizon"),
                cashBalance: t("previewCashBalance"),
                netWorth: t("previewNetWorth"),
                netCashflow: t("previewNetCashflow"),
                minCash: t("previewMinCash"),
                deficitMonths: t("previewDeficitMonths"),
                runway: t("previewRunway"),
                firstMillion: t("previewFirstMillion"),
                endMonthScope: t("previewHorizonScope"),
                notReached: t("previewNotReached"),
              }}
              currentMonth={{
                cashBalance: currentMonthCash,
                netWorth: currentMonthNetWorth,
                netCashflow: currentMonthNetCashflow,
              }}
              metrics={dashboardMetrics}
            />
          </Card>

          <Accordion variant="separated" mt="md">
            <Accordion.Item value="global-advanced-smart-invest">
              <Accordion.Control>{common("advancedSmartInvestLabel")}</Accordion.Control>
              <Accordion.Panel>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="md">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <div>
                        <Text fw={600}>{t("smartInvestSettingsTitle")}</Text>
                        <Text size="sm" c="dimmed">
                          {t("smartInvestSettingsHint")}
                        </Text>
                      </div>
                    </Group>
                    <Divider />
                    <PositionDetailList items={smartInvestSummaryItems} />
                    {!smartInvestPolicy.enabled && (
                      <Text size="sm" c="dimmed">
                        {t("smartInvestSummaryDisabled")}
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Tabs.Panel>

        <Tabs.Panel value="members" pt="md">
          <Text size="sm" c="dimmed" mb="md">
            {common("settingsSectionMembersMicrocopy")}
          </Text>
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600}>{membersText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    setSeedDefaultsOnAddMember(true);
                    setIsAddMemberModalOpen(true);
                  }}
                >
                  {membersText("addMember")}
                </Button>
              </Group>
              <Text size="sm" c="dimmed">
                {membersText("subtitle")}
              </Text>
              <Stack gap="sm">
                <Accordion
                  multiple
                  value={expandedMemberIds}
                  onChange={(value) => setExpandedMemberIds(value as string[])}
                  variant="separated"
                >
                  {members.map((member, index) => {
                    const birthMonthInput =
                      memberBirthMonthInputs[member.id] ?? member.birthMonth ?? "";
                    const birthMonthError =
                      memberBirthMonthErrors[member.id] ?? undefined;
                    const hasBirthMonth =
                      typeof member.birthMonth === "string" &&
                      isValidMonthStr(member.birthMonth);
                    const hasAgeAtBase = typeof member.ageAtBaseMonth === "number";
                    const memberBasis = birthMonthInput.trim()
                      ? "month"
                      : hasAgeAtBase
                        ? "age"
                        : "month";
                    const baseMonthValue = baseMonth;
                    const validBaseMonth =
                      baseMonthValue && isValidMonthStr(baseMonthValue)
                        ? baseMonthValue
                        : null;
                    const canCalculateAge = Boolean(validBaseMonth);
                    const baseAge =
                      canCalculateAge && (hasBirthMonth || hasAgeAtBase)
                        ? getMemberAgeYears(member, validBaseMonth!, validBaseMonth!)
                        : null;
                    const endAge =
                      canCalculateAge && horizonEndMonth && (hasBirthMonth || hasAgeAtBase)
                        ? getMemberAgeYears(member, horizonEndMonth!, validBaseMonth!)
                        : null;
                    const showAgeError = !hasBirthMonth && !hasAgeAtBase;
                    const memberBudgetRules = budgetRules.filter(
                      (rule) => rule.memberId === member.id
                    );

                    return (
                      <Accordion.Item key={member.id} value={member.id}>
                        <Accordion.Control>
                          <Group justify="space-between" align="center" wrap="wrap">
                            <Text fw={600}>
                              {member.name ||
                                membersText("memberLabel", { index: index + 1 })}
                            </Text>
                            <Badge variant="light">
                              {member.kind === "person"
                                ? membersText("kindPerson")
                                : membersText("kindPet")}
                            </Badge>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="sm">
                            <Group justify="space-between" align="center">
                              <Text fw={600}>
                                {membersText("memberLabel", { index: index + 1 })}
                              </Text>
                              <Button
                                size="xs"
                                color="red"
                                variant="light"
                                disabled={members.length <= 1}
                                onClick={() => {
                                  deleteMember(member.id);
                                  showToast(common("saved"), "teal");
                                }}
                              >
                                {membersText("removeMember")}
                              </Button>
                            </Group>
                            <Group grow>
                              <TextInput
                                label={membersText("nameLabel")}
                                value={member.name}
                                onChange={(event) =>
                                  updateMember(member.id, {
                                    name: event.currentTarget.value,
                                  })
                                }
                              />
                              <Select
                                label={membersText("kindLabel")}
                                data={[
                                  { value: "person", label: membersText("kindPerson") },
                                  { value: "pet", label: membersText("kindPet") },
                                ]}
                                value={member.kind}
                                onChange={(value) => {
                                  if (!value) {
                                    return;
                                  }
                                  updateMember(member.id, {
                                    kind: value as typeof member.kind,
                                  });
                                }}
                              />
                            </Group>
                            <Stack gap="xs">
                              <DateOrAgeBasisPicker
                                value={memberBasis}
                                onChange={(value) => {
                                  if (value === "month") {
                                    updateMember(member.id, { ageAtBaseMonth: undefined });
                                  } else {
                                    updateMember(member.id, {
                                      birthMonth: undefined,
                                      ageAtBaseMonth: member.ageAtBaseMonth ?? 0,
                                    });
                                    setMemberBirthMonthInputs((current) => ({
                                      ...current,
                                      [member.id]: "",
                                    }));
                                    setMemberBirthMonthErrors((current) => ({
                                      ...current,
                                      [member.id]: null,
                                    }));
                                  }
                                }}
                                monthLabel={membersText("basisMonth")}
                                ageLabel={membersText("basisAge")}
                              />
                              <Group grow>
                                {memberBasis === "month" ? (
                                  <TextInput
                                    label={membersText("birthMonthLabel")}
                                    placeholder={common("yearMonthPlaceholder")}
                                    value={birthMonthInput}
                                    error={birthMonthError}
                                    onChange={(event) => {
                                      const nextValue = event.currentTarget.value;
                                      setMemberBirthMonthInputs((current) => ({
                                        ...current,
                                        [member.id]: nextValue,
                                      }));
                                      setMemberBirthMonthErrors((current) => ({
                                        ...current,
                                        [member.id]: null,
                                      }));
                                    }}
                                    onBlur={() => {
                                      const trimmed = birthMonthInput.trim();
                                      if (trimmed === "") {
                                        updateMember(member.id, { birthMonth: undefined });
                                        setMemberBirthMonthErrors((current) => ({
                                          ...current,
                                          [member.id]: null,
                                        }));
                                        setMemberBirthMonthInputs((current) => ({
                                          ...current,
                                          [member.id]: "",
                                        }));
                                        return;
                                      }
                                      const normalized = normalizeMonthStrict(trimmed);
                                      if (!normalized.ok) {
                                        setMemberBirthMonthErrors((current) => ({
                                          ...current,
                                          [member.id]: validation("useYearMonth"),
                                        }));
                                        return;
                                      }
                                      updateMember(member.id, {
                                        birthMonth: normalized.month,
                                      });
                                      setMemberBirthMonthErrors((current) => ({
                                        ...current,
                                        [member.id]: null,
                                      }));
                                      setMemberBirthMonthInputs((current) => ({
                                        ...current,
                                        [member.id]: normalized.month,
                                      }));
                                    }}
                                  />
                                ) : (
                                  <NumberInput
                                    label={membersText("ageAtBaseLabel")}
                                    value={member.ageAtBaseMonth ?? ""}
                                    min={0}
                                    step={0.5}
                                    decimalScale={2}
                                    onChange={(value) =>
                                      updateMember(member.id, {
                                        ageAtBaseMonth:
                                          typeof value === "number" ? value : undefined,
                                      })
                                    }
                                  />
                                )}
                              </Group>
                            </Stack>
                            {showAgeError && (
                              <Text size="xs" c="red">
                                {membersText("ageRequired")}
                              </Text>
                            )}
                            <Group gap="xl" wrap="wrap">
                              <Text size="sm" c="dimmed">
                                {membersText("baseAgeLabel")}:{" "}
                                {baseAge === null
                                  ? t("notAvailable")
                                  : formatAgeYears(baseAge)}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {membersText("endAgeLabel")}:{" "}
                                {endAge === null
                                  ? t("notAvailable")
                                  : formatAgeYears(endAge)}
                              </Text>
                            </Group>
                            <Stack gap="xs" display={"none"}>
                              <Group justify="space-between" align="center">
                                <Text fw={600}>
                                  {membersText("memberBudgetTitle")}
                                </Text>
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => {
                                    const nextId = createBudgetRuleForMember(member.id);
                                    setActiveTab("budget");
                                    setExpandedBudgetRuleId(nextId);
                                  }}
                                >
                                  {membersText("addMemberRule")}
                                </Button>
                              </Group>
                              {memberBudgetRules.length === 0 ? (
                                <Text size="xs" c="dimmed">
                                  {membersText("memberBudgetEmpty")}
                                </Text>
                              ) : (
                                <Stack gap="xs">
                                  {memberBudgetRules.map((rule) => (
                                    <Card
                                      key={rule.id}
                                      withBorder
                                      radius="md"
                                      padding="sm"
                                    >
                                      <Group
                                        justify="space-between"
                                        align="center"
                                        wrap="wrap"
                                      >
                                        <Stack gap={2}>
                                          <Text fw={500}>{rule.name}</Text>
                                          <Text size="xs" c="dimmed">
                                            {budgetCategoryLabels[rule.category] ??
                                              rule.category}
                                          </Text>
                                        </Stack>
                                        <Group gap="xs" align="center">
                                          <Text size="sm">
                                            {formatCurrency(
                                              -Math.abs(rule.monthlyAmount ?? 0)
                                            )}
                                          </Text>
                                          <Button
                                            size="xs"
                                            variant="light"
                                            onClick={() => {
                                              setActiveTab("budget");
                                              setExpandedBudgetRuleId(rule.id);
                                            }}
                                          >
                                            {common("actionEdit")}
                                          </Button>
                                        </Group>
                                      </Group>
                                    </Card>
                                  ))}
                                </Stack>
                              )}
                            </Stack>
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
                <Card withBorder radius="md" padding="md" display={"none"}>
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Text fw={600}>{membersText("householdBudgetTitle")}</Text>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          const nextId = createBudgetRuleForMember(undefined);
                          setActiveTab("budget");
                          setExpandedBudgetRuleId(nextId);
                        }}
                      >
                        {membersText("addHouseholdRule")}
                      </Button>
                    </Group>
                    {householdBudgetRules.length === 0 ? (
                      <Text size="xs" c="dimmed">
                        {membersText("householdBudgetEmpty")}
                      </Text>
                    ) : (
                      <Stack gap="xs">
                        {householdBudgetRules.map((rule) => (
                          <Card key={rule.id} withBorder radius="md" padding="sm">
                            <Group justify="space-between" align="center" wrap="wrap">
                              <Stack gap={2}>
                                <Text fw={500}>{rule.name}</Text>
                                <Text size="xs" c="dimmed">
                                  {budgetCategoryLabels[rule.category] ?? rule.category}
                                </Text>
                              </Stack>
                              <Group gap="xs" align="center">
                                <Text size="sm">
                                  {formatCurrency(-Math.abs(rule.monthlyAmount ?? 0))}
                                </Text>
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => {
                                    setActiveTab("budget");
                                    setExpandedBudgetRuleId(rule.id);
                                  }}
                                >
                                  {common("actionEdit")}
                                </Button>
                              </Group>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Stack>
          </Card>
          <Modal
            opened={isAddMemberModalOpen}
            onClose={() => setIsAddMemberModalOpen(false)}
            title={membersText("addMember")}
            centered
          >
            <Stack>
              <Switch
                checked={seedDefaultsOnAddMember}
                onChange={(event) => setSeedDefaultsOnAddMember(event.currentTarget.checked)}
                label={membersText("seedDefaultsLabel")}
              />
              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={() => setIsAddMemberModalOpen(false)}
                >
                  {common("cancel")}
                </Button>
                <Button
                  onClick={() => {
                    setIsAddMemberModalOpen(false);
                    handleAddMember();
                  }}
                >
                  {membersText("addMember")}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="budget" pt="md">
          <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{budgetText("title")}</Text>
            <Button size="xs" variant="light" onClick={handleCreateBudgetRule}>
              {budgetText("addRule")}
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {budgetText("subtitle")}
          </Text>
          <Switch
            checked={includeBudgetRulesInProjection}
            label={budgetText("includeInProjection")}
            onChange={(event) =>
              updateScenarioAssumptions(scenario.id, {
                includeBudgetRulesInProjection: event.currentTarget.checked,
              })
            }
          />
          {includeBudgetRulesInProjection && (
            <Notification color="yellow" withCloseButton={false}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Text size="sm">{budgetText("projectionWarning")}</Text>
                {hasExpenseEvents && (
                  <Badge color="yellow" variant="light">
                    {budgetText("projectionWarningBadge")}
                  </Badge>
                )}
              </Group>
            </Notification>
          )}
          {hasHousingRules && (
            <Notification color="red" withCloseButton={false}>
              <Text size="sm">{budgetText("housingWarning")}</Text>
            </Notification>
          )}
          {budgetRules.length === 0 ? (
            <Text size="sm" c="dimmed">
              {budgetText("empty")}
            </Text>
          ) : (
            <Accordion
              value={expandedBudgetRuleId}
              onChange={(value) => setExpandedBudgetRuleId(value)}
              variant="separated"
            >
              {budgetRules.map((rule) => {
                const preview = rule.id === expandedRule?.id ? expandedRulePreview : [];
                const previewSlice = preview.slice(0, 12);
                const previewTotal = preview.reduce(
                  (total, entry) => total + entry.amount,
                  0
                );
                const previewWindow = preview.slice(0, Math.min(preview.length, 24));
                const memberLabel = rule.memberId
                  ? members.find((member) => member.id === rule.memberId)?.name ??
                    budgetText("memberHousehold")
                  : budgetText("memberHousehold");
                const categoryLabel =
                  budgetCategoryLabels[rule.category] ?? rule.category;
                const applyScopeLabel = formatApplyScopeLabel(rule.applyScope);

                return (
                  <Accordion.Item key={rule.id} value={rule.id}>
                    <Accordion.Control>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Stack gap={4}>
                          <Group gap="xs" align="center">
                            <Text fw={600}>{rule.name}</Text>
                            {!rule.enabled && (
                              <Badge color="gray" variant="light">
                                {common("disabled")}
                              </Badge>
                            )}
                          </Group>
                          <Group gap="xs" wrap="wrap">
                            <Badge variant="light">{memberLabel}</Badge>
                            <Badge variant="light">{categoryLabel}</Badge>
                            <Badge variant="light">
                              {budgetText("ageBandSummary", {
                                from: formatAgeYears(rule.ageBand.fromYears),
                                to: formatAgeYears(rule.ageBand.toYears),
                              })}
                            </Badge>
                            <Badge variant="light">{applyScopeLabel}</Badge>
                          </Group>
                        </Stack>
                        <Group
                          gap="sm"
                          wrap="wrap"
                          align="center"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Text fw={600}>
                            {formatCurrency(-Math.abs(rule.monthlyAmount ?? 0))}
                          </Text>
                          <Switch
                            checked={rule.enabled}
                            label={budgetText("enabledLabel")}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateBudgetRule(rule.id, {
                                enabled: event.currentTarget.checked,
                              })
                            }
                          />
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeBudgetRule(rule.id);
                              showToast(common("saved"), "teal");
                            }}
                          >
                            {budgetText("removeRule")}
                          </Button>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="sm">
                        <Card withBorder radius="md" padding="sm">
                          <Stack gap="xs">
                            <Group justify="space-between" align="center">
                              <Text fw={600} size="sm">
                                {budgetText("previewTitle")}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {budgetText("previewTotal", {
                                  total: formatCurrency(previewTotal),
                                })}
                              </Text>
                            </Group>
                            {previewWindow.length === 0 ? (
                              <Text size="sm" c="dimmed">
                                {budgetText("previewEmpty")}
                              </Text>
                            ) : (
                              <div style={{ width: "100%", height: 180 }}>
                                <ResponsiveContainer>
                                  <LineChart data={previewWindow}>
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                    <YAxis
                                      tick={{ fontSize: 10 }}
                                      width={72}
                                      tickFormatter={(value) =>
                                        formatCurrency(Number(value))
                                      }
                                    />
                                    <ChartTooltip
                                      formatter={(value) =>
                                        formatCurrency(Number(value))
                                      }
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="amount"
                                      stroke="var(--mantine-color-red-6)"
                                      strokeWidth={2}
                                      dot={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </Stack>
                        </Card>
                        <Group grow>
                          <TextInput
                            label={budgetText("nameLabel")}
                            value={rule.name}
                            onChange={(event) =>
                              updateBudgetRule(rule.id, {
                                name: event.currentTarget.value,
                              })
                            }
                          />
                          <Select
                            label={budgetText("memberLabel")}
                            data={[
                              { value: "household", label: budgetText("memberHousehold") },
                              ...members.map((member) => ({
                                value: member.id,
                                label: member.name,
                              })),
                            ]}
                            value={rule.memberId ?? "household"}
                            onChange={(value) => {
                              updateBudgetRule(rule.id, {
                                memberId:
                                  value && value !== "household" ? value : undefined,
                              });
                              if (!value || value === "household") {
                                setBudgetRuleBasis((current) => ({
                                  ...current,
                                  [rule.id]: "month",
                                }));
                                if (!rule.startMonth?.trim()) {
                                  updateBudgetRule(rule.id, { startMonth: baseMonth ?? "" });
                                  updateBudgetMonthInput(
                                    rule.id,
                                    "startMonth",
                                    baseMonth ?? ""
                                  );
                                }
                              }
                            }}
                          />
                        </Group>
                        <Group grow>
                          <Select
                            label={budgetText("categoryLabel")}
                            data={[
                              { value: "health", label: budgetText("categoryHealth") },
                              {
                                value: "childcare",
                                label: budgetText("categoryChildcare"),
                              },
                              {
                                value: "education",
                                label: budgetText("categoryEducation"),
                              },
                              {
                                value: "eldercare",
                                label: budgetText("categoryEldercare"),
                              },
                              { value: "petcare", label: budgetText("categoryPetcare") },
                            ]}
                            value={rule.category}
                            onChange={(value) => {
                              if (!value) {
                                return;
                              }
                              updateBudgetRule(rule.id, {
                                category: value as typeof rule.category,
                              });
                            }}
                          />
                          <NumberInput
                            label={budgetText("monthlyAmountLabel")}
                            value={rule.monthlyAmount}
                            min={0}
                            step={100}
                            thousandSeparator=","
                            onChange={(value) =>
                              updateBudgetRule(rule.id, {
                                monthlyAmount: typeof value === "number" ? value : 0,
                              })
                            }
                          />
                        </Group>
                        {(() => {
                          const hasMember = Boolean(rule.memberId);
                          const disableAge = !hasMember;
                          const basis = disableAge
                            ? "month"
                            : budgetRuleBasis[rule.id] ??
                              (rule.startMonth?.trim() || rule.endMonth?.trim()
                                ? "month"
                                : "age");

                          return (
                            <>
                              <DateOrAgeBasisPicker
                                value={disableAge ? "month" : basis}
                                onChange={(value) => {
                                  setBudgetRuleBasis((current) => ({
                                    ...current,
                                    [rule.id]: value,
                                  }));
                                  if (value === "age") {
                                    updateBudgetRule(rule.id, {
                                      startMonth: undefined,
                                      endMonth: undefined,
                                    });
                                    updateBudgetMonthInput(rule.id, "startMonth", "");
                                    updateBudgetMonthInput(rule.id, "endMonth", "");
                                    setBudgetMonthErrors((current) => ({
                                      ...current,
                                      [rule.id]: {},
                                    }));
                                  } else {
                                    updateBudgetRule(rule.id, {
                                      startMonth:
                                        rule.startMonth?.trim() ||
                                        baseMonth ||
                                        rule.startMonth,
                                    });
                                    updateBudgetMonthInput(
                                      rule.id,
                                      "startMonth",
                                      rule.startMonth?.trim() || baseMonth || ""
                                    );
                                  }
                                }}
                                monthLabel={budgetText("basisMonth")}
                                ageLabel={budgetText("basisAge")}
                                disableAge={disableAge}
                              />
                              {disableAge && (
                                <Text size="xs" c="dimmed">
                                  {budgetText("basisAgeDisabled")}
                                </Text>
                              )}
                              <Group grow>
                                {disableAge || basis === "month" ? (
                                  <>
                                    <TextInput
                                      label={budgetText("startMonthLabel")}
                                      placeholder={common("yearMonthOptionalPlaceholder")}
                                      value={
                                        budgetMonthInputs[rule.id]?.startMonth ??
                                        rule.startMonth ??
                                        ""
                                      }
                                      onChange={(event) =>
                                        updateBudgetMonthInput(
                                          rule.id,
                                          "startMonth",
                                          event.currentTarget.value
                                        )
                                      }
                                      onBlur={() =>
                                        validateBudgetMonth(rule.id, "startMonth")
                                      }
                                      error={budgetMonthErrors[rule.id]?.startMonth}
                                    />
                                    <TextInput
                                      label={budgetText("endMonthLabel")}
                                      placeholder={common("yearMonthOptionalPlaceholder")}
                                      value={
                                        budgetMonthInputs[rule.id]?.endMonth ??
                                        rule.endMonth ??
                                        ""
                                      }
                                      onChange={(event) =>
                                        updateBudgetMonthInput(
                                          rule.id,
                                          "endMonth",
                                          event.currentTarget.value
                                        )
                                      }
                                      onBlur={() =>
                                        validateBudgetMonth(rule.id, "endMonth")
                                      }
                                      error={budgetMonthErrors[rule.id]?.endMonth}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <NumberInput
                                      label={budgetText("ageFromLabel")}
                                      value={rule.ageBand.fromYears}
                                      min={0}
                                      step={0.5}
                                      decimalScale={2}
                                      onChange={(value) =>
                                        updateBudgetRule(rule.id, {
                                          ageBand: {
                                            ...rule.ageBand,
                                            fromYears:
                                              typeof value === "number" ? value : 0,
                                          },
                                        })
                                      }
                                    />
                                    <NumberInput
                                      label={budgetText("ageToLabel")}
                                      value={rule.ageBand.toYears}
                                      min={0}
                                      step={0.5}
                                      decimalScale={2}
                                      onChange={(value) =>
                                        updateBudgetRule(rule.id, {
                                          ageBand: {
                                            ...rule.ageBand,
                                            toYears:
                                              typeof value === "number" ? value : 0,
                                          },
                                        })
                                      }
                                    />
                                  </>
                                )}
                              </Group>
                              {!disableAge && basis === "age" && (
                                <Text size="xs" c="dimmed">
                                  {budgetText("ageBandHelper")}
                                </Text>
                              )}
                              <Group grow>
                                <NumberInput
                                  label={budgetText("annualGrowthLabel")}
                                  value={rule.annualGrowthPct ?? ""}
                                  min={0}
                                  step={0.1}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    updateBudgetRule(rule.id, {
                                      annualGrowthPct:
                                        typeof value === "number" ? value : undefined,
                                    })
                                  }
                                />
                              </Group>
                            </>
                          );
                        })()}
                        <Stack gap="xs">
                          <Text fw={600}>{budgetText("applyScopeTitle")}</Text>
                          <Text size="xs" c="dimmed">
                            {budgetText("applyScopeHelper")}
                          </Text>
                          {renderApplyScope(
                            normalizeApplyScope(rule.applyScope),
                            (next) => updateBudgetRule(rule.id, { applyScope: next }),
                            budgetText("applyScopeHint")
                          )}
                        </Stack>
                        {previewSlice.length > 0 && (
                          <Stack gap={2}>
                            {previewSlice.map((entry) => (
                              <Text key={`${rule.id}-${entry.month}`} size="sm">
                                {entry.month} · {formatCurrency(entry.amount)}
                              </Text>
                            ))}
                            {preview.length > previewSlice.length && (
                              <Text size="xs" c="dimmed">
                                {budgetText("previewMore", {
                                  count: preview.length - previewSlice.length,
                                })}
                              </Text>
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="other" pt="md">
          <Text size="sm" c="dimmed" mb="md">
            {common("settingsSectionOtherMicrocopy")}
          </Text>
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t("otherSettingsHint")}
              </Text>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Card withBorder radius="md" padding="md" style={{ position: "sticky", bottom: 12, zIndex: 5 }}>
        <Stack gap="xs">
          <Text fw={600}>{common("settingsReviewActionsTitle")}</Text>
          <Text size="sm" c="dimmed">
            {common("settingsReviewActionsSubtitle")}
          </Text>
          <Group>
            <Button component={Link} href={scenarioDashboardPath(caseId, scenario.id)}>
              {common("openOverview")}
            </Button>
            <Button
              component={Link}
              href={`${scenarioMoneyPath(caseId, scenario.id)}?tab=timeline`}
              variant="light"
            >
              {common("openTimeline")}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
