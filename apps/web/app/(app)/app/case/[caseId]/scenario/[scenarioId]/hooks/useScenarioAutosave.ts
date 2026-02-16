"use client";

import { useEffect } from "react";
import type { ScenarioCloudMeta } from "../../../../../../../../src/store/scenarioCloudStore";

type Params = {
  enabled: boolean;
  delayMs: number;
  meta?: ScenarioCloudMeta;
  onAutosave: () => Promise<void>;
};

export function useScenarioAutosave({ enabled, delayMs, meta, onAutosave }: Params) {
  useEffect(() => {
    if (!enabled || !meta || !meta.dirty || meta.saveStatus === "saving") {
      return;
    }

    const baselineAt = meta.lastChangeAt ?? Date.now();
    const elapsed = Date.now() - baselineAt;
    const waitMs = Math.max(delayMs - elapsed, 0);
    const timer = setTimeout(() => {
      void onAutosave();
    }, waitMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, enabled, meta, onAutosave]);
}
