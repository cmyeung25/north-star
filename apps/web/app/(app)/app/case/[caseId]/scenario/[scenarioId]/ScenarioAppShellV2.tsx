"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buildAppScenarioUrl } from "../../../../../../../lib/routes";
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

const AUTOSAVE_DELAY_MS = 45_000;

type ScenarioAppShellV2Props = {
  title: string;
  children: ReactNode;
};

type WorkspaceTab = {
  href: string;
  label: string;
};

const AURORA = "#7CFFB2";
const POLAR_BG = "#091425";
const POLAR_SURFACE = "#0F1D33";
const POLAR_SURFACE_ALT = "#152741";
const POLAR_TEXT = "#E6F0FF";
const POLAR_MUTED = "#95A8C6";

export default function ScenarioAppShellV2({ title, children }: ScenarioAppShellV2Props) {
  const pathname = usePathname();
  const router = useRouter();
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
    { href: `${appScenarioUrl}/money`, label: "Money" },
    { href: `${appScenarioUrl}/planlab`, label: "Plan Lab" },
  ];

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

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        minHeight: "calc(100vh - 6rem)",
        background: POLAR_BG,
        color: POLAR_TEXT,
      }}
    >
      <aside style={{ borderRight: `1px solid ${POLAR_SURFACE_ALT}`, padding: "1rem", background: POLAR_SURFACE }}>
        <div style={{ padding: "0.75rem 0.5rem 1rem", fontSize: 12, letterSpacing: "0.14em", color: AURORA, fontWeight: 700 }}>
          AURIN
        </div>
        <nav style={{ display: "grid", gap: "0.5rem" }}>
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  borderRadius: "0.7rem",
                  textDecoration: "none",
                  color: active ? "#031425" : POLAR_TEXT,
                  fontWeight: active ? 700 : 500,
                  padding: "0.6rem 0.7rem",
                  background: active ? AURORA : "transparent",
                  border: active ? "none" : `1px solid ${POLAR_SURFACE_ALT}`,
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minWidth: 0 }}>
        <header
          style={{
            borderBottom: `1px solid ${POLAR_SURFACE_ALT}`,
            padding: "0.9rem 1.1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.8rem",
            background: POLAR_SURFACE,
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.1em", color: AURORA, fontWeight: 700 }}>AURIN</div>
            <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{title}</h1>
          </div>
          {meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <SaveStatusChip status={meta.saveStatus} />
              <span style={{ fontSize: 12, color: POLAR_MUTED }}>
                {meta.lastSavedAt ? `Updated ${new Date(meta.lastSavedAt).toLocaleString()}` : "Not saved yet"}
              </span>
              <span style={{ fontSize: 12, color: POLAR_MUTED }}>rev {meta.revision}</span>
              <SaveButton onClick={() => void save("manual")} disabled={!enabled || meta.saveStatus === "saving"} />
            </div>
          ) : null}
        </header>
        <div style={{ padding: "1rem 1.1rem", minWidth: 0, background: POLAR_BG }}>{children}</div>
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
