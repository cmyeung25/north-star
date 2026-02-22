"use client";

import { Alert, Button, Stack, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ScenarioEvent, ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import type { GeneratedItemMetadata } from "../../../domain/scenarioDraft/types";
import OnboardingV2WizardShell from "../v2/OnboardingV2WizardShell";
import { deriveFromProperty } from "../../../domain/scenarioDraft/rules/deriveFromProperty";
import { getScenarioById, useScenarioStore } from "../../../store/scenarioStore";
import ScenarioSetupStep from "./steps/ScenarioSetupStep";
import HouseholdStep from "./steps/HouseholdStep";
import AssetsStep from "./steps/AssetsStep";
import IncomeStep from "./steps/IncomeStep";
import ExpenseStep from "./steps/ExpenseStep";
import ReviewStep from "./steps/ReviewStep";
import { createInitialScenarioDraftV3State } from "./types";
import { submitOnboardingV3Payload } from "./submissionFacade";
import { submitScenarioDraft } from "../../../domain/scenarioDraft/submitScenarioDraft";
import { recordScenarioMigrationEvent } from "../../../lib/telemetry/scenarioMigrationTelemetry";

type CashflowDraft = Extract<ScenarioEventDraft, { type: "cashflow" }>;
type CashflowDraftWithId = CashflowDraft & { id: string };
type AutoCashflowRow = Extract<ScenarioEvent, { type: "cashflow" }> & {
  metadata?: GeneratedItemMetadata;
};
type ManualCashflowDraftInput = {
  label?: string;
  amount: number;
  cadence?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  memberId?: string;
  startMonth?: string;
  endMonth?: string;
  followIncomeGrowth?: boolean;
};

const stepDefs = [
  { id: "scenarioSetup", titleKey: "steps.scenarioSetup" },
  { id: "household", titleKey: "steps.household" },
  { id: "assets", titleKey: "steps.assets" },
  { id: "income", titleKey: "steps.income" },
  { id: "expense", titleKey: "steps.expense" },
  { id: "review", titleKey: "steps.review" },
] as const;

const isCashflowDraft = (event: ScenarioEventDraft): event is CashflowDraft =>
  event.type === "cashflow";

const hasId = (event: ScenarioEventDraft): event is ScenarioEventDraft & { id: string } =>
  typeof event.id === "string" && event.id.length > 0;

export default function OnboardingV3Wizard() {
  const t = useTranslations("onboardingV3");
  const params = useParams<{ scenarioId?: string | string[] }>();
  const scenarioId = Array.isArray(params?.scenarioId) ? params?.scenarioId[0] : params?.scenarioId;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const scenario = getScenarioById(scenarios, scenarioId ?? null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() =>
    createInitialScenarioDraftV3State({ defaultMemberName: t("defaults.memberName") })
  );
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const derived = useMemo(() => deriveFromProperty({ profile: draft.profile, assets: draft.assets }), [draft.assets, draft.profile]);

  const autoRows = useMemo(() => derived.events as AutoCashflowRow[], [derived.events]);
  const autoEventIds = useMemo(() => new Set(autoRows.map((event) => event.id)), [autoRows]);

  const autoOverridesById = useMemo(() => {
    const overrides = new Map<string, { amount?: number; disabled?: boolean }>();
    draft.events.forEach((event) => {
      if (!hasId(event) || !isCashflowDraft(event) || !autoEventIds.has(event.id)) {
        return;
      }
      overrides.set(event.id, {
        amount: typeof event.amount === "number" ? event.amount : undefined,
        disabled: Boolean(event.meta?.disabledAuto),
      });
    });
    return overrides;
  }, [autoEventIds, draft.events]);

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

  const mergedEvents = useMemo(() => {
    const mergedAutoEvents: ScenarioEvent[] = autoRows.flatMap((event) => {
      const override = autoOverridesById.get(event.id);
      if (override?.disabled) {
        return [];
      }
      return [{ ...event, amount: override?.amount ?? event.amount }];
    });

    return [...mergedAutoEvents, ...manualCashflowEvents] as Array<ScenarioEvent | ScenarioEventDraft>;
  }, [autoOverridesById, autoRows, manualCashflowEvents]);

  const reviewItems = [
    { label: t("steps.review.items.startMonth"), completed: Boolean(draft.profile.startMonth), warning: t("reviewWarnings.startMonthMissing") },
    { label: t("steps.review.items.baseCurrency"), completed: Boolean(draft.profile.baseCurrency), warning: t("reviewWarnings.baseCurrencyDefault") },
    { label: t("steps.review.items.members"), completed: draft.members.length > 0 && draft.members.every((m) => Boolean(m.name)), warning: t("reviewWarnings.memberUnnamed") },
    { label: t("steps.review.items.assets"), completed: draft.assets.length > 0, warning: t("reviewWarnings.propertyMissing") },
    { label: t("steps.review.items.generatedCashflow"), completed: mergedEvents.length > 0, warning: t("reviewWarnings.derivedCashflowMissing") },
  ];

  const upsertAutoOverride = (eventId: string, kind: "income" | "expense", patch: { amount?: number; disabled?: boolean }) => {
    setDraft((current) => {
      const existing = current.events.find(
        (event): event is CashflowDraftWithId => hasId(event) && isCashflowDraft(event) && event.id === eventId
      );

      const nextEvent: CashflowDraftWithId = {
        ...(existing ?? {
          id: eventId,
          type: "cashflow",
          kind,
          cadence: "monthly",
          startMonth: current.profile.startMonth ?? "",
          amount: 0,
        }),
        amount: patch.amount ?? existing?.amount ?? 0,
        meta: {
          ...(existing?.meta ?? {}),
          ...(patch.disabled === undefined ? {} : { disabledAuto: patch.disabled }),
        },
      };

      return {
        ...current,
        events: [...current.events.filter((event) => event.id !== eventId), nextEvent],
      };
    });
  };

  const addManual = (kind: "income" | "expense", item: ManualCashflowDraftInput) => {
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
        },
      ],
    }));
  };

  const steps = [
    { ...stepDefs[0], title: t(stepDefs[0].titleKey), content: <ScenarioSetupStep profile={draft.profile} onChange={(profile) => setDraft((current) => ({ ...current, profile }))} /> },
    { ...stepDefs[1], title: t(stepDefs[1].titleKey), content: <HouseholdStep members={draft.members} onChange={(members) => setDraft((current) => ({ ...current, members }))} /> },
    { ...stepDefs[2], title: t(stepDefs[2].titleKey), content: <AssetsStep assets={draft.assets} startMonth={draft.profile.startMonth ?? ""} assetToggles={draft.assetToggles} onAssetsChange={(assets) => setDraft((current) => ({ ...current, assets }))} onAssetTogglesChange={(assetToggles) => setDraft((current) => ({ ...current, assetToggles }))} /> },
    {
      ...stepDefs[3],
      title: t(stepDefs[3].titleKey),
      content: (
        <IncomeStep
          rows={incomeRows}
          members={draft.members}
          defaultStartMonth={draft.profile.startMonth ?? ""}
          manualRows={manualCashflowEvents
            .filter((event) => event.kind === "income")
            .map((event) => ({
              ...event,
              followIncomeGrowth: event.growthMode !== "none",
            }))}
          overrides={Object.fromEntries(autoOverridesById.entries())}
          onOverrideAmount={(eventId, amount) => upsertAutoOverride(eventId, "income", { amount })}
          onRestoreSuggested={(eventId) => setDraft((current) => ({ ...current, events: current.events.filter((event) => event.id !== eventId) }))}
          onToggleDisabled={(eventId, disabled) => upsertAutoOverride(eventId, "income", { disabled })}
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
                      growthMode:
                        typeof patch.followIncomeGrowth === "boolean"
                          ? (patch.followIncomeGrowth ? "assumption" : "none")
                          : event.growthMode,
                    }
                  : event
              ),
            }))
          }
          onRemoveManualItem={(eventId) => setDraft((current) => ({ ...current, events: current.events.filter((event) => event.id !== eventId) }))}
        />
      ),
    },
    {
      ...stepDefs[4],
      title: t(stepDefs[4].titleKey),
      content: (
        <ExpenseStep
          rows={expenseRows}
          manualRows={manualCashflowEvents.filter((event) => event.kind === "expense")}
          overrides={Object.fromEntries(autoOverridesById.entries())}
          onOverrideAmount={(eventId, amount) => upsertAutoOverride(eventId, "expense", { amount })}
          onRestoreSuggested={(eventId) => setDraft((current) => ({ ...current, events: current.events.filter((event) => event.id !== eventId) }))}
          onToggleDisabled={(eventId, disabled) => upsertAutoOverride(eventId, "expense", { disabled })}
          onAddManualItem={(item) => addManual("expense", item)}
          onUpdateManualItem={(eventId, patch) =>
            setDraft((current) => ({
              ...current,
              events: current.events.map((event) =>
                hasId(event) && isCashflowDraft(event) && event.id === eventId
                  ? { ...event, label: patch.label ?? event.label, amount: patch.amount ?? event.amount }
                  : event
              ),
            }))
          }
          onRemoveManualItem={(eventId) => setDraft((current) => ({ ...current, events: current.events.filter((event) => event.id !== eventId) }))}
        />
      ),
    },
    { ...stepDefs[5], title: t(stepDefs[5].titleKey), content: <ReviewStep items={reviewItems} /> },
  ];

  const handleSubmit = () => {
    if (!scenarioId || !scenario) {
      return;
    }

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

    const submitResult = submitScenarioDraft({
      source: "onboarding",
      target: { scenarioId },
      draft: {
        assumptions: {
          baseMonth: draft.profile.startMonth,
          horizonMonths: draft.profile.horizonMonths,
        },
        members: draft.members,
        assets: submissionAssets,
        events: mergedEvents,
        meta: { onboardingVersion: 3, onboarded: true },
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
      return;
    }

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
  };

  return (
    <Stack gap="md">
      {validationMessages.length > 0 ? <Alert color="red">{validationMessages.join("\n")}</Alert> : null}
      <OnboardingV2WizardShell
        steps={steps}
        activeStep={step}
        onStepChange={setStep}
        navigation={
          <>
            <Button variant="default" onClick={() => setStep((current) => Math.max(current - 1, 0))}>{t("navigation.back")}</Button>
            {step < steps.length - 1 ? <Button onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>{t("navigation.next")}</Button> : <Button onClick={handleSubmit}>{t("navigation.completeAndWriteToCore")}</Button>}
          </>
        }
      />
      <Text size="xs" c="dimmed">{t("footer.localDraftHint")}</Text>
    </Stack>
  );
}
