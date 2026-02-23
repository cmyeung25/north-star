"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { type Locale } from "../i18n/routing";
import { useRouter } from "next/navigation";
import { useScenarioContext } from "./useScenarioContext";
import type { CashflowItem } from "../domain/ledger/types";
import { scenarioDashboardPath, scenarioMoneyPath, scenarioPeoplePath } from "../../lib/routes/appRoutes";
import { useScenarioStore } from "../store/scenarioStore";

export type JumpToast = {
  message: string;
  color?: string;
};

const buildRoute = (
  locale: string,
  path: "/money" | "/people" | "/overview",
  caseId: string | null,
  scenarioId: string | null,
  params: Record<string, string | undefined>
) => {
  const base =
    scenarioId && caseId
      ? path === "/money"
        ? scenarioMoneyPath(caseId, scenarioId, locale as Locale)
        : path === "/people"
          ? scenarioPeoplePath(caseId, scenarioId, locale as Locale)
          : scenarioDashboardPath(caseId, scenarioId, locale as Locale)
      : path;
  const [pathname, queryString] = base.split("?");
  const query = new URLSearchParams(queryString ?? "");
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  const suffix = query.toString();
  return `${pathname}${suffix ? `?${suffix}` : ""}`;
};

export const useJumpToSource = () => {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const [toast, setToast] = useState<JumpToast | null>(null);
  const scenarioContext = useScenarioContext();
  const caseId = scenarioContext?.caseId ?? null;

  const jumpToSource = useCallback(
    (item: CashflowItem | null) => {
      if (!item) {
        setToast({ message: t("jumpToSourceMissing"), color: "yellow" });
        return;
      }

      const scenario = scenarios.find((entry) => entry.id === activeScenarioId) ?? null;
      const scenarioId = scenario?.id ?? null;

      if (item.source === "event") {
        if (!item.sourceId) {
          setToast({ message: t("jumpToSourceMissing"), color: "yellow" });
          return;
        }
        router.push(
          buildRoute(locale, "/money", caseId, scenarioId, {
            tab: "timeline",
            editEventId: item.sourceId,
          })
        );
        return;
      }

      if (item.source === "budget") {
        if (!item.sourceId) {
          setToast({ message: t("jumpToSourceMissing"), color: "yellow" });
          return;
        }
        router.push(
          buildRoute(locale, "/people", caseId, scenarioId, {
            tab: "budget",
            ruleId: item.sourceId,
          })
        );
        return;
      }

      if (item.source === "position" || item.source === "home") {
        const homes = scenario?.positions?.homes ?? [];
        if (homes.length === 1) {
          router.push(
            buildRoute(locale, "/money", caseId, scenarioId, {
              tab: "assets",
              editHomeId: homes[0]?.id,
            })
          );
          return;
        }
        setToast({ message: t("jumpToSourceHomeUnavailable"), color: "yellow" });
        return;
      }

      setToast({ message: t("jumpToSourceUnavailable"), color: "yellow" });
    },
    [activeScenarioId, caseId, locale, router, scenarios, t]
  );

  const clearToast = useCallback(() => setToast(null), []);

  return { jumpToSource, toast, clearToast };
};
