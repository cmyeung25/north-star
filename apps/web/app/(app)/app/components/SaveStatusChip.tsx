"use client";

import type { ScenarioSaveStatus } from "../../../../src/store/scenarioCloudStore";

const LABELS: Record<ScenarioSaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved",
  saving: "Saving",
  error: "Error",
  conflict: "Conflict",
};

const COLORS: Record<ScenarioSaveStatus, string> = {
  saved: "#0f766e",
  unsaved: "#92400e",
  saving: "#1d4ed8",
  error: "#b91c1c",
  conflict: "#b45309",
};

export default function SaveStatusChip({ status }: { status: ScenarioSaveStatus }) {
  return (
    <span
      style={{
        border: `1px solid ${COLORS[status]}`,
        color: COLORS[status],
        borderRadius: 999,
        padding: "0.2rem 0.6rem",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {LABELS[status]}
    </span>
  );
}
