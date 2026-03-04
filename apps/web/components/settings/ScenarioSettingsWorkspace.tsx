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
  Select,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  SimpleGrid,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useScenarioContext } from "../../src/hooks/useScenarioContext";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
  createMemberId,
  type MemberMilestone,
  type ScenarioMember,
  type ScenarioMemberKind,
} from "../../src/store/scenarioStore";
import { type ApplyScope } from "../../src/domain/applyScope";
import { buildMoneyAssetsUrl } from "../../src/utils/scenarioContext";
import ScenarioAssumptionsOverrideForm from "../ScenarioAssumptionsOverrideForm";
import type { ScenarioAssumptionsOverride } from "../ScenarioAssumptionsOverrideForm";
import { Link } from "../../src/i18n/navigation";
import { buildMonthRange } from "@north-star/engine";
import MoneyMetaTags from "../../src/features/money/MoneyMetaTags";
import { buildMoneyMetaTagViewModel } from "../../src/features/money/moneyMetaTagViewModel";
import { getMemberAgeYears } from "../../src/domain/members/age";
import { isValidMonthStr, normalizeMonthStrict } from "../../src/utils/month";
import DataManagementSection from "../DataManagementSection";
import DateOrAgeBasisPicker from "../DateOrAgeBasisPicker";
import PositionDetailList from "../timeline/PositionDetailList";
import {
  buildMemberAssignableEventViews,
} from "../../src/domain/events/utils";
import { getEventMeta } from "../../src/events/eventCatalog";
import { buildDefaultSmartInvestPolicy } from "../../src/domain/smartInvest/defaultPolicy";
import {
  DEFAULT_PLANNING_HORIZON_YEARS,
  PLANNING_HORIZON_YEARS,
  resolvePlanningHorizonMonths,
} from "../../src/domain/assumptions/planningHorizon";
import { useProjectionWithLedger } from "../../src/engine/useProjectionWithLedger";
import { scenarioDashboardPath, scenarioMoneyPath } from "../../lib/routes/appRoutes";
import { computeDashboardMetrics } from "../../src/domain/dashboard/metrics";
import ProjectionPreviewPanel, { type PreviewScope } from "../ProjectionPreviewPanel";
import {
  analyzeAssumptionImpact,
  type AssumptionImpactKey,
} from "../../src/domain/assumptions/impactAnalyzer";
import { buildOnboardingAssumptionsDraft } from "../../src/domain/onboarding/v2/assumptions";
import {
  buildOnboardingAssumptionsAutoFillPatch,
  getOnboardingAssumptionsAutoApplyFlagKey,
  shouldAutoApplyOnboardingAssumptions,
} from "../../src/domain/assumptions/onboardingAutoApply";

type SettingsTabKey = "assumptions" | "members" | "persistence";

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
  actionLabel?: string;
  actionHref?: string;
};

type AssumptionsEditSection =
  | "planningHorizon"
  | "baseMonth"
  | "displayMode"
  | "modelAssumptions";

type AssumptionPresetKey = "baseline" | "conservative" | "growth";

type AddMemberDraftBasis = "month" | "age";

export type AddMemberDraft = {
  name: string;
  kind: ScenarioMemberKind;
  basis: AddMemberDraftBasis;
  birthMonth: string;
  ageAtBaseMonth: string;
};

type AddMemberPersistenceActions = {
  createMember: (member: ReturnType<typeof buildMemberFromAddDraft>) => void;
  createBudgetRule?: (...args: unknown[]) => void;
  upsertEventDefinition?: (...args: unknown[]) => void;
  upsertScenarioEventRef?: (...args: unknown[]) => void;
};

type AddMemberDraftValidationState = {
  name: string | null;
  birthMonth: string | null;
  ageAtBaseMonth: string | null;
};

type AddMemberDraftValidationMessages = {
  requiredName: string;
  requiredAgeOrMonth: string;
  invalidMonth: string;
};

type MemberEditModalProps = {
  opened: boolean;
  draft: AddMemberDraft;
  validationState: AddMemberDraftValidationState;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onDraftChange: (patch: Partial<AddMemberDraft>) => void;
  onValidationStateChange: (patch: Partial<AddMemberDraftValidationState>) => void;
  membersText: ReturnType<typeof useTranslations<"members">>;
  common: ReturnType<typeof useTranslations<"common">>;
  validation: ReturnType<typeof useTranslations<"validation">>;
};

export const validateAddMemberDraft = (
  draft: AddMemberDraft,
  messages: AddMemberDraftValidationMessages
): { errors: AddMemberDraftValidationState; isValid: boolean } => {
  const errors: AddMemberDraftValidationState = {
    name: null,
    birthMonth: null,
    ageAtBaseMonth: null,
  };

  if (draft.name.trim().length === 0) {
    errors.name = messages.requiredName;
  }

  if (draft.basis === "month") {
    const value = draft.birthMonth.trim();
    if (value.length === 0) {
      errors.birthMonth = messages.requiredAgeOrMonth;
    } else if (!isValidMonthStr(value)) {
      errors.birthMonth = messages.invalidMonth;
    }
  }

  if (draft.basis === "age") {
    const rawAge = draft.ageAtBaseMonth.trim();
    if (rawAge.length === 0) {
      errors.ageAtBaseMonth = messages.requiredAgeOrMonth;
    } else {
      const parsedAge = Number(rawAge);
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        errors.ageAtBaseMonth = messages.requiredAgeOrMonth;
      }
    }
  }

  return {
    errors,
    isValid: !errors.name && !errors.birthMonth && !errors.ageAtBaseMonth,
  };
};

const createDefaultAddMemberDraft = (): AddMemberDraft => ({
  name: "",
  kind: "person",
  basis: "month",
  birthMonth: "",
  ageAtBaseMonth: "",
});

const buildAddMemberDraftFromMember = (member: ScenarioMember): AddMemberDraft => {
  const hasBirthMonth = typeof member.birthMonth === "string" && member.birthMonth.length > 0;
  return {
    name: member.name,
    kind: member.kind,
    basis: hasBirthMonth ? "month" : "age",
    birthMonth: member.birthMonth ?? "",
    ageAtBaseMonth:
      typeof member.ageAtBaseMonth === "number" ? String(member.ageAtBaseMonth) : "",
  };
};

const MemberDraftFormFields = ({
  draft,
  validationState,
  onDraftChange,
  onValidationStateChange,
  membersText,
  common,
  validation,
}: Pick<
  MemberEditModalProps,
  | "draft"
  | "validationState"
  | "onDraftChange"
  | "onValidationStateChange"
  | "membersText"
  | "common"
  | "validation"
>) => (
  <>
    <TextInput
      label={membersText("addMemberNameLabel")}
      placeholder={membersText("addMemberNamePlaceholder")}
      value={draft.name}
      error={validationState.name}
      onChange={(event) => {
        onDraftChange({ name: event.currentTarget.value });
        onValidationStateChange({ name: null });
      }}
    />
    <Select
      label={membersText("addMemberKindLabel")}
      data={[
        { value: "person", label: membersText("kindPerson") },
        { value: "pet", label: membersText("kindPet") },
      ]}
      value={draft.kind}
      onChange={(value) => {
        if (!value) {
          return;
        }
        onDraftChange({ kind: value as ScenarioMemberKind });
      }}
    />
    <DateOrAgeBasisPicker
      value={draft.basis}
      onChange={(value) => {
        onDraftChange({ basis: value });
        onValidationStateChange({ birthMonth: null, ageAtBaseMonth: null });
      }}
      monthLabel={membersText("basisMonth")}
      ageLabel={membersText("basisAge")}
    />
    {draft.basis === "month" ? (
      <TextInput
        label={membersText("addMemberBirthMonthLabel")}
        placeholder={common("yearMonthPlaceholder")}
        description={membersText("addMemberBirthMonthHint")}
        value={draft.birthMonth}
        error={validationState.birthMonth}
        onChange={(event) => {
          onDraftChange({ birthMonth: event.currentTarget.value });
          onValidationStateChange({ birthMonth: null });
        }}
        onBlur={() => {
          const trimmed = draft.birthMonth.trim();
          if (!trimmed) {
            return;
          }
          const normalized = normalizeMonthStrict(trimmed);
          if (!normalized.ok) {
            onValidationStateChange({ birthMonth: validation("useYearMonth") });
            return;
          }
          onDraftChange({ birthMonth: normalized.month });
        }}
      />
    ) : (
      <NumberInput
        label={membersText("addMemberAgeAtBaseMonthLabel")}
        description={membersText("addMemberAgeAtBaseMonthHint")}
        min={0}
        value={draft.ageAtBaseMonth === "" ? "" : Number(draft.ageAtBaseMonth)}
        error={validationState.ageAtBaseMonth}
        onChange={(value) => {
          onDraftChange({
            ageAtBaseMonth:
              typeof value === "number" && Number.isFinite(value) ? String(value) : "",
          });
          onValidationStateChange({ ageAtBaseMonth: null });
        }}
      />
    )}
  </>
);

const EditMemberModal = ({
  opened,
  draft,
  validationState,
  onClose,
  onSave,
  onDelete,
  onDraftChange,
  onValidationStateChange,
  membersText,
  common,
  validation,
}: MemberEditModalProps) => (
  <Modal opened={opened} onClose={onClose} title={membersText("editMember")} centered>
    <Stack>
      <MemberDraftFormFields
        draft={draft}
        validationState={validationState}
        onDraftChange={onDraftChange}
        onValidationStateChange={onValidationStateChange}
        membersText={membersText}
        common={common}
        validation={validation}
      />
      <Group justify="space-between">
        <Button
          size="xs"
          color="red"
          variant="light"
          onClick={onDelete}
          disabled={!onDelete}
        >
          {membersText("removeMember")}
        </Button>
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            {membersText("discardChanges")}
          </Button>
          <Button onClick={onSave}>{membersText("saveMember")}</Button>
        </Group>
      </Group>
    </Stack>
  </Modal>
);

export const buildMemberFromAddDraft = (
  draft: AddMemberDraft,
  options: {
    createId: () => string;
    buildDefaultMilestones: (kind: ScenarioMemberKind) => MemberMilestone[];
  }
) => ({
  ...(draft.basis === "month"
    ? (() => {
        const normalizedBirthMonth = normalizeMonthStrict(draft.birthMonth.trim());
        return {
          birthMonth: normalizedBirthMonth.ok ? normalizedBirthMonth.month : undefined,
        };
      })()
    : { birthMonth: undefined }),
  id: options.createId(),
  name: draft.name.trim(),
  kind: draft.kind,
  ageAtBaseMonth:
    draft.basis === "age" && draft.ageAtBaseMonth.trim().length > 0
      ? Number(draft.ageAtBaseMonth.trim())
      : undefined,
  applyScope: { scope: "all" } as ApplyScope,
  milestones: options.buildDefaultMilestones(draft.kind),
});


export const buildMemberPatchFromDraft = (
  draft: AddMemberDraft
): Pick<ScenarioMember, "name" | "kind" | "birthMonth" | "ageAtBaseMonth"> => {
  const normalizedBirthMonth = normalizeMonthStrict(draft.birthMonth.trim());
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    birthMonth:
      draft.basis === "month" && normalizedBirthMonth.ok
        ? normalizedBirthMonth.month
        : undefined,
    ageAtBaseMonth:
      draft.basis === "age" && draft.ageAtBaseMonth.trim().length > 0
        ? Number(draft.ageAtBaseMonth.trim())
        : undefined,
  };
};
export const persistNewMember = (
  newMember: ReturnType<typeof buildMemberFromAddDraft>,
  actions: AddMemberPersistenceActions
) => {
  actions.createMember(newMember);
};

export default function ScenarioSettingsWorkspace({
  scenarioId,
  titleKey = "settingsTitle",
  subtitleKey = "settingsSubtitle",
  defaultTab = "assumptions",
  tabOrder,
}: ScenarioSettingsWorkspaceProps) {
  const locale = useLocale();
  const t = useTranslations("assumptions");
  const membersText = useTranslations("members");
  const common = useTranslations("common");
  const timelineText = useTranslations("timeline");
  const validation = useTranslations("validation");
  const horizonOptions = PLANNING_HORIZON_YEARS.map((years) => ({
    value: String(resolvePlanningHorizonMonths(years)),
    label: t(`horizonYears${years}`),
  }));
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const [previewScope, setPreviewScope] = useState<PreviewScope>("12m");
  const [activeAssumptionModal, setActiveAssumptionModal] =
    useState<AssumptionsEditSection | null>(null);
  const [discardConfirmModalOpen, setDiscardConfirmModalOpen] = useState(false);
  const [horizonDraftValue, setHorizonDraftValue] = useState("");
  const [baseMonthDraftInput, setBaseMonthDraftInput] = useState("");
  const [baseMonthDraftError, setBaseMonthDraftError] = useState<string | null>(null);
  const [displayDraft, setDisplayDraft] = useState({
    annualInflationPct: 0,
    viewMode: "nominal" as "nominal" | "real",
  });
  const [assumptionsDraft, setAssumptionsDraft] =
    useState<ScenarioAssumptionsOverride | null>(null);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberDraft, setEditMemberDraft] = useState<AddMemberDraft>(
    createDefaultAddMemberDraft
  );
  const [editMemberDraftValidation, setEditMemberDraftValidation] =
    useState<AddMemberDraftValidationState>({
      name: null,
      birthMonth: null,
      ageAtBaseMonth: null,
    });
  const resolvedTabOrder = useMemo<SettingsTabKey[]>(
    () => (tabOrder ?? ["assumptions", "members", "persistence"]) as SettingsTabKey[],
    [tabOrder]
  );
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(defaultTab);
  const tabLabels: Record<SettingsTabKey, string> = useMemo(
    () => ({
      assumptions: common("settingsTabAssumptionsAction"),
      members: common("settingsTabMembersAction"),
      persistence: common("settingsTabPersistenceAction"),
    }),
    [common]
  );
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberDraft, setAddMemberDraft] = useState<AddMemberDraft>(
    createDefaultAddMemberDraft
  );
  const [addMemberDraftValidation, setAddMemberDraftValidation] =
    useState<AddMemberDraftValidationState>({
      name: null,
      birthMonth: null,
      ageAtBaseMonth: null,
    });
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [affectedAssumptionKey, setAffectedAssumptionKey] = useState<
    keyof ScenarioAssumptionsOverride | null
  >(null);
  const [resetAssumptionsModalOpen, setResetAssumptionsModalOpen] = useState(false);
  const [assumptionPresetModalOpen, setAssumptionPresetModalOpen] = useState(false);
  const [hasAppliedOnboardingBaseline, setHasAppliedOnboardingBaseline] =
    useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAppliedScenarioIdsRef = useRef<Set<string>>(new Set());

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
    const legacyHashMap: Record<string, SettingsTabKey> = {
      global: "assumptions",
      data: "persistence",
      other: "persistence",
      budget: "persistence",
      settings: "persistence",
    };
    const resolvedHash = (legacyHashMap[hash] ?? hash) as SettingsTabKey;
    if (resolvedTabOrder.includes(resolvedHash)) {
      setActiveTab(resolvedHash);
    }
  }, [resolvedTabOrder]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const search = new URLSearchParams(window.location.search);
    setFocusEventId(search.get("focusEventId"));
  }, []);

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
  const assumptions = scenario?.assumptions;
  const defaultSmartInvestPolicy = useMemo(
    () => buildDefaultSmartInvestPolicy(t("smartInvestDefaultAllocation")),
    [t]
  );
  const smartInvestPolicy = assumptions?.smartInvest ?? defaultSmartInvestPolicy;
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
    setHorizonDraftValue(String(appSettings.globalHorizonMonths));
  }, [appSettings.globalHorizonMonths]);

  useEffect(() => {
    setBaseMonthDraftInput(appSettings.globalBaseMonth ?? "");
    setBaseMonthDraftError(null);
  }, [appSettings.globalBaseMonth]);

  useEffect(() => {
    setDisplayDraft({
      annualInflationPct: appSettings.annualInflationPct,
      viewMode: appSettings.viewMode,
    });
  }, [appSettings.annualInflationPct, appSettings.viewMode]);

  useEffect(() => {
    if (!scenario) {
      setAssumptionsDraft(null);
      return;
    }
    setAssumptionsDraft({
      inflationRate: scenario.assumptions?.inflationRate,
      salaryGrowthRate: scenario.assumptions?.salaryGrowthRate,
      emergencyFundMonths: scenario.assumptions?.emergencyFundMonths,
      rentAnnualGrowthPct: scenario.assumptions?.rentAnnualGrowthPct,
      propertyAppreciationPct: scenario.assumptions?.propertyAppreciationPct,
      cashYieldPct: scenario.assumptions?.cashYieldPct,
      carDepreciationRatePct: scenario.assumptions?.carDepreciationRatePct,
    });
  }, [scenario]);


  const showToast = useCallback(
    (
      message: string,
      color?: string,
      options?: { actionLabel?: string; actionHref?: string }
    ) => {
      setToast({ message, color, ...options });
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 2000);
    },
    []
  );

  const showSavedToast = useCallback(() => {
    showToast(common("saved"), "teal", {
      actionLabel: common("goToDashboard"),
      actionHref:
        caseId && resolvedScenarioId
          ? scenarioDashboardPath(caseId, resolvedScenarioId)
          : "/",
    });
  }, [caseId, common, resolvedScenarioId, showToast]);

  const handleAddMember = (draft: AddMemberDraft) => {
    const validationResult = validateAddMemberDraft(draft, {
      requiredName: membersText("memberNameRequired"),
      requiredAgeOrMonth: membersText("memberBirthOrAgeRequired"),
      invalidMonth: validation("useYearMonth"),
    });
    if (!validationResult.isValid) {
      setAddMemberDraftValidation(validationResult.errors);
      return;
    }

    const newMember = buildMemberFromAddDraft(draft, {
      createId: createMemberId,
      buildDefaultMilestones,
    });

    persistNewMember(newMember, { createMember });

    showSavedToast();
    setAddMemberDraft(createDefaultAddMemberDraft());
    setAddMemberDraftValidation({
      name: null,
      birthMonth: null,
      ageAtBaseMonth: null,
    });
    setIsAddMemberModalOpen(false);
  };

  const openEditMemberModal = (member: ScenarioMember) => {
    setEditingMemberId(member.id);
    setEditMemberDraft(buildAddMemberDraftFromMember(member));
    setEditMemberDraftValidation({
      name: null,
      birthMonth: null,
      ageAtBaseMonth: null,
    });
    setIsEditMemberModalOpen(true);
  };

  const handleSaveMemberDraft = () => {
    if (!editingMemberId) {
      return;
    }
    const validationResult = validateAddMemberDraft(editMemberDraft, {
      requiredName: membersText("memberNameRequired"),
      requiredAgeOrMonth: membersText("memberBirthOrAgeRequired"),
      invalidMonth: validation("useYearMonth"),
    });
    if (!validationResult.isValid) {
      setEditMemberDraftValidation(validationResult.errors);
      return;
    }

    updateMember(editingMemberId, buildMemberPatchFromDraft(editMemberDraft));

    setIsEditMemberModalOpen(false);
    setEditingMemberId(null);
    showSavedToast();
  };

  const handleDeleteEditingMember = () => {
    if (!editingMemberId || members.length <= 1) {
      return;
    }
    deleteMember(editingMemberId);
    setIsEditMemberModalOpen(false);
    setEditingMemberId(null);
    showSavedToast();
  };

  const handleAssumptionDraftChange = useCallback(
    (patch: ScenarioAssumptionsOverride) => {
      setAssumptionsDraft((current) => ({
        ...(current ?? {}),
        ...patch,
      }));
    },
    []
  );

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

  const assumptionPresets = useMemo<Record<AssumptionPresetKey, ScenarioAssumptionsOverride>>(() => {
    const baseline = defaultAssumptionsForReset;
    const withDelta = (value: number | undefined, delta: number) =>
      typeof value === "number" ? Number((value + delta).toFixed(2)) : undefined;

    return {
      baseline,
      conservative: {
        inflationRate: withDelta(baseline.inflationRate, 0.5),
        salaryGrowthRate: withDelta(baseline.salaryGrowthRate, -0.5),
        rentAnnualGrowthPct: withDelta(baseline.rentAnnualGrowthPct, 0.5),
        propertyAppreciationPct: withDelta(baseline.propertyAppreciationPct, -0.5),
        cashYieldPct: withDelta(baseline.cashYieldPct, -0.5),
        carDepreciationRatePct: withDelta(baseline.carDepreciationRatePct, 0.5),
      },
      growth: {
        inflationRate: withDelta(baseline.inflationRate, -0.5),
        salaryGrowthRate: withDelta(baseline.salaryGrowthRate, 0.5),
        rentAnnualGrowthPct: withDelta(baseline.rentAnnualGrowthPct, -0.5),
        propertyAppreciationPct: withDelta(baseline.propertyAppreciationPct, 0.5),
        cashYieldPct: withDelta(baseline.cashYieldPct, 0.5),
        carDepreciationRatePct: withDelta(baseline.carDepreciationRatePct, -0.5),
      },
    };
  }, [defaultAssumptionsForReset]);

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

  const syncOnboardingBaselineMarker = useCallback(
    (scenarioIdToSync: string, useBaseline: boolean) => {
      if (typeof window === "undefined") {
        return;
      }
      const flagKey = getOnboardingAssumptionsAutoApplyFlagKey(scenarioIdToSync);
      if (useBaseline) {
        window.localStorage.setItem(flagKey, "true");
      } else {
        window.localStorage.removeItem(flagKey);
      }
      setHasAppliedOnboardingBaseline(useBaseline);
    },
    []
  );

  const applyAssumptionPatchWithSource = useCallback(
    (
      patch: ScenarioAssumptionsOverride,
      nextSource: "baseline" | "custom",
      toastMessage?: string
    ) => {
      if (!scenario) {
        return;
      }
      updateScenarioAssumptions(scenario.id, patch);
      syncOnboardingBaselineMarker(scenario.id, nextSource === "baseline");
      if (toastMessage) {
        showToast(toastMessage, "teal");
      }
    },
    [scenario, showToast, syncOnboardingBaselineMarker, updateScenarioAssumptions]
  );

  const handleApplyAssumptionPreset = useCallback(
    (presetKey: AssumptionPresetKey, toastMessage?: string) => {
      const preset = assumptionPresets[presetKey];
      if (!preset) {
        return;
      }
      const presetLabelByKey: Record<AssumptionPresetKey, string> = {
        baseline: t("presetBaseline"),
        conservative: t("presetConservative"),
        growth: t("presetGrowth"),
      };
      applyAssumptionPatchWithSource(
        preset,
        presetKey === "baseline" ? "baseline" : "custom",
        toastMessage ?? t("presetApplied", { preset: presetLabelByKey[presetKey] })
      );
      setAssumptionPresetModalOpen(false);
      setResetAssumptionsModalOpen(false);
    },
    [applyAssumptionPatchWithSource, assumptionPresets, t]
  );

  const handleConfirmResetAssumptions = useCallback(() => {
    if (!scenario) {
      return;
    }
    handleApplyAssumptionPreset("baseline", t("resetDefaultsSaved"));
  }, [handleApplyAssumptionPreset, scenario, t]);

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
    syncOnboardingBaselineMarker(scenario.id, true);
    showToast(t("onboardingBaselineAppliedToast"), "teal");
  }, [scenario, showToast, syncOnboardingBaselineMarker, t, updateScenarioAssumptions]);

  const assumptionSourceLabel = hasAppliedOnboardingBaseline
    ? t("assumptionSourceInUseBaseline")
    : t("assumptionSourceInUseCustom");

  const baseMonth = appSettings.globalBaseMonth;
  const horizonMonths = appSettings.globalHorizonMonths;
  const horizonValue = horizonOptions.some(
    (option) => Number(option.value) === horizonMonths
  )
    ? String(horizonMonths)
    : String(resolvePlanningHorizonMonths(DEFAULT_PLANNING_HORIZON_YEARS));
  const horizonEndMonth =
    baseMonth && horizonMonths > 0
      ? buildMonthRange(baseMonth, horizonMonths).at(-1) ?? null
      : null;
  const horizonSummaryLabel =
    horizonOptions.find((option) => option.value === horizonValue)?.label ?? horizonValue;
  const baseMonthSummaryLabel = baseMonth || t("notAvailable");
  const modelAssumptionSummary = [
    `${t("inflationRate")}: ${assumptions?.inflationRate ?? t("notAvailable")}%`,
    `${t("salaryGrowth")}: ${assumptions?.salaryGrowthRate ?? t("notAvailable")}%`,
    `${t("rentAnnualGrowth")}: ${assumptions?.rentAnnualGrowthPct ?? t("notAvailable")}%`,
  ].join(" · ");
  const displayModeSummary = `${
    appSettings.viewMode === "real" ? t("viewReal") : t("viewNominal")
  } · ${t("annualInflationPctDisplayLabel")} ${appSettings.annualInflationPct}%`;

  const resetAssumptionDraftBySection = useCallback(
    (section: AssumptionsEditSection) => {
      if (section === "planningHorizon") {
        setHorizonDraftValue(horizonValue);
        return;
      }
      if (section === "baseMonth") {
        setBaseMonthDraftInput(baseMonth ?? "");
        setBaseMonthDraftError(null);
        return;
      }
      if (section === "displayMode") {
        setDisplayDraft({
          annualInflationPct: appSettings.annualInflationPct,
          viewMode: appSettings.viewMode,
        });
        return;
      }
      setAssumptionsDraft({
        inflationRate: assumptions?.inflationRate,
        salaryGrowthRate: assumptions?.salaryGrowthRate,
        emergencyFundMonths: assumptions?.emergencyFundMonths,
        rentAnnualGrowthPct: assumptions?.rentAnnualGrowthPct,
        propertyAppreciationPct: assumptions?.propertyAppreciationPct,
        cashYieldPct: assumptions?.cashYieldPct,
        carDepreciationRatePct: assumptions?.carDepreciationRatePct,
      });
    },
    [
      appSettings.annualInflationPct,
      appSettings.viewMode,
      assumptions?.carDepreciationRatePct,
      assumptions?.cashYieldPct,
      assumptions?.emergencyFundMonths,
      assumptions?.inflationRate,
      assumptions?.propertyAppreciationPct,
      assumptions?.rentAnnualGrowthPct,
      assumptions?.salaryGrowthRate,
      baseMonth,
      horizonValue,
    ]
  );

  const isAssumptionsDraftDirty = useMemo(() => {
    if (!assumptionsDraft) {
      return false;
    }
    return (
      assumptionsDraft.inflationRate !== assumptions?.inflationRate ||
      assumptionsDraft.salaryGrowthRate !== assumptions?.salaryGrowthRate ||
      assumptionsDraft.emergencyFundMonths !== assumptions?.emergencyFundMonths ||
      assumptionsDraft.rentAnnualGrowthPct !== assumptions?.rentAnnualGrowthPct ||
      assumptionsDraft.propertyAppreciationPct !== assumptions?.propertyAppreciationPct ||
      assumptionsDraft.cashYieldPct !== assumptions?.cashYieldPct ||
      assumptionsDraft.carDepreciationRatePct !== assumptions?.carDepreciationRatePct
    );
  }, [assumptions, assumptionsDraft]);

  const hasUnsavedChangesInModal = useCallback(
    (section: AssumptionsEditSection | null) => {
      if (!section) {
        return false;
      }
      if (section === "planningHorizon") {
        return horizonDraftValue !== horizonValue;
      }
      if (section === "baseMonth") {
        return (baseMonthDraftInput.trim() || "") !== (baseMonth || "");
      }
      if (section === "displayMode") {
        return (
          displayDraft.annualInflationPct !== appSettings.annualInflationPct ||
          displayDraft.viewMode !== appSettings.viewMode
        );
      }
      return isAssumptionsDraftDirty;
    },
    [
      appSettings.annualInflationPct,
      appSettings.viewMode,
      baseMonth,
      baseMonthDraftInput,
      displayDraft.annualInflationPct,
      displayDraft.viewMode,
      horizonDraftValue,
      horizonValue,
      isAssumptionsDraftDirty,
    ]
  );

  const handleRequestCloseAssumptionModal = useCallback(
    (section: AssumptionsEditSection | null) => {
      if (!section) {
        return;
      }
      if (hasUnsavedChangesInModal(section)) {
        setDiscardConfirmModalOpen(true);
        return;
      }
      resetAssumptionDraftBySection(section);
      setActiveAssumptionModal(null);
    },
    [hasUnsavedChangesInModal, resetAssumptionDraftBySection]
  );
  const assignableEventViews = useMemo(() => {
    if (!scenario) {
      return [];
    }
    return buildMemberAssignableEventViews(scenario, eventLibrary);
  }, [eventLibrary, scenario]);
  const eventsByMemberId = useMemo(() => {
    const grouped = new Map<string, typeof assignableEventViews>();
    assignableEventViews.forEach((view) => {
      const memberKey = view.definition.memberId ?? "household";
      const existing = grouped.get(memberKey) ?? [];
      grouped.set(memberKey, [...existing, view]);
    });
    return grouped;
  }, [assignableEventViews]);
  const resolveEventEditHref = useCallback(
    (eventId: string, eventType: string) => {
      if (!scenario || !caseId) {
        return "#";
      }
      const group = getEventMeta(eventType).group;
      const tab = group === "income" ? "income" : "expenses";
      const query = new URLSearchParams({ tab, editEventId: eventId });
      return `${scenarioMoneyPath(caseId, scenario.id)}?${query.toString()}`;
    },
    [caseId, scenario]
  );
  const resolveEventAmountLabel = useCallback(
    (eventView: (typeof assignableEventViews)[number]) => {
      const monthlyAmount = Number(eventView.rule.monthlyAmount ?? 0);
      const oneTimeAmount = Number(eventView.rule.oneTimeAmount ?? 0);
      if (monthlyAmount !== 0) {
        return formatCurrency(monthlyAmount);
      }
      if (oneTimeAmount !== 0) {
        return formatCurrency(oneTimeAmount);
      }
      return formatCurrency(0);
    },
    [formatCurrency]
  );
  const resolveEventPeriodLabel = useCallback(
    (eventView: (typeof assignableEventViews)[number]) => {
      const startMonth = eventView.rule.startMonth?.trim() ?? "";
      const endMonth = eventView.rule.endMonth?.trim() ?? "";
      if (startMonth && endMonth) {
        return `${startMonth} → ${endMonth}`;
      }
      if (startMonth) {
        return `${startMonth} → ${common("ongoing")}`;
      }
      if (endMonth) {
        return membersText("memberEventsPeriodUntil", { endMonth });
      }
      return membersText("memberEventsPeriodUnspecified");
    },
    [common, membersText]
  );
  const memberLookupRecord = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member.name])),
    [members]
  );
  const resolveSettingsEventTags = useCallback(
    (eventView: (typeof assignableEventViews)[number]) =>
      buildMoneyMetaTagViewModel(
        {
          id: eventView.definition.id,
          kind: eventView.definition.incomeSubtype ? "income" : "expense",
          type: "cashflow",
          memberId: eventView.definition.memberId,
          cadence:
            typeof eventView.rule.oneTimeAmount === "number" && eventView.rule.oneTimeAmount > 0
              ? "oneOff"
              : "monthly",
          startMonth: eventView.rule.startMonth,
          endMonth: eventView.rule.endMonth,
        },
        {
          householdLabel: membersText("householdCardTitle"),
          ownerId: eventView.definition.memberId,
          memberLookupRecord,
          resolveTypeLabel: (meta) => `${meta.domain}/${meta.kind}`,
          resolveFrequencyLabel: (meta) => (meta.frequency === "none" ? null : meta.frequency),
          resolveLifecycleLabel: (meta) => meta.lifecycle,
          resolveSourceLabel: (source) => source,
          resolveLinkStateLabel: (linkState) => (linkState === "orphaned" ? "orphaned" : null),
          source: "baseline-only",
          linkState: eventView.linkState ?? "linked",
        }
      ).tags,
    [memberLookupRecord, membersText]
  );

  const recoveryHref =
    caseId && scenarios[0]?.id
      ? scenarioDashboardPath(caseId, scenarios[0].id)
      : "/";

  const createMilestoneId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  const formatAgeYears = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

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
          <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
            <Text size="sm">{toast.message}</Text>
            {toast.actionLabel && toast.actionHref ? (
              <Button
                component={Link}
                href={toast.actionHref}
                size="xs"
                variant="subtle"
                onClick={() => setToast(null)}
              >
                {toast.actionLabel}
              </Button>
            ) : null}
          </Group>
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

        <Tabs.Panel value="persistence" pt="md">
          <Text size="sm" c="dimmed" mb="md">
            {common("settingsSectionDataManagementMicrocopy")}
          </Text>
          <Notification color="gray" withCloseButton={false} mb="md">
            {common("settingsPersistenceDeprecatedNotice")}
          </Notification>
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Text fw={600}>{common("dataManagementTitle")}</Text>
              <Text size="sm" c="dimmed">
                {common("dataManagementSubtitle")}
              </Text>
              <DataManagementSection onNotify={showToast} />
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="assumptions" pt="md">
          <Text size="sm" c="dimmed" mb="md">
            {common("settingsSectionGlobalMicrocopy")}
          </Text>
          <Accordion variant="separated" display={"none"}>
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

          <Stack gap="md" mt="md">
            <SimpleGrid cols={2}>
              <Card withBorder radius="md" padding="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Text fw={600}>{t("planningHorizon")}</Text>
                    <Text size="sm" c="dimmed">{horizonSummaryLabel}</Text>
                  </Stack>
                  <Button variant="light" onClick={() => setActiveAssumptionModal("planningHorizon")}>
                    {common("actionEdit")}
                  </Button>
                </Group>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Text fw={600}>{t("baseMonth")}</Text>
                    <Text size="sm" c="dimmed">{baseMonthSummaryLabel}</Text>
                  </Stack>
                  <Button variant="light" onClick={() => setActiveAssumptionModal("baseMonth")}>
                    {common("actionEdit")}
                  </Button>
                </Group>
              </Card>
            </SimpleGrid>

            <Card withBorder radius="md" padding="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={600}>{t("displayModeTitle")}</Text>
                  <Text size="sm" c="dimmed">{displayModeSummary}</Text>
                </Stack>
                <Button variant="light" onClick={() => setActiveAssumptionModal("displayMode")}>
                  {common("actionEdit")}
                </Button>
              </Group>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={600}>{t("scenarioAssumptionsTitle")}</Text>
                  <Text size="sm" c="dimmed">{modelAssumptionSummary}</Text>
                </Stack>
                <Button variant="light" onClick={() => setActiveAssumptionModal("modelAssumptions")}>
                  {common("actionEdit")}
                </Button>
              </Group>
            </Card>
          </Stack>

          <Modal
            opened={activeAssumptionModal === "planningHorizon"}
            onClose={() => handleRequestCloseAssumptionModal("planningHorizon")}
            title={t("planningHorizon")}
            centered
          >
            <Stack gap="md">
              <SegmentedControl
                data={horizonOptions}
                value={horizonDraftValue}
                onChange={setHorizonDraftValue}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => handleRequestCloseAssumptionModal("planningHorizon")}>
                  {common("actionCancel")}
                </Button>
                <Button
                  onClick={() => {
                    setGlobalHorizonMonths(Number(horizonDraftValue));
                    setActiveAssumptionModal(null);
                    showSavedToast();
                  }}
                >
                  {common("actionSave")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={activeAssumptionModal === "baseMonth"}
            onClose={() => handleRequestCloseAssumptionModal("baseMonth")}
            title={t("baseMonth")}
            centered
          >
            <Stack gap="md">
              <TextInput
                label={t("baseMonth")}
                placeholder={common("yearMonthPlaceholder")}
                value={baseMonthDraftInput}
                onChange={(event) => {
                  setBaseMonthDraftInput(event.currentTarget.value);
                  if (baseMonthDraftError) {
                    setBaseMonthDraftError(null);
                  }
                }}
                error={baseMonthDraftError ?? undefined}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => handleRequestCloseAssumptionModal("baseMonth")}>
                  {common("actionCancel")}
                </Button>
                <Button
                  onClick={() => {
                    const trimmed = baseMonthDraftInput.trim();
                    if (trimmed === "") {
                      setGlobalBaseMonth(null);
                      setBaseMonthDraftError(t("baseMonthRequired"));
                      setActiveAssumptionModal(null);
                      showSavedToast();
                      return;
                    }
                    const normalized = normalizeMonthStrict(trimmed);
                    if (!normalized.ok) {
                      setBaseMonthDraftError(validation("useYearMonth"));
                      return;
                    }
                    setGlobalBaseMonth(normalized.month);
                    setBaseMonthDraftInput(normalized.month);
                    setBaseMonthDraftError(null);
                    setActiveAssumptionModal(null);
                    showSavedToast();
                  }}
                >
                  {common("actionSave")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={activeAssumptionModal === "displayMode"}
            onClose={() => handleRequestCloseAssumptionModal("displayMode")}
            title={t("displayModeTitle")}
            centered
          >
            <Stack gap="md">
              <NumberInput
                label={t("annualInflationPctDisplayLabel")}
                description={t("annualInflationPctDisplayHint")}
                value={displayDraft.annualInflationPct}
                min={0}
                step={0.1}
                decimalScale={2}
                onChange={(value) =>
                  setDisplayDraft((current) => ({
                    ...current,
                    annualInflationPct: typeof value === "number" ? value : 0,
                  }))
                }
              />
              <Stack gap={4}>
                <Text size="sm" fw={500}>{t("viewModeLabel")}</Text>
                <SegmentedControl
                  data={[
                    { value: "nominal", label: t("viewNominal") },
                    { value: "real", label: t("viewReal") },
                  ]}
                  value={displayDraft.viewMode}
                  onChange={(value) =>
                    setDisplayDraft((current) => ({
                      ...current,
                      viewMode: value as "nominal" | "real",
                    }))
                  }
                />
                <Text size="xs" c="dimmed">{t("viewRealHint")}</Text>
              </Stack>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => handleRequestCloseAssumptionModal("displayMode")}>
                  {common("actionCancel")}
                </Button>
                <Button
                  onClick={() => {
                    setAnnualInflationPct(displayDraft.annualInflationPct);
                    setViewMode(displayDraft.viewMode);
                    setActiveAssumptionModal(null);
                    showSavedToast();
                  }}
                >
                  {common("actionSave")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={activeAssumptionModal === "modelAssumptions"}
            onClose={() => handleRequestCloseAssumptionModal("modelAssumptions")}
            title={t("scenarioAssumptionsTitle")}
            centered
            size="lg"
          >
            <Stack gap="md">
              <Text size="sm" c="dimmed">{t("scenarioAssumptionsHint")}</Text>
              <Text size="xs" c="dimmed">{t("inflationRateProjectionHint")}</Text>
              <Group gap="xs">
                <Text size="sm" fw={500}>{t("assumptionSourceLabel")}</Text>
                <Badge color={hasAppliedOnboardingBaseline ? "teal" : "gray"} variant="light">
                  {assumptionSourceLabel}
                </Badge>
              </Group>
              <Card withBorder radius="md" padding="sm">
                <Text size="sm" c="dimmed">
                  {t("initialCashMovedHint")} <Link href={buildMoneyAssetsUrl(caseId, scenario.id, { focus: "cash" })}>{t("initialCashMovedLink")}</Link>
                </Text>
              </Card>
              <ScenarioAssumptionsOverrideForm
                values={assumptionsDraft ?? assumptions ?? {}}
                baseline={assumptions ?? {}}
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
                onChange={handleAssumptionDraftChange}
              />
              <Group justify="space-between" wrap="wrap">
                <Group>
                  <Button
                    variant="default"
                    onClick={() => setResetAssumptionsModalOpen(true)}
                    disabled={resetAssumptionDiffRows.length === 0}
                  >
                    {t("applyBaselinePresetAction")}
                  </Button>
                  <Button variant="subtle" color="gray" onClick={() => setAssumptionPresetModalOpen(true)}>
                    {t("presetMoreAction")}
                  </Button>
                </Group>
                <Group>
                  <Button variant="default" onClick={() => handleRequestCloseAssumptionModal("modelAssumptions")}>
                    {common("actionCancel")}
                  </Button>
                  <Button
                    onClick={() => {
                      if (assumptionsDraft) {
                        updateScenarioAssumptions(scenario.id, assumptionsDraft);
                      }
                      setActiveAssumptionModal(null);
                      showSavedToast();
                    }}
                  >
                    {common("actionSave")}
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={assumptionPresetModalOpen}
            onClose={() => setAssumptionPresetModalOpen(false)}
            title={t("presetLabel")}
            centered
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed">{t("presetDiffHint")}</Text>
              <Group grow>
                <Button variant="default" onClick={() => handleApplyAssumptionPreset("conservative")}>
                  {t("presetConservative")}
                </Button>
                <Button variant="default" onClick={() => handleApplyAssumptionPreset("growth")}>
                  {t("presetGrowth")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={discardConfirmModalOpen}
            onClose={() => setDiscardConfirmModalOpen(false)}
            title={t("discardModalTitle")}
            centered
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed">{t("discardModalBody")}</Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setDiscardConfirmModalOpen(false)}>
                  {common("actionCancel")}
                </Button>
                <Button
                  color="red"
                  onClick={() => {
                    setDiscardConfirmModalOpen(false);
                    if (activeAssumptionModal) {
                      resetAssumptionDraftBySection(activeAssumptionModal);
                    }
                    setActiveAssumptionModal(null);
                  }}
                >
                  {common("actionConfirm")}
                </Button>
              </Group>
            </Stack>
          </Modal>

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

          <Card withBorder radius="md" padding="md" mt="md" display={"none"}>
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
                    setAddMemberDraft(createDefaultAddMemberDraft());
                    setAddMemberDraftValidation({
                      name: null,
                      birthMonth: null,
                      ageAtBaseMonth: null,
                    });
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
                    const hasBirthMonth =
                      typeof member.birthMonth === "string" &&
                      isValidMonthStr(member.birthMonth);
                    const hasAgeAtBase = typeof member.ageAtBaseMonth === "number";
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
                    const memberEventViews = eventsByMemberId.get(member.id) ?? [];

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
                                variant="light"
                                onClick={() => openEditMemberModal(member)}
                              >
                                {membersText("editMember")}
                              </Button>
                            </Group>
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                              <Stack gap={2}>
                                <Text size="xs" c="dimmed">
                                  {membersText("nameLabel")}
                                </Text>
                                <Text>{member.name || membersText("defaultName")}</Text>
                              </Stack>
                              <Stack gap={2}>
                                <Text size="xs" c="dimmed">
                                  {membersText("kindLabel")}
                                </Text>
                                <Badge variant="light" w="fit-content">
                                  {member.kind === "person"
                                    ? membersText("kindPerson")
                                    : membersText("kindPet")}
                                </Badge>
                              </Stack>
                              <Stack gap={2}>
                                <Text size="xs" c="dimmed">
                                  {membersText("birthMonthLabel")}
                                </Text>
                                <Text>{member.birthMonth ?? t("notAvailable")}</Text>
                              </Stack>
                              <Stack gap={2}>
                                <Text size="xs" c="dimmed">
                                  {membersText("ageAtBaseLabel")}
                                </Text>
                                <Text>
                                  {typeof member.ageAtBaseMonth === "number"
                                    ? formatAgeYears(member.ageAtBaseMonth)
                                    : t("notAvailable")}
                                </Text>
                              </Stack>
                            </SimpleGrid>
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
                            <Stack gap="xs">
                              <Text fw={600}>{membersText("memberEventsTitle")}</Text>
                              {memberEventViews.length === 0 ? (
                                <Text size="xs" c="dimmed">
                                  {membersText("memberEventsEmpty")}
                                </Text>
                              ) : (
                                <Stack gap="xs">
                                  {memberEventViews.map((eventView) => (
                                    <Card key={eventView.definition.id} withBorder radius="md" padding="sm" data-testid={`settings-member-event-${eventView.definition.id}`} style={focusEventId === eventView.definition.id ? { outline: "2px solid var(--mantine-color-aurora-5)" } : undefined}>
                                      <Group justify="space-between" align="center" wrap="wrap">
                                        <Stack gap={2}>
                                          <Text fw={500}>{eventView.definition.title}</Text>
                                          <Group gap="xs" wrap="wrap">
                                            <Badge variant="outline">{eventView.definition.type}</Badge>
                                            <Text size="xs" c="dimmed">{resolveEventAmountLabel(eventView)}</Text>
                                            <Text size="xs" c="dimmed">{resolveEventPeriodLabel(eventView)}</Text>
                                          </Group>
                                          <MoneyMetaTags tags={resolveSettingsEventTags(eventView)} />
                                        </Stack>
                                        <Button
                                          size="xs"
                                          variant="light"
                                          component={Link}
                                          href={resolveEventEditHref(
                                            eventView.definition.id,
                                            eventView.definition.type
                                          )}
                                        >
                                          {membersText("memberEventsEdit")}
                                        </Button>
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
                <Card withBorder radius="md" padding="md">
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Text fw={600}>{membersText("householdCardTitle")}</Text>
                      <Badge variant="light">
                        {membersText("memberEventsCount", {
                          count: (eventsByMemberId.get("household") ?? []).length,
                        })}
                      </Badge>
                    </Group>
                    {(eventsByMemberId.get("household") ?? []).length === 0 ? (
                      <Text size="xs" c="dimmed">
                        {membersText("householdEventsEmpty")}
                      </Text>
                    ) : (
                      <Stack gap="xs">
                        {(eventsByMemberId.get("household") ?? []).map((eventView) => (
                          <Card key={eventView.definition.id} withBorder radius="md" padding="sm" data-testid={`settings-household-event-${eventView.definition.id}`} style={focusEventId === eventView.definition.id ? { outline: "2px solid var(--mantine-color-aurora-5)" } : undefined}>
                            <Group justify="space-between" align="center" wrap="wrap">
                              <Stack gap={2}>
                                <Text fw={500}>{eventView.definition.title}</Text>
                                <Group gap="xs" wrap="wrap">
                                  <Badge variant="outline">{eventView.definition.type}</Badge>
                                  <Text size="xs" c="dimmed">{resolveEventAmountLabel(eventView)}</Text>
                                  <Text size="xs" c="dimmed">{resolveEventPeriodLabel(eventView)}</Text>
                                </Group>
                                <MoneyMetaTags tags={resolveSettingsEventTags(eventView)} />
                              </Stack>
                              <Button
                                size="xs"
                                variant="light"
                                component={Link}
                                href={resolveEventEditHref(
                                  eventView.definition.id,
                                  eventView.definition.type
                                )}
                              >
                                {membersText("memberEventsEdit")}
                              </Button>
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
            onClose={() => {
              setIsAddMemberModalOpen(false);
              setAddMemberDraftValidation({
                name: null,
                birthMonth: null,
                ageAtBaseMonth: null,
              });
            }}
            title={membersText("addMember")}
            centered
          >
            <Stack>
              <MemberDraftFormFields
                draft={addMemberDraft}
                validationState={addMemberDraftValidation}
                onDraftChange={(patch) =>
                  setAddMemberDraft((current) => ({ ...current, ...patch }))
                }
                onValidationStateChange={(patch) =>
                  setAddMemberDraftValidation((current) => ({
                    ...current,
                    ...patch,
                  }))
                }
                membersText={membersText}
                common={common}
                validation={validation}
              />
              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={() => {
                    setIsAddMemberModalOpen(false);
                    setAddMemberDraftValidation({
                      name: null,
                      birthMonth: null,
                      ageAtBaseMonth: null,
                    });
                  }}
                >
                  {common("cancel")}
                </Button>
                <Button onClick={() => handleAddMember(addMemberDraft)}>
                  {membersText("addMember")}
                </Button>
              </Group>
            </Stack>
          </Modal>
          <EditMemberModal
            opened={isEditMemberModalOpen}
            draft={editMemberDraft}
            validationState={editMemberDraftValidation}
            onClose={() => {
              setIsEditMemberModalOpen(false);
              setEditingMemberId(null);
              setEditMemberDraftValidation({
                name: null,
                birthMonth: null,
                ageAtBaseMonth: null,
              });
            }}
            onSave={handleSaveMemberDraft}
            onDelete={members.length <= 1 ? undefined : handleDeleteEditingMember}
            onDraftChange={(patch) =>
              setEditMemberDraft((current) => ({
                ...current,
                ...patch,
              }))
            }
            onValidationStateChange={(patch) =>
              setEditMemberDraftValidation((current) => ({
                ...current,
                ...patch,
              }))
            }
            membersText={membersText}
            common={common}
            validation={validation}
          />
        </Tabs.Panel>

      </Tabs>

    </Stack>
  );
}
