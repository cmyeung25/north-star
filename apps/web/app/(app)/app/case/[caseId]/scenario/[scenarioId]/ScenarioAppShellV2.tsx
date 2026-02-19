"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  Box,
  Group,
  Text,
  alpha,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { buildAppScenarioUrl } from "../../../../../../../lib/routes";
import { formatIsoYmdHms } from "../../../../../../../lib/date/format";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  duplicateScenarioFromLocalPayloadAction,
  reloadScenarioPayloadAction,
  saveScenarioPayloadAction,
} from "./actions";
import SaveButton from "../../../../components/SaveButton";
import SaveStatusChip from "../../../../components/SaveStatusChip";
import { exportScenarioState, importScenarioState } from "../../../../../../../src/store/scenarioState";
import { useScenarioStore } from "../../../../../../../src/store/scenarioStore";
import { useScenarioContext } from "../../../../../../../src/hooks/useScenarioContext";
import { useScenarioAutosave } from "./hooks/useScenarioAutosave";
import { useScenarioCloudStore } from "../../../../../../../src/store/scenarioCloudStore";
import RevisionConflictModal from "./components/RevisionConflictModal";
import { memberCasesPath, scenarioSettingsPath } from "../../../../../../../lib/routes/appRoutes";
import BrandLogo from "../../../../../../../components/brand/BrandLogo";
import BottomNav from "../../../../../../../components/BottomNav";
import AppHeaderTitle from "./components/AppHeaderTitle";
import AppSidebar from "./components/AppSidebar";

const AUTOSAVE_DELAY_MS = 45_000;
const NAVBAR_WIDTH = 264;

type ScenarioAppShellV2Props = {
  caseTitle?: string;
  scenarioTitle: string;
  children: ReactNode;
};

type WorkspaceTab = {
  href: string;
  label: string;
};

export default function ScenarioAppShellV2({ caseTitle, scenarioTitle, children }: ScenarioAppShellV2Props) {
  const theme = useMantineTheme();
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const scenarioContext = useScenarioContext();
  const meta = useScenarioCloudStore((state) => state.active);
  const saveNow = useScenarioCloudStore((state) => state.saveNow);
  const markUnsaved = useScenarioCloudStore((state) => state.markUnsaved);
  const markSaved = useScenarioCloudStore((state) => state.markSaved);

  const [showConflict, setShowConflict] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);

  const payloadHash = useMemo(
    () =>
      JSON.stringify({
        scenarios,
        eventLibrary,
        activeScenarioId,
        members,
        budgetRules,
        appSettings,
      }),
    [activeScenarioId, appSettings, budgetRules, eventLibrary, members, scenarios],
  );

  const caseId = scenarioContext?.caseId ?? "";
  const scenarioId = scenarioContext?.scenarioId ?? "";

  const appScenarioUrl = buildAppScenarioUrl({ caseId, scenarioId });

  const tabs: WorkspaceTab[] = [
    { href: `${appScenarioUrl}/dashboard`, label: "Dashboard" },
    { href: `${appScenarioUrl}/planlab`, label: "PlanLab" },
    { href: `${appScenarioUrl}/money`, label: "Money" },
    { href: scenarioSettingsPath(caseId, scenarioId), label: "Scenario Settings" },
  ];
  const mobileTabs = tabs.slice(0, 3);

  const enabled = Boolean(meta && scenarioId && meta.scenarioId === scenarioId);

  useEffect(() => {
    if (enabled) {
      markUnsaved(scenarioId, payloadHash);
    }
  }, [enabled, markUnsaved, payloadHash, scenarioId]);

  const save = useCallback(
    async (source: "manual" | "autosave") => {
      if (!enabled) {
        return;
      }

      const payload = exportScenarioState() as unknown as Record<string, unknown>;
      const nextHash = JSON.stringify(payload);
      const result = await saveNow({
        payload,
        payloadHash: nextHash,
        save: ({ caseId: nextCaseId, scenarioId: nextScenarioId, payload: nextPayload, expectedRevision }) =>
          saveScenarioPayloadAction(nextCaseId, nextScenarioId, nextPayload, expectedRevision),
      });

      if (!result.ok && result.reason === "conflict") {
        if (source === "manual") {
          setShowConflict(true);
        }
        return;
      }

      if (!result.ok && source === "autosave") {
        console.warn("Autosave failed");
      }
    },
    [enabled, saveNow],
  );

  useScenarioAutosave({
    enabled,
    delayMs: AUTOSAVE_DELAY_MS,
    meta,
    onAutosave: async () => {
      await save("autosave");
    },
  });

  const handleReload = async () => {
    if (!caseId || !scenarioId) {
      return;
    }

    setConflictBusy(true);
    try {
      const result = await reloadScenarioPayloadAction(caseId, scenarioId);
      importScenarioState(result.payload as never);
      markSaved(scenarioId, JSON.stringify(result.payload), result.revision, result.lastSavedAt);
      setShowConflict(false);
    } finally {
      setConflictBusy(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!caseId || !scenarioId) {
      return;
    }

    setConflictBusy(true);
    try {
      const payload = exportScenarioState() as unknown as Record<string, unknown>;
      const result = await duplicateScenarioFromLocalPayloadAction(caseId, scenarioId, payload);
      router.replace(`${buildAppScenarioUrl({ caseId, scenarioId: result.scenarioId })}/dashboard`);
      setShowConflict(false);
    } finally {
      setConflictBusy(false);
    }
  };

  const backToCasesHref = memberCasesPath();

  return (
    <>
      <AppShell
        header={{ height: 64 }}
        navbar={isMobile ? undefined : { width: NAVBAR_WIDTH, breakpoint: "md" }}
        padding="md"
      >
        <AppShell.Header>
          <Group justify="space-between" h="100%" px="md" wrap="nowrap">
            <Group>
              <Box px="xs" py={4}>
                <BrandLogo href={backToCasesHref} size="md" />
              </Box>
              <AppHeaderTitle caseTitle={caseTitle} scenarioTitle={scenarioTitle} />
            </Group>
            {meta ? (
              <Group gap="xs" wrap="nowrap">
                {!isMobile ? <SaveStatusChip status={meta.saveStatus} /> : null}
                {!isMobile ? (
                  <Text size="xs" c="dimmed" visibleFrom="sm">
                    {meta.lastSavedAt ? `Updated ${formatIsoYmdHms(meta.lastSavedAt)}` : "Not saved yet"}
                  </Text>
                ) : null}
                <SaveButton onClick={() => void save("manual")} disabled={!enabled || meta.saveStatus === "saving"} />
              </Group>
            ) : null}
          </Group>
        </AppShell.Header>

        {!isMobile ? <AppSidebar tabs={tabs} pathname={pathname} backToCasesHref={backToCasesHref} /> : null}

        <AppShell.Main
          style={{
            backgroundColor: theme.colors.neutral[0],
            backgroundImage: `
              radial-gradient(circle at 16% 18%, ${alpha(theme.colors.aurora[6], 0.05)} 0, transparent 48%),
              radial-gradient(circle at 88% 8%, ${alpha(theme.colors.ice[4], 0.04)} 0, transparent 42%)
            `,
          }}
        >
          <Box mih="calc(100dvh - 64px)" maw="none" w="100%">
            {children}
          </Box>
          {isMobile ? (
            <Box mt="md">
              <BottomNav items={mobileTabs} />
            </Box>
          ) : null}
        </AppShell.Main>
      </AppShell>

      <RevisionConflictModal
        open={showConflict}
        onClose={() => setShowConflict(false)}
        onReload={() => void handleReload()}
        onSaveAsNew={() => void handleSaveAsNew()}
        busy={conflictBusy}
      />
    </>
  );
}
