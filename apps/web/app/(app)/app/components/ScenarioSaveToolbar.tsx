"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  duplicateScenarioFromLocalPayloadAction,
  reloadScenarioPayloadAction,
  saveScenarioPayloadAction,
} from "../actions/scenarioSave.actions";
import { useScenarioAutosave } from "../hooks/useScenarioAutosave";
import { selectPersistedState, useScenarioStore } from "../../../../src/store/scenarioStore";
import { importScenarioState } from "../../../../src/store/scenarioState";
import { useScenarioCloudStore } from "../../../../src/store/scenarioCloudStore";
import RevisionConflictModal from "./RevisionConflictModal";
import SaveButton from "./SaveButton";
import SaveStatusChip from "./SaveStatusChip";
import { buildAppScenarioUrl } from "../../../../lib/routes";

const AUTOSAVE_DELAY_MS = 45_000;

const toPayload = () => selectPersistedState(useScenarioStore.getState()) as unknown as Record<string, unknown>;

export default function ScenarioSaveToolbar() {
  const params = useParams<{ caseId?: string; scenarioId?: string }>();
  const router = useRouter();
  const [showConflict, setShowConflict] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  const persistedState = useScenarioStore(selectPersistedState);
  const meta = useScenarioCloudStore((state) => state.active);
  const { markError, markSaved, markSaving, markUnsaved } = useScenarioCloudStore.getState();

  const caseId = params.caseId;
  const scenarioId = params.scenarioId;
  const enabled = Boolean(caseId && scenarioId && meta?.scenarioId === scenarioId);

  const payloadHash = useMemo(() => JSON.stringify(persistedState), [persistedState]);

  useEffect(() => {
    if (enabled && meta?.scenarioId === scenarioId && scenarioId) {
      markUnsaved(scenarioId, payloadHash);
    }
  }, [enabled, markUnsaved, meta?.scenarioId, payloadHash, scenarioId]);

  const save = useCallback(
    async (source: "manual" | "autosave") => {
      if (!caseId || !scenarioId || !meta || meta.scenarioId !== scenarioId || meta.saveStatus === "saving") {
        return;
      }

      const payload = toPayload();
      const nextHash = JSON.stringify(payload);

      try {
        markSaving(scenarioId);
        const result = await saveScenarioPayloadAction(caseId, scenarioId, payload, meta.revision);
        markSaved(scenarioId, nextHash, result.revision, result.lastSavedAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Save failed";
        markError(scenarioId, message);

        if (message === "REVISION_CONFLICT") {
          if (source === "manual") {
            setShowConflict(true);
          }
          return;
        }

        if (source === "autosave") {
          console.warn("Autosave failed", error);
        }
      }
    },
    [caseId, markError, markSaved, markSaving, meta, scenarioId],
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

    const confirmed = window.confirm("重載會丟棄本地未保存變更，是否繼續？");
    if (!confirmed) {
      return;
    }

    setConflictBusy(true);
    try {
      const result = await reloadScenarioPayloadAction(caseId, scenarioId);
      importScenarioState(result.payload as never);
      const reloadedHash = JSON.stringify(result.payload);
      markSaved(scenarioId, reloadedHash, result.revision, result.lastSavedAt);
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
      const payload = toPayload();
      const result = await duplicateScenarioFromLocalPayloadAction(caseId, scenarioId, payload);
      router.replace(buildAppScenarioUrl({ caseId, scenarioId: result.scenarioId }));
      setShowConflict(false);
    } finally {
      setConflictBusy(false);
    }
  };

  if (!enabled || !meta) {
    return null;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <SaveStatusChip status={meta.saveStatus} />
        <span style={{ fontSize: 12, color: "#525252" }}>
          Last saved: {meta.lastSavedAt ? new Date(meta.lastSavedAt).toLocaleString() : "—"}
        </span>
        <span style={{ fontSize: 12, color: "#525252" }}>rev {meta.revision}</span>
        <SaveButton
          onClick={() => void save("manual")}
          disabled={meta.saveStatus === "saving" || !scenarioId}
          title={!scenarioId ? "Scenario ID missing" : undefined}
        />
        {meta.saveStatus === "error" && meta.lastSaveError ? (
          <span style={{ fontSize: 12, color: "#b91c1c" }}>{meta.lastSaveError}</span>
        ) : null}
      </div>
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
