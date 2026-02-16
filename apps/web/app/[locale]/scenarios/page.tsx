"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { buildAppScenarioUrl } from "../../../lib/routes";

type LastOpened = {
  caseId?: string;
  scenarioId?: string;
};

const FALLBACK_PATH = "/member/cases";

export default function LegacyScenariosRedirectPage() {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) {
      return;
    }
    redirected.current = true;

    const raw = typeof window !== "undefined" ? window.localStorage.getItem("aurin:lastOpened") : null;

    if (!raw) {
      router.replace(FALLBACK_PATH);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LastOpened;
      if (!parsed.caseId || !parsed.scenarioId) {
        router.replace(FALLBACK_PATH);
        return;
      }

      router.replace(
        buildAppScenarioUrl({
          caseId: parsed.caseId,
          scenarioId: parsed.scenarioId,
        }),
      );
    } catch {
      router.replace(FALLBACK_PATH);
    }
  }, [router]);

  return null;
}
