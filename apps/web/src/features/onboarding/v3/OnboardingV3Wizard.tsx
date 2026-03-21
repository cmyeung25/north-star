"use client";

import { Alert, AspectRatio, Box, Button, Group, Image, Notification, SimpleGrid, Stack } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useMessages, useTranslations } from "next-intl";
import type { ScenarioEvent, ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import OnboardingV2WizardShell from "../v2/OnboardingV2WizardShell";
import { deriveFromProperty } from "../../../domain/scenarioDraft/rules/deriveFromProperty";
import { getScenarioById, useScenarioStore } from "../../../store/scenarioStore";
import ScenarioSetupStep from "./steps/ScenarioSetupStep";
import HouseholdStep from "./steps/HouseholdStep";
import AssetsStep from "./steps/AssetsStep";
import IncomeStep from "./steps/IncomeStep";
import ExpenseStep from "./steps/ExpenseStep";
import ReviewStep from "./steps/ReviewStep";
import { createInitialScenarioDraftV3State, type OnboardingAsset } from "./types";
import {
  clearOnboardingDraftState,
  hasPersistedOnboardingDraftState,
  loadOnboardingV3DraftState,
  persistOnboardingV3DraftState,
  replaceActiveScenarioOnboardingDraftPresetState,
} from "./draftStorage";
import { submitOnboardingV3Payload } from "./submissionFacade";
import { submitScenarioDraft } from "../../../domain/scenarioDraft/submitScenarioDraft";
import { recordScenarioMigrationEvent } from "../../../lib/telemetry/scenarioMigrationTelemetry";
import { mapOnboardingV3EventTypes } from "./eventTypeMapper";
import { memberCasesPath, scenarioDashboardPath } from "../../../../lib/routes/appRoutes";
import { resolveScenarioLifecycle } from "../../../../lib/scenario/lifecycle";
import { saveScenarioPayloadAction } from "../../../../app/(app)/app/actions/scenarioSave.actions";
import { useScenarioContext } from "../../../hooks/useScenarioContext";
import { useScenarioCloudStore } from "../../../store/scenarioCloudStore";
import { exportScenarioState } from "../../../store/scenarioState";
import { buildOnboardingCompletenessSummary } from "./completeness";
import { buildOnboardingGuardrailSummary } from "./guardrails";
import {
  buildPendingGuardrailFix,
  createOnboardingReviewSessionId,
  resolveCompletedGuardrailFixes,
  trackOnboardingFunnelEvent,
  type OnboardingReviewSourceContext,
  type PendingGuardrailFix,
} from "../../../lib/analytics/onboardingFunnel";
import { trackMarketEntryOnboardingCompletedFromContext } from "../../../lib/analytics/marketEntry";
import { RouteLoadingOverlay } from "../../../components/loading/route-loading-overlay";
import ActiveScenarioOnboardingDraftPresetSection, {
  shouldShowActiveScenarioOnboardingDraftPresetSection,
} from "./ActiveScenarioOnboardingDraftPresetSection";
import {
  createScenarioSeedTranslatorFromMessages,
  getScenarioSeeds,
} from "../../../scenarios/scenarioSeeds";
import { MEMBER_CASE_PRESET_SEED_IDS } from "../seedPrefill";

type CashflowDraft = Extract<ScenarioEventDraft, { type: "cashflow" }>;
type CashflowDraftWithId = CashflowDraft & { id: string };
type AutoCashflowRow = Extract<ScenarioEvent, { type: "cashflow" }>;
type ManualCashflowDraftInput = {
  title?: string;
  isCustomTitle?: boolean;
  label?: string;
  amount: number;
  cadence?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  memberId?: string;
  startMonth?: string;
  endMonth?: string;
  followIncomeGrowth?: boolean;
  category?: CashflowDraft["category"];
  expenseCategory?: CashflowDraft["expenseCategory"];
  tags?: string[];
  customGrowthRatePct?: number;
};

type ManualTitleMeta = {
  onboardingManualTitle?: string;
  onboardingIsCustomTitle?: boolean;
};

const stepDefs = [
  { id: "scenarioSetup", titleKey: "steps.scenarioSetup.title" },
  { id: "household", titleKey: "steps.household.title" },
  { id: "assets", titleKey: "steps.assets.title" },
  { id: "income", titleKey: "steps.income.title" },
  { id: "expense", titleKey: "steps.expense.title" },
  { id: "review", titleKey: "steps.review.title" },
] as const;

const onboardingStepImages = [
  "/onboarding/step1.jpeg",
  "/onboarding/step2.jpeg",
  "/onboarding/step3.jpeg",
  "/onboarding/step4.jpeg",
  "/onboarding/step5.jpeg",
  "/onboarding/step6.jpeg",
] as const;

const isCashflowDraft = (event: ScenarioEventDraft): event is CashflowDraft =>
  event.type === "cashflow";

const isMonthlyCashflowAmount = (
  event: ScenarioEvent | ScenarioEventDraft,
  kind: "income" | "expense"
): number => {
  if (event.type !== "cashflow" || event.kind !== kind || event.cadence !== "monthly") {
    return 0;
  }

  return event.amount;
};

const resolveAssetValue = (asset: OnboardingAsset): number => {
  if (asset.assetType === "cash") {
    return asset.amount ?? asset.currentValue ?? 0;
  }

  if (asset.assetType === "investment") {
    return asset.principal ?? asset.currentValue ?? 0;
  }

  return asset.currentValue ?? 0;
};

const hasId = (event: ScenarioEventDraft): event is ScenarioEventDraft & { id: string } =>
  typeof event.id === "string" && event.id.length > 0;

const AUTO_SALARY_TAG = "onboarding:v3:income:salary:auto";
const AUTO_SALARY_ID_PREFIX = "manual:auto-salary:";

const parseYearMonth = (value?: string) => {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return null;
  }

  const [yearToken, monthToken] = value.split("-");
  const year = Number(yearToken);
  const month = Number(monthToken);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  return { year, month };
};

const monthsBetween = (fromMonth?: string, toMonth?: string) => {
  const from = parseYearMonth(fromMonth);
  const to = parseYearMonth(toMonth);

  if (!from || !to) {
    return null;
  }

  return (to.year - from.year) * 12 + (to.month - from.month);
};

const isAutoSalaryManualEvent = (event: ScenarioEventDraft) =>
  hasId(event) &&
  isCashflowDraft(event) &&
  event.kind === "income" &&
  event.tags?.includes(AUTO_SALARY_TAG) === true;

export default function OnboardingV3Wizard() {
  const t = useTranslations("onboardingV3");
  const seedEventLabelT = useTranslations("scenarios.seeds.eventLabels");
  const appShellT = useTranslations("app.shell");
  const messages = useMessages();
  const locale = useLocale();
  const params = useParams<{ caseId?: string | string[]; scenarioId?: string | string[] }>();
  const router = useRouter();
  const caseId = Array.isArray(params?.caseId) ? params?.caseId[0] : params?.caseId;
  const scenarioId = Array.isArray(params?.scenarioId) ? params?.scenarioId[0] : params?.scenarioId;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const scenarioContext = useScenarioContext();
  const scenario = getScenarioById(scenarios, scenarioId ?? null);
  const prefillLabels = useMemo(
    () => ({
      dailyExpenseLabel: t("steps.expense.dailyMonthlyLabel"),
      incomeBonusLabel: t("steps.income.templates.bonus"),
      incomeSalaryLabel: t("steps.income.templates.salary"),
      rentExpenseLabel: seedEventLabelT("rent"),
      taxExpenseLabel: t("steps.expense.taxTitle"),
      travelExpenseLabel: t("steps.expense.travelTitle"),
    }),
    [seedEventLabelT, t]
  );
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyingPresetId, setApplyingPresetId] = useState<string | null>(null);
  const [hasExistingOnboardingDraft, setHasExistingOnboardingDraft] = useState(() =>
    hasPersistedOnboardingDraftState(scenarioId)
  );
  const [presetFeedbackTitle, setPresetFeedbackTitle] = useState<string | null>(null);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "validating" | "saving" | "redirecting">("idle");
  const [saveFeedback, setSaveFeedback] = useState<"ready" | null>(null);
  const [draft, setDraft] = useState(() =>
    loadOnboardingV3DraftState({
      fallbackState: createInitialScenarioDraftV3State({
        defaultMemberName: t("defaults.memberName"),
      }),
      labels: prefillLabels,
      scenarioId,
    })
  );
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [dismissedAutoSalaryMemberIds, setDismissedAutoSalaryMemberIds] = useState<string[]>([]);
  const reviewAnalyticsStateRef = useRef({
    activeReviewSessionId: null as string | null,
    activeReviewSourceContext: "initial_review" as OnboardingReviewSourceContext,
    hasTrackedActiveReviewView: false,
    shownGuardrailIds: new Set<string>(),
    pendingFixes: new Map<string, PendingGuardrailFix>(),
  });
  const defaultSalaryGrowthRate =
    draft.assumptions.salaryGrowthRate ?? scenario?.assumptions?.salaryGrowthRate ?? 3;
  const presetSeeds = useMemo(() => {
    const translator = createScenarioSeedTranslatorFromMessages(messages as Record<string, unknown>);
    const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

    return getScenarioSeeds(translator).filter((seed) => presetAllowlist.has(seed.id));
  }, [messages]);
  const showPresetSuggestions = shouldShowActiveScenarioOnboardingDraftPresetSection({
    isScenarioOnboardingIncomplete: Boolean(
      scenarioId && scenario && resolveScenarioLifecycle(scenario) === "draft"
    ),
  });

  const handleApplyPreset = useCallback(
    (preset: (typeof presetSeeds)[number]) => {
      if (!scenarioId) {
        return;
      }

      setApplyingPresetId(preset.id);
      setDraft(
        replaceActiveScenarioOnboardingDraftPresetState({
          scenarioId,
          presetPayload: preset.payload,
          fallbackState: createInitialScenarioDraftV3State({
            defaultMemberName: t("defaults.memberName"),
          }),
          labels: prefillLabels,
        })
      );
      setStep(0);
      setValidationMessages([]);
      setSaveFeedback(null);
      setPresetFeedbackTitle(preset.title);
      setHasExistingOnboardingDraft(true);
      setApplyingPresetId(null);
    },
    [prefillLabels, scenarioId, t]
  );

  useEffect(() => {
    setHasExistingOnboardingDraft(hasPersistedOnboardingDraftState(scenarioId));
  }, [scenarioId]);

  useEffect(() => {
    setDraft((current) => {
      const scenarioStartMonth = current.profile.startMonth;
      const adultMembers = current.members
        .filter((member) => member.kind === "person")
        .filter((member) => {
          if (!member.birthMonth) {
            return true;
          }

          const ageInMonths = monthsBetween(member.birthMonth, scenarioStartMonth);
          return ageInMonths === null || ageInMonths >= 18 * 12;
        });
      const adultMemberIds = new Set(adultMembers.map((member) => member.id));
      const dismissedIds = new Set(dismissedAutoSalaryMemberIds);
      const existingAutoSalaryIds = new Set(
        current.events
          .filter((event) => isAutoSalaryManualEvent(event))
          .map((event) => event.memberId)
          .filter((memberId): memberId is string => typeof memberId === "string" && memberId.length > 0)
      );
      const existingManualSalaryIds = new Set(
        current.events.reduce<string[]>((memberIds, event) => {
          if (!hasId(event) || !isCashflowDraft(event) || event.kind !== "income") {
            return memberIds;
          }
          if (isAutoSalaryManualEvent(event)) {
            return memberIds;
          }
          if (event.tags?.includes("onboarding:v3:income:salary") !== true || !event.memberId) {
            return memberIds;
          }
          memberIds.push(event.memberId);
          return memberIds;
        }, [])
      );

      const retainedEvents = current.events.filter((event) => {
        if (!isAutoSalaryManualEvent(event)) {
          return true;
        }

        const memberId = event.memberId;
        if (!memberId) {
          return false;
        }

        return adultMemberIds.has(memberId) && !dismissedIds.has(memberId);
      });

      const appendedEvents: ScenarioEventDraft[] = [];
      for (const member of adultMembers) {
        if (
          dismissedIds.has(member.id) ||
          existingAutoSalaryIds.has(member.id) ||
          existingManualSalaryIds.has(member.id)
        ) {
          continue;
        }

        appendedEvents.push({
          id: `${AUTO_SALARY_ID_PREFIX}${member.id}`,
          type: "cashflow",
          kind: "income",
          label: member.name?.trim() ? `${member.name.trim()} ${t("steps.income.templates.salary")}` : t("steps.income.templates.salary"),
          amount: 20000,
          cadence: "monthly",
          category: "salary",
          memberId: member.id,
          startMonth: current.profile.startMonth ?? "",
          growthMode: "assumption",
          tags: [AUTO_SALARY_TAG, "onboarding:v3:income:salary", "onboarding:v3:income:source-onboarding"],
        });
      }

      if (appendedEvents.length === 0 && retainedEvents.length === current.events.length) {
        return current;
      }

      return {
        ...current,
        events: [...retainedEvents, ...appendedEvents],
      };
    });
  }, [dismissedAutoSalaryMemberIds, draft.members, draft.profile.startMonth, t]);

  useEffect(() => {
    persistOnboardingV3DraftState(scenarioId, draft);
  }, [draft, scenarioId]);

  const derived = useMemo(() => deriveFromProperty({ profile: draft.profile, assets: draft.assets }), [draft.assets, draft.profile]);
  const autoRows = useMemo(() => derived.events as AutoCashflowRow[], [derived.events]);
  const autoEventIds = useMemo(() => new Set(autoRows.map((event) => event.id)), [autoRows]);

  const incomeRows = useMemo(() => autoRows.filter((event) => event.kind === "income"), [autoRows]);
  const expenseRows = useMemo(() => autoRows.filter((event) => event.kind === "expense"), [autoRows]);

  const manualCashflowEvents = useMemo(
    () =>
      draft.events.filter(
        (event): event is CashflowDraftWithId =>
          hasId(event) && isCashflowDraft(event) && !autoEventIds.has(event.id)
      ),
    [autoEventIds, draft.events]
  );

  const mergedEvents = useMemo(
    () => [...autoRows, ...manualCashflowEvents] as Array<ScenarioEvent | ScenarioEventDraft>,
    [autoRows, manualCashflowEvents]
  );

  const completenessSummary = useMemo(
    () =>
      buildOnboardingCompletenessSummary({
        draft,
        scenario,
      }),
    [draft, scenario]
  );
  const guardrailSummary = useMemo(
    () =>
      buildOnboardingGuardrailSummary({
        draft,
        scenario,
      }),
    [draft, scenario]
  );

  const reviewSummary = {
    scenarioSetup: {
      baseCurrency: draft.profile.baseCurrency,
      startMonth: draft.profile.startMonth,
      horizonMonths: draft.profile.horizonMonths,
      personaFocuses: draft.personaFocuses,
    },
    members: draft.members,
    assets: draft.assets,
    derivedIncomeCount: incomeRows.length,
    derivedExpenseCount: expenseRows.length,
    manualIncomeCount: manualCashflowEvents.filter((event) => event.kind === "income").length,
    manualExpenseCount: manualCashflowEvents.filter((event) => event.kind === "expense").length,
    totalAssetsAmount: draft.assets.reduce((sum, asset) => sum + resolveAssetValue(asset), 0),
    monthlyIncomeAmount: mergedEvents.reduce((sum, event) => sum + isMonthlyCashflowAmount(event, "income"), 0),
    monthlyExpenseAmount: mergedEvents.reduce((sum, event) => sum + isMonthlyCashflowAmount(event, "expense"), 0),
  };

  const stepIndexById = useMemo(
    () =>
      stepDefs.reduce<Record<string, number>>((accumulator, currentStep, index) => {
        accumulator[currentStep.id] = index;
        return accumulator;
      }, {}),
    []
  );
  const handleFixGuardrail = useCallback(
    (guardrailId: string) => {
      const guardrail = guardrailSummary.items.find((item) => item.id === guardrailId);
      if (!guardrail) {
        return;
      }

      const reviewSessionId = reviewAnalyticsStateRef.current.activeReviewSessionId;
      if (reviewSessionId) {
        reviewAnalyticsStateRef.current.pendingFixes.set(
          guardrailId,
          buildPendingGuardrailFix(guardrail, reviewSessionId)
        );
      }
      const targetIndex = stepIndexById[guardrail.target.stepId];
      if (typeof targetIndex === "number") {
        setStep(targetIndex);
      }
    },
    [guardrailSummary.items, stepIndexById]
  );

  useEffect(() => {
    if (step !== stepDefs.length - 1) {
      reviewAnalyticsStateRef.current.activeReviewSessionId = null;
      reviewAnalyticsStateRef.current.hasTrackedActiveReviewView = false;
      reviewAnalyticsStateRef.current.shownGuardrailIds.clear();
      return;
    }

    if (!reviewAnalyticsStateRef.current.activeReviewSessionId) {
      reviewAnalyticsStateRef.current.activeReviewSessionId = createOnboardingReviewSessionId();
      reviewAnalyticsStateRef.current.activeReviewSourceContext =
        reviewAnalyticsStateRef.current.pendingFixes.size > 0 ? "returned_from_fix" : "initial_review";
      reviewAnalyticsStateRef.current.hasTrackedActiveReviewView = false;
      reviewAnalyticsStateRef.current.shownGuardrailIds.clear();
    }

    const reviewSessionId = reviewAnalyticsStateRef.current.activeReviewSessionId;
    const reviewSourceContext = reviewAnalyticsStateRef.current.activeReviewSourceContext;

    if (reviewSessionId && !reviewAnalyticsStateRef.current.hasTrackedActiveReviewView) {
      trackOnboardingFunnelEvent("onboarding_review_viewed", {
        locale,
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId,
        reviewSourceContext,
        completenessLevel: completenessSummary.level,
        completenessScorePct: completenessSummary.scorePct,
        guardrailLevel: guardrailSummary.level,
        guardrailCount: guardrailSummary.counts.total,
        criticalGuardrailCount: guardrailSummary.counts.critical,
        warningGuardrailCount: guardrailSummary.counts.warning,
        infoGuardrailCount: guardrailSummary.counts.info,
      });
      reviewAnalyticsStateRef.current.hasTrackedActiveReviewView = true;
    }

    for (const item of guardrailSummary.items) {
      if (reviewAnalyticsStateRef.current.shownGuardrailIds.has(item.id)) {
        continue;
      }

      trackOnboardingFunnelEvent("guardrail_shown", {
        locale,
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId,
        reviewSourceContext,
        guardrailId: item.id,
        guardrailSeverity: item.severity,
        guardrailCategory: item.category,
        targetStepId: item.target.stepId,
        targetSection: item.target.section,
      });
      reviewAnalyticsStateRef.current.shownGuardrailIds.add(item.id);
    }

    const resolvedFixes = resolveCompletedGuardrailFixes({
      pendingFixes: reviewAnalyticsStateRef.current.pendingFixes,
      currentGuardrails: guardrailSummary.items,
      currentReviewSessionId: reviewSessionId,
    });

    for (const fixedGuardrail of resolvedFixes.fixedGuardrails) {
      trackOnboardingFunnelEvent("guardrail_fixed", {
        locale,
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId,
        reviewSourceContext: "returned_from_fix",
        guardrailId: fixedGuardrail.guardrailId,
        guardrailSeverity: fixedGuardrail.guardrailSeverity,
        guardrailCategory: fixedGuardrail.guardrailCategory,
        targetStepId: fixedGuardrail.targetStepId,
        targetSection: fixedGuardrail.targetSection,
      });
    }
    reviewAnalyticsStateRef.current.pendingFixes = resolvedFixes.remainingPendingFixes;
  }, [completenessSummary.level, completenessSummary.scorePct, guardrailSummary, locale, step]);

  const addManual = (kind: "income" | "expense", item: ManualCashflowDraftInput) => {
    if (kind === "income" && item.memberId) {
      setDismissedAutoSalaryMemberIds((current) => current.filter((memberId) => memberId !== item.memberId));
    }

    setDraft((current) => ({
      ...current,
      events: [
        ...current.events,
        {
          id: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          type: "cashflow",
          kind,
          label: item.label,
          amount: item.amount,
          cadence: item.cadence ?? "monthly",
          memberId: item.memberId || undefined,
          startMonth: item.startMonth ?? current.profile.startMonth ?? "",
          endMonth: item.endMonth,
          growthMode: item.followIncomeGrowth === false ? "none" : "assumption",
          category: item.category,
          expenseCategory: item.expenseCategory,
          tags: item.tags,
          customGrowthRatePct: item.customGrowthRatePct,
          meta: {
            onboardingManualTitle: item.title ?? (item.label?.trim() || undefined),
            onboardingIsCustomTitle: item.isCustomTitle ?? false,
          },
        },
      ],
    }));
  };

  const duplicateManualItem = (eventId: string) => {
    setDraft((current) => {
      const targetEvent = current.events.find(
        (event) => hasId(event) && isCashflowDraft(event) && event.id === eventId
      );
      if (!targetEvent || !isCashflowDraft(targetEvent)) {
        return current;
      }

      const targetMeta = (targetEvent.meta as ManualTitleMeta | undefined) ?? {};

      const duplicateEvent: CashflowDraftWithId = {
        ...targetEvent,
        id: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        meta: {
          ...targetEvent.meta,
          onboardingManualTitle:
            targetMeta.onboardingIsCustomTitle
              ? targetMeta.onboardingManualTitle
              : targetEvent.label?.trim() || targetMeta.onboardingManualTitle,
          onboardingIsCustomTitle: targetMeta.onboardingIsCustomTitle ?? false,
        },
      };

      return {
        ...current,
        events: [...current.events, duplicateEvent],
      };
    });
  };

  const removeManualItem = (eventId: string) => {
    setDraft((current) => {
      const targetEvent = current.events.find((event) => hasId(event) && event.id === eventId);
      if (targetEvent && isAutoSalaryManualEvent(targetEvent) && targetEvent.memberId) {
        setDismissedAutoSalaryMemberIds((memberIds) =>
          memberIds.includes(targetEvent.memberId as string)
            ? memberIds
            : [...memberIds, targetEvent.memberId as string]
        );
      }

      return {
        ...current,
        events: current.events.filter((event) => event.id !== eventId),
      };
    });
  };

  const steps = [
    { ...stepDefs[0], title: t(stepDefs[0].titleKey), content: <ScenarioSetupStep profile={draft.profile} personaFocuses={draft.personaFocuses} onChange={(profile) => setDraft((current) => ({ ...current, profile }))} onPersonaFocusesChange={(personaFocuses) => setDraft((current) => ({ ...current, personaFocuses }))} /> },
    { ...stepDefs[1], title: t(stepDefs[1].titleKey), content: <HouseholdStep members={draft.members} onChange={(members) => setDraft((current) => ({ ...current, members }))} /> },
    { ...stepDefs[2], title: t(stepDefs[2].titleKey), content: <AssetsStep assets={draft.assets} startMonth={draft.profile.startMonth ?? ""} baseCurrency={draft.profile.baseCurrency ?? "HKD"} assetToggles={draft.assetToggles} onAssetsChange={(assets) => setDraft((current) => ({ ...current, assets }))} onAssetTogglesChange={(assetToggles) => setDraft((current) => ({ ...current, assetToggles }))} /> },
    {
      ...stepDefs[3],
      title: t(stepDefs[3].titleKey),
      content: (
        <IncomeStep
          rows={incomeRows}
          members={draft.members}
          defaultStartMonth={draft.profile.startMonth ?? ""}
          defaultSalaryGrowthRate={defaultSalaryGrowthRate}
          manualRows={manualCashflowEvents
            .filter((event) => event.kind === "income")
            .map((event) => ({
              ...event,
              title: (event.meta as ManualTitleMeta | undefined)?.onboardingManualTitle,
              isCustomTitle: (event.meta as ManualTitleMeta | undefined)?.onboardingIsCustomTitle ?? false,
              followIncomeGrowth: event.growthMode !== "none",
            }))}
          onAddManualItem={(item) => addManual("income", item)}
          onUpdateManualItem={(eventId, patch) =>
            setDraft((current) => ({
              ...current,
              events: current.events.map((event) =>
                hasId(event) && isCashflowDraft(event) && event.id === eventId
                  ? {
                      ...event,
                      label: patch.label ?? event.label,
                      amount: patch.amount ?? event.amount,
                      cadence: patch.cadence ?? event.cadence,
                      memberId: patch.memberId === "" ? undefined : (patch.memberId ?? event.memberId),
                      startMonth: patch.startMonth ?? event.startMonth,
                      endMonth: patch.endMonth,
                      meta: {
                        ...event.meta,
                        onboardingManualTitle:
                          patch.title !== undefined
                            ? patch.title.trim() || undefined
                            : (event.meta as ManualTitleMeta | undefined)?.onboardingManualTitle,
                        onboardingIsCustomTitle:
                          patch.isCustomTitle ??
                          (event.meta as ManualTitleMeta | undefined)?.onboardingIsCustomTitle ??
                          false,
                      },
                      growthMode:
                        typeof patch.followIncomeGrowth === "boolean"
                          ? (patch.followIncomeGrowth ? "assumption" : "none")
                          : event.growthMode,
                      category: patch.category ?? event.category,
                    }
                  : event
              ),
            }))
          }
          onDuplicateManualItem={duplicateManualItem}
          onRemoveManualItem={removeManualItem}
        />
      ),
    },
    {
      ...stepDefs[4],
      title: t(stepDefs[4].titleKey),
      content: (
        <ExpenseStep
          rows={expenseRows}
          defaultStartMonth={draft.profile.startMonth ?? ""}
          manualRows={manualCashflowEvents.filter((event) => event.kind === "expense")}
          onAddManualItem={(item) => addManual("expense", item)}
          onUpdateManualItem={(eventId, patch) =>
            setDraft((current) => ({
              ...current,
              events: current.events.map((event) =>
                hasId(event) && isCashflowDraft(event) && event.id === eventId
                  ? {
                      ...event,
                      label: patch.label ?? event.label,
                      amount: patch.amount ?? event.amount,
                      cadence: patch.cadence ?? event.cadence,
                      startMonth: patch.startMonth ?? event.startMonth,
                      endMonth: patch.endMonth ?? event.endMonth,
                      expenseCategory: patch.expenseCategory ?? event.expenseCategory,
                      tags: patch.tags ?? event.tags,
                      customGrowthRatePct: patch.customGrowthRatePct ?? event.customGrowthRatePct,
                    }
                  : event
              ),
            }))
          }
          onRemoveManualItem={removeManualItem}
        />
      ),
    },
    {
      ...stepDefs[5],
      title: t(stepDefs[5].titleKey),
      content: (
        <ReviewStep
          summary={reviewSummary}
          completenessSummary={completenessSummary}
          guardrailSummary={guardrailSummary}
          onEditStep={(index) => setStep(index)}
          onEditCompletenessGroup={(stepId) => {
            const targetIndex = stepIndexById[stepId];
            if (typeof targetIndex === "number") {
              setStep(targetIndex);
            }
          }}
          onFixGuardrail={handleFixGuardrail}
        />
      ),
    },
  ];

  const handleSubmit = async () => {
    if (isSubmitting || !scenarioId || !scenario) {
      return;
    }

    setIsSubmitting(true);
    setSubmitPhase("validating");
    setSaveFeedback(null);

    const submissionAssets = draft.assets.map((asset) => {
      if (asset.assetType === "cash") {
        const value = asset.amount ?? asset.currentValue;
        return { ...asset, currentValue: value };
      }

      if (asset.assetType === "investment") {
        const value = asset.principal ?? asset.currentValue;
        return { ...asset, currentValue: value };
      }

      return asset;
    });

    const mappedEvents = mapOnboardingV3EventTypes(mergedEvents);
    const initialCash = draft.assets
      .filter((asset) => asset.assetType === "cash")
      .reduce((sum, asset) => sum + (asset.amount ?? asset.currentValue ?? 0), 0);

    const submitResult = submitScenarioDraft({
      source: "onboarding",
      target: { scenarioId },
      draft: {
        assumptions: {
          ...draft.assumptions,
          baseMonth: draft.profile.startMonth,
          horizonMonths: draft.profile.horizonMonths,
          initialCash,
        },
        members: draft.members,
        assets: submissionAssets,
        events: mappedEvents,
        meta: { onboardingVersion: 3, onboarded: true, personaFocuses: draft.personaFocuses },
        clientComputed: { onboardingCompleted: true },
        baseCurrency: draft.profile.baseCurrency,
      },
      context: {
        assumptionsBase: scenario.assumptions,
        metaBase: scenario.meta,
        clientComputedBase: scenario.clientComputed,
      },
    });

    if (!submitResult.ok) {
      setValidationMessages(submitResult.errors.map((issue) => issue.message));
      setSubmitPhase("idle");
      setIsSubmitting(false);
      return;
    }

    setSubmitPhase("saving");
    submitOnboardingV3Payload(scenarioId, submitResult.payload, {
      updateScenarioBaseCurrency: useScenarioStore.getState().updateScenarioBaseCurrency,
      updateScenarioAssumptions: useScenarioStore.getState().updateScenarioAssumptions,
      setScenarioMembers: useScenarioStore.getState().setScenarioMembers,
      setScenarioAssets: useScenarioStore.getState().setScenarioAssets,
      setScenarioLiabilities: useScenarioStore.getState().setScenarioLiabilities,
      setScenarioEvents: useScenarioStore.getState().setScenarioEvents,
      updateScenarioMeta: useScenarioStore.getState().updateScenarioMeta,
      updateScenarioClientComputed: useScenarioStore.getState().updateScenarioClientComputed,
    });

    recordScenarioMigrationEvent({
      name: "onboarding_completed",
      ts: new Date().toISOString(),
      route: "onboarding",
      scenarioId,
      source: "onboarding",
      details: { action: "save", onboardingVersion: 3 },
    });

    setValidationMessages([]);
    setSaveFeedback("ready");

    if (scenarioContext && scenarioContext.scenarioId === scenarioId) {
      const payload = exportScenarioState() as Record<string, unknown>;
      const nextMeta = {
        ...(payload.meta && typeof payload.meta === "object" ? payload.meta : {}),
        ...submitResult.payload.meta,
      };
      payload.meta = nextMeta;

      try {
        const saveResult = await saveScenarioPayloadAction(
          scenarioContext.caseId,
          scenarioContext.scenarioId,
          payload,
          scenarioContext.revision,
        );

        if (!saveResult.ok) {
          throw new Error("REVISION_CONFLICT");
        }

        useScenarioCloudStore.getState().markSaved(
          scenarioContext.scenarioId,
          JSON.stringify(payload),
          saveResult.revision,
          saveResult.lastSavedAt,
        );
      } catch (error) {
        console.error("Failed to persist onboarding v3 payload", error);
        setValidationMessages([t("errors.saveFailed")]);
        setSubmitPhase("idle");
        setSaveFeedback(null);
        setIsSubmitting(false);
        return;
      }
    }

    trackOnboardingFunnelEvent("onboarding_completed", {
      locale,
      flowVersion: "onboarding_v3",
      reviewStepId: "review",
      reviewSessionId:
        reviewAnalyticsStateRef.current.activeReviewSessionId ?? createOnboardingReviewSessionId(),
      reviewSourceContext:
        reviewAnalyticsStateRef.current.activeReviewSessionId
          ? reviewAnalyticsStateRef.current.activeReviewSourceContext
          : "initial_review",
      completenessLevel: completenessSummary.level,
      completenessScorePct: completenessSummary.scorePct,
      guardrailLevel: guardrailSummary.level,
      guardrailCount: guardrailSummary.counts.total,
      criticalGuardrailCount: guardrailSummary.counts.critical,
      warningGuardrailCount: guardrailSummary.counts.warning,
      infoGuardrailCount: guardrailSummary.counts.info,
    });
    trackMarketEntryOnboardingCompletedFromContext(locale);

    clearOnboardingDraftState(scenarioId);
    setSubmitPhase("redirecting");

    if (caseId) {
      router.replace(scenarioDashboardPath(caseId, scenarioId));
      return;
    }

    router.replace(memberCasesPath());
  };

  return (
    <Stack gap="md">
      <RouteLoadingOverlay
        opened={isSubmitting}
        title={t(`submitFeedback.${submitPhase === "idle" ? "saving" : submitPhase}.title`)}
        description={t(
          `submitFeedback.${submitPhase === "idle" ? "saving" : submitPhase}.description`
        )}
      />
      {validationMessages.length > 0 ? <Alert color="red">{validationMessages.join("\n")}</Alert> : null}
      {presetFeedbackTitle ? (
        <Notification color="teal" onClose={() => setPresetFeedbackTitle(null)}>
          {t("presetSuggestions.feedback", { title: presetFeedbackTitle })}
        </Notification>
      ) : null}
      {saveFeedback === "ready" && isSubmitting ? (
        <Notification color="teal">{t("submitFeedback.readyToast")}</Notification>
      ) : null}
      {showPresetSuggestions ? (
        <ActiveScenarioOnboardingDraftPresetSection
          presets={presetSeeds}
          hasExistingDraft={hasExistingOnboardingDraft}
          isApplyingPreset={applyingPresetId !== null}
          applyingPresetId={applyingPresetId}
          onApplyPreset={handleApplyPreset}
        />
      ) : null}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Group align="center" gap="md" wrap="nowrap" 
                    visibleFrom="md"
          h="calc(100vh - 140px)"
          style={{ position: "sticky", top: 70 }}>
            <Stack gap={0} w={36} justify="center" h="100%">
              {steps.map((stepDef, index) => {
                const active = index === step;
                const done = index < step;
                return (
                  <Stack key={stepDef.id} gap={6} align="center">
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setStep(index)}
                      aria-label={stepDef.title}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        border: `1px solid ${active ? "var(--mantine-color-aurora-6)" : "var(--mantine-color-gray-3)"}`,
                        background: active ? "var(--mantine-color-aurora-0)" : "var(--mantine-color-white)",
                        color: done || active ? "var(--mantine-color-dark-8)" : "var(--mantine-color-gray-6)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {index + 1}
                    </Box>
                    {index < steps.length - 1 ? (
                      <Box
                        h={42}
                        w={1}
                        bg={index < step ? "aurora.6" : "gray.3"}
                      />
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>
            <Stack gap="md" style={{ flex: 1 }} justify="center" h="100%">
              <AspectRatio ratio={4 / 3} maw={680} w="100%" mx="auto">
                <Image
                  src={onboardingStepImages[step] ?? onboardingStepImages[onboardingStepImages.length - 1]}
                  alt={steps[step]?.title}
                />
              </AspectRatio>
            </Stack>
          </Group>

        <OnboardingV2WizardShell
          steps={steps}
          activeStep={step}
          onStepChange={setStep}
          hideDesktopStepper
          navigation={
            <>
              <Button
                variant="default"
                onClick={() => {
                  if (isSubmitting) {
                    return;
                  }
                  if (step === 0) {
                    router.push(memberCasesPath());
                    return;
                  }
                  setStep((current) => Math.max(current - 1, 0));
                }}
              >
                {step === 0 ? appShellT("backToCases") : t("navigation.back")}
              </Button>
              {step < steps.length - 1 ? (
                <Button disabled={isSubmitting} onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>
                  {t("navigation.next")}
                </Button>
              ) : (
                <Button loading={isSubmitting} disabled={isSubmitting} onClick={handleSubmit}>
                  {t("navigation.completeAndWriteToCore")}
                </Button>
              )}
            </>
          }
        />
      </SimpleGrid>
    </Stack>
  );
}
