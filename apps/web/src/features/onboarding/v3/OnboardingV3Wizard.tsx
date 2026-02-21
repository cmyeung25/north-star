"use client";

import { Alert, Button, Stack, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

const stepDefs = [
  { id: "scenarioSetup", title: "Scenario setup" },
  { id: "household", title: "Household" },
  { id: "assets", title: "Assets" },
  { id: "income", title: "Income" },
  { id: "expense", title: "Expense" },
  { id: "review", title: "Review" },
] as const;

export default function OnboardingV3Wizard() {
  const params = useParams<{ scenarioId?: string | string[] }>();
  const scenarioId = Array.isArray(params?.scenarioId) ? params?.scenarioId[0] : params?.scenarioId;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const scenario = getScenarioById(scenarios, scenarioId ?? null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(createInitialScenarioDraftV3State);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const derived = useMemo(
    () => deriveFromProperty({ profile: draft.profile, assets: draft.assets }),
    [draft.assets, draft.profile]
  );

  const incomeRows = useMemo(
    () =>
      derived.events.filter(
        (event): event is typeof event & { type: "cashflow"; kind: "income" } =>
          event.type === "cashflow" && event.kind === "income"
      ),
    [derived.events]
  );

  const expenseRows = useMemo(
    () =>
      derived.events.filter(
        (event): event is typeof event & { type: "cashflow"; kind: "expense" } =>
          event.type === "cashflow" && event.kind === "expense"
      ),
    [derived.events]
  );

  const mergedEvents = useMemo(() => {
    const byId = new Map((draft.events ?? []).filter((event) => event.id).map((event) => [event.id as string, event]));
    return derived.events.map((event) => {
      const override = event.id ? byId.get(event.id) : undefined;
      if (!override || event.type !== "cashflow") {
        return event;
      }
      const overrideAmount = override.type === "cashflow" ? override.amount : undefined;
      return { ...event, amount: overrideAmount ?? event.amount };
    });
  }, [derived.events, draft.events]);

  const reviewItems = [
    { label: "profile.startMonth", completed: Boolean(draft.profile.startMonth), warning: "尚未填寫開始月份" },
    { label: "profile.baseCurrency", completed: Boolean(draft.profile.baseCurrency), warning: "使用預設幣別" },
    { label: "members", completed: draft.members.length > 0 && draft.members.every((m) => Boolean(m.name)), warning: "有成員尚未命名" },
    { label: "assets.property", completed: draft.assets.length > 0, warning: "尚未新增房產" },
    { label: "generated.income/expense", completed: mergedEvents.length > 0, warning: "沒有可衍生現金流" },
  ];

  const steps = [
    {
      ...stepDefs[0],
      content: <ScenarioSetupStep profile={draft.profile} onChange={(profile) => setDraft((current) => ({ ...current, profile }))} />,
    },
    {
      ...stepDefs[1],
      content: <HouseholdStep members={draft.members} onChange={(members) => setDraft((current) => ({ ...current, members }))} />,
    },
    {
      ...stepDefs[2],
      content: (
        <AssetsStep
          assets={draft.assets}
          startMonth={draft.profile.startMonth ?? ""}
          onChange={(assets) => setDraft((current) => ({ ...current, assets }))}
        />
      ),
    },
    {
      ...stepDefs[3],
      content: (
        <IncomeStep
          rows={incomeRows}
          onOverrideAmount={(eventId, amount) =>
            setDraft((current) => ({
              ...current,
              events: [...current.events.filter((event) => event.id !== eventId), { ...(current.events.find((event) => event.id === eventId) ?? { id: eventId }), amount, type: "cashflow", kind: "income", cadence: "monthly", startMonth: current.profile.startMonth ?? "" }],
            }))
          }
        />
      ),
    },
    {
      ...stepDefs[4],
      content: (
        <ExpenseStep
          rows={expenseRows}
          onOverrideAmount={(eventId, amount) =>
            setDraft((current) => ({
              ...current,
              events: [...current.events.filter((event) => event.id !== eventId), { ...(current.events.find((event) => event.id === eventId) ?? { id: eventId }), amount, type: "cashflow", kind: "expense", cadence: "monthly", startMonth: current.profile.startMonth ?? "" }],
            }))
          }
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
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>Next</Button>
            ) : (
              <Button onClick={handleSubmit}>完成並寫入 Core</Button>
            )}
          </>
        }
      />
      <Text size="xs" c="dimmed">V3 flow 僅更新本地 ScenarioDraftV3 分段 state，最後一步一次提交。</Text>
    </Stack>
  );
}
