"use client";

import { Alert, Button, Stack, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ScenarioEvent, ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import type { GeneratedItemMetadata } from "../../../domain/scenarioDraft/types";
import OnboardingV2WizardShell from "../v2/OnboardingV2WizardShell";
import { compileScenarioCreatePayload } from "../../../domain/scenarioDraft/compileScenarioCreatePayload";
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

type CashflowDraft = Extract<ScenarioEventDraft, { type: "cashflow" }>;
type CashflowDraftWithId = CashflowDraft & { id: string };
type AutoCashflowRow = Extract<ScenarioEvent, { type: "cashflow" }> & {
  metadata?: GeneratedItemMetadata;
};

const stepDefs = [
  { id: "scenarioSetup", title: "Scenario setup" },
  { id: "household", title: "Household" },
  { id: "assets", title: "Assets" },
  { id: "income", title: "Income" },
  { id: "expense", title: "Expense" },
  { id: "review", title: "Review" },
] as const;

const isCashflowDraft = (event: ScenarioEventDraft): event is CashflowDraft =>
  event.type === "cashflow";

const hasId = (event: ScenarioEventDraft): event is ScenarioEventDraft & { id: string } =>
  typeof event.id === "string" && event.id.length > 0;

export default function OnboardingV3Wizard() {
  const params = useParams<{ scenarioId?: string | string[] }>();
  const scenarioId = Array.isArray(params?.scenarioId) ? params?.scenarioId[0] : params?.scenarioId;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const scenario = getScenarioById(scenarios, scenarioId ?? null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(createInitialScenarioDraftV3State);
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
    { label: "profile.startMonth", completed: Boolean(draft.profile.startMonth), warning: "尚未填寫開始月份" },
    { label: "profile.baseCurrency", completed: Boolean(draft.profile.baseCurrency), warning: "使用預設幣別" },
    { label: "members", completed: draft.members.length > 0 && draft.members.every((m) => Boolean(m.name)), warning: "有成員尚未命名" },
    { label: "assets.property", completed: draft.assets.length > 0, warning: "尚未新增房產" },
    { label: "generated.income/expense", completed: mergedEvents.length > 0, warning: "沒有可衍生現金流" },
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

  const addManual = (kind: "income" | "expense", item: { label: string; amount: number }) => {
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
          cadence: "monthly",
          startMonth: current.profile.startMonth ?? "",
        },
      ],
    }));
  };

  const steps = [
    { ...stepDefs[0], content: <ScenarioSetupStep profile={draft.profile} onChange={(profile) => setDraft((current) => ({ ...current, profile }))} /> },
    { ...stepDefs[1], content: <HouseholdStep members={draft.members} onChange={(members) => setDraft((current) => ({ ...current, members }))} /> },
    { ...stepDefs[2], content: <AssetsStep assets={draft.assets} startMonth={draft.profile.startMonth ?? ""} onChange={(assets) => setDraft((current) => ({ ...current, assets }))} /> },
    {
      ...stepDefs[3],
      content: (
        <IncomeStep
          rows={incomeRows}
          manualRows={manualCashflowEvents.filter((event) => event.kind === "income")}
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
                  ? { ...event, label: patch.label ?? event.label, amount: patch.amount ?? event.amount }
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
    { ...stepDefs[5], content: <ReviewStep items={reviewItems} /> },
  ];

  const handleSubmit = () => {
    if (!scenarioId || !scenario) {
      return;
    }
    const payload = compileScenarioCreatePayload({
      profile: draft.profile,
      members: draft.members,
      assets: draft.assets,
      events: mergedEvents,
      meta: { onboardingVersion: 3, onboarded: true },
      clientComputed: { onboardingCompleted: true },
    });

    if (payload.validationIssues.length > 0) {
      setValidationMessages(payload.validationIssues.map((issue) => issue.message));
      return;
    }

    submitOnboardingV3Payload(scenarioId, payload, {
      updateScenarioBaseCurrency: useScenarioStore.getState().updateScenarioBaseCurrency,
      updateScenarioAssumptions: useScenarioStore.getState().updateScenarioAssumptions,
      setScenarioMembers: useScenarioStore.getState().setScenarioMembers,
      setScenarioAssets: useScenarioStore.getState().setScenarioAssets,
      setScenarioLiabilities: useScenarioStore.getState().setScenarioLiabilities,
      setScenarioEvents: useScenarioStore.getState().setScenarioEvents,
      updateScenarioMeta: useScenarioStore.getState().updateScenarioMeta,
      updateScenarioClientComputed: useScenarioStore.getState().updateScenarioClientComputed,
    });
    setValidationMessages([]);
  };

  return (
    <Stack>
      {validationMessages.length > 0 ? <Alert color="red">{validationMessages.join("\n")}</Alert> : null}
      <OnboardingV2WizardShell
        steps={steps}
        activeStep={step}
        onStepChange={setStep}
        navigation={
          <>
            <Button variant="default" onClick={() => setStep((current) => Math.max(current - 1, 0))}>Back</Button>
            {step < steps.length - 1 ? <Button onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>Next</Button> : <Button onClick={handleSubmit}>完成並寫入 Core</Button>}
          </>
        }
      />
      <Text size="xs" c="dimmed">V3 flow 僅更新本地 ScenarioDraftV3 分段 state，最後一步一次提交。</Text>
    </Stack>
  );
}
