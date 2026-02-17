"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import classes from "./ScenarioAppShell.module.css";

const AUTOSAVE_DELAY_MS = 45_000;

type ScenarioAppShellV2Props = {
  title: string;
  children: ReactNode;
};

type WorkspaceTab = {
  href: string;
  label: string;
};

export default function ScenarioAppShellV2({ title, children }: ScenarioAppShellV2Props) {
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

  const backToCasesHref = memberCasesPath(caseId);

  return (
    <section className={`${classes.shell} ${isMobile ? classes.shellMobile : ""}`}>
      {!isMobile ? (
        <aside className={classes.sidebar}>
          <div className={classes.sidebarTop}>
            <div className={classes.logoWrap}>
              <BrandLogo href={backToCasesHref} size="md" />
            </div>
            <nav className={classes.navList}>
              {tabs.map((tab) => {
                const active = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`${classes.navLink} ${active ? classes.navLinkActive : ""}`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href={backToCasesHref} className={classes.backLink}>
            ← Back to Cases
          </Link>
        </aside>
      ) : null}
      <div className={classes.main}>
        <header className={classes.topBar}>
          <h1 className={classes.title}>{title}</h1>
          {meta ? (
            <div className={classes.topRight}>
              {!isMobile ? <SaveStatusChip status={meta.saveStatus} /> : null}
              {!isMobile ? (
                <span className={classes.updatedAt}>
                  {meta.lastSavedAt ? `Updated ${formatIsoYmdHms(meta.lastSavedAt)}` : "Not saved yet"}
                </span>
              ) : null}
              {isMobile ? (
                <div className={classes.mobileActions}>
                  <Link href={scenarioSettingsPath(caseId, scenarioId)} className={classes.mobileActionLink}>
                    設定
                  </Link>
                  <Link href={backToCasesHref} className={classes.mobileActionLink}>
                    返回 Cases
                  </Link>
                </div>
              ) : null}
              <div className={classes.saveButtonWrap}>
                <SaveButton onClick={() => void save("manual")} disabled={!enabled || meta.saveStatus === "saving"} />
              </div>
            </div>
          ) : null}
        </header>
        <div className={classes.content}>{children}</div>
        {isMobile ? (
          <div className={classes.bottomWrap}>
            <BottomNav items={mobileTabs} />
          </div>
        ) : null}
      </div>
      <RevisionConflictModal
        open={showConflict}
        onClose={() => setShowConflict(false)}
        onReload={() => void handleReload()}
        onSaveAsNew={() => void handleSaveAsNew()}
        busy={conflictBusy}
      />
    </section>
  );
}
