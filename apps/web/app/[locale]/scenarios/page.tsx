"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { buildAppScenarioUrl } from "../../../lib/routes";

type LastOpened = {
  caseId?: string;
  scenarioId?: string;
};

const FALLBACK_PATH = "/member/cases";

export default function LegacyScenariosRedirectPage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    const redirectToFallback = () => {
      router.replace(`/${locale}${FALLBACK_PATH}`);
    };

    if (typeof window === "undefined") {
      redirectToFallback();
      return;
    }

    const raw = window.localStorage.getItem("aurin:lastOpened");
    if (!raw) {
      redirectToFallback();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LastOpened;
      if (!parsed.caseId || !parsed.scenarioId) {
        redirectToFallback();
        return;
      }

      router.replace(
        buildAppScenarioUrl({
          locale,
          caseId: parsed.caseId,
          scenarioId: parsed.scenarioId,
        }),
      );
    } catch {
      redirectToFallback();
    }
  }, [locale, router]);

  return null;
}
