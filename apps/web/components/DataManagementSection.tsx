"use client";

import { Button, Card, Divider, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages, useTranslations } from "next-intl";
import { scenarioOnboardingPath } from "../lib/routes/appRoutes";
import ActiveScenarioSettingsDataManagementPresetRecoverySection from "../src/features/onboarding/v3/ActiveScenarioSettingsDataManagementPresetRecoverySection";
import {
  hasPersistedOnboardingDraftState,
  replaceActiveScenarioOnboardingDraftPresetState,
} from "../src/features/onboarding/v3/draftStorage";
import { createInitialScenarioDraftV3State } from "../src/features/onboarding/v3/types";
import { RouteLoadingOverlay } from "../src/components/loading/route-loading-overlay";
import { MEMBER_CASE_PRESET_SEED_IDS } from "../src/features/onboarding/seedPrefill";
import { exportJSON } from "../src/persistence/storage";
import { createScenarioSeedTranslatorFromMessages, getScenarioSeeds } from "../src/scenarios/scenarioSeeds";
import { selectPersistedState, useScenarioStore } from "../src/store/scenarioStore";

type DataManagementSectionProps = {
  caseId?: string;
  scenarioId?: string;
  onNotify: (message: string, color?: string) => void;
};

export default function DataManagementSection({
  caseId,
  scenarioId,
  onNotify,
}: DataManagementSectionProps) {
  const t = useTranslations("dataManagement");
  const onboardingT = useTranslations("onboardingV3");
  const seedEventLabelT = useTranslations("scenarios.seeds.eventLabels");
  const messages = useMessages();
  const router = useRouter();
  const scenarioState = useScenarioStore();
  const payload = useMemo(() => selectPersistedState(scenarioState), [scenarioState]);
  const [applyingPresetId, setApplyingPresetId] = useState<string | null>(null);
  const [hasExistingOnboardingDraft, setHasExistingOnboardingDraft] = useState(() =>
    hasPersistedOnboardingDraftState(scenarioId)
  );

  const prefillLabels = useMemo(
    () => ({
      dailyExpenseLabel: onboardingT("steps.expense.dailyMonthlyLabel"),
      incomeBonusLabel: onboardingT("steps.income.templates.bonus"),
      incomeSalaryLabel: onboardingT("steps.income.templates.salary"),
      rentExpenseLabel: seedEventLabelT("rent"),
      taxExpenseLabel: onboardingT("steps.expense.taxTitle"),
      travelExpenseLabel: onboardingT("steps.expense.travelTitle"),
    }),
    [onboardingT, seedEventLabelT]
  );
  const recoveryPresetSeeds = useMemo(() => {
    const translator = createScenarioSeedTranslatorFromMessages(messages as Record<string, unknown>);
    const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

    return getScenarioSeeds(translator).filter((seed) => presetAllowlist.has(seed.id));
  }, [messages]);

  useEffect(() => {
    setHasExistingOnboardingDraft(hasPersistedOnboardingDraftState(scenarioId));
  }, [scenarioId]);

  const handleExport = () => {
    const result = exportJSON(payload);
    if (!result.ok) {
      onNotify(t("exportFailed"), "red");
      return;
    }

    onNotify(t("exportSuccess"), "teal");
  };

  const handleApplyPreset = useCallback(
    (preset: (typeof recoveryPresetSeeds)[number]) => {
      if (!caseId || !scenarioId) {
        return;
      }

      setApplyingPresetId(preset.id);
      replaceActiveScenarioOnboardingDraftPresetState({
        scenarioId,
        presetPayload: preset.payload,
        fallbackState: createInitialScenarioDraftV3State({
          defaultMemberName: onboardingT("defaults.memberName"),
        }),
        labels: prefillLabels,
      });
      setHasExistingOnboardingDraft(true);
      router.push(scenarioOnboardingPath(caseId, scenarioId));
    },
    [caseId, onboardingT, prefillLabels, router, scenarioId]
  );

  return (
    <Card withBorder radius="md" padding="md">
      {applyingPresetId ? (
        <RouteLoadingOverlay
          opened
          title={t("presetRecovery.redirecting.title")}
          description={t("presetRecovery.redirecting.description")}
        />
      ) : null}
      <Stack gap="lg">
        <Stack gap={4}>
          <Text fw={600}>{t("title")}</Text>
          <Text size="sm" c="dimmed">
            {t("subtitle")}
          </Text>
        </Stack>

        <Stack gap="xs">
          <Text fw={600}>{t("exportTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("exportDescription")}
          </Text>
          <Button onClick={handleExport}>{t("exportButton")}</Button>
        </Stack>

        {caseId && scenarioId ? (
          <>
            <Divider />
            <ActiveScenarioSettingsDataManagementPresetRecoverySection
              presets={recoveryPresetSeeds}
              hasExistingDraft={hasExistingOnboardingDraft}
              isApplyingPreset={applyingPresetId !== null}
              applyingPresetId={applyingPresetId}
              onApplyPreset={handleApplyPreset}
            />
          </>
        ) : null}
      </Stack>
    </Card>
  );
}
