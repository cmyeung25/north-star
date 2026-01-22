"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { CashflowItem } from "../domain/ledger/types";
import { buildScenarioUrl } from "../utils/scenarioContext";
import { useScenarioStore } from "../store/scenarioStore";

export type JumpToast = {
  message: string;
  color?: string;
};

const buildRoute = (
  locale: string,
  path: "/money" | "/people" | "/overview",
  scenarioId: string | null,
  params: Record<string, string | undefined>
) => {
  const base = scenarioId ? buildScenarioUrl(path, scenarioId) : path;
  const [pathname, queryString] = base.split("?");
  const query = new URLSearchParams(queryString ?? "");
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  const suffix = query.toString();
  return `/${locale}${pathname}${suffix ? `?${suffix}` : ""}`;
};

export const useJumpToSource = () => {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const [toast, setToast] = useState<JumpToast | null>(null);

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
          buildRoute(locale, "/money", scenarioId, {
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
          buildRoute(locale, "/people", scenarioId, {
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
            buildRoute(locale, "/money", scenarioId, {
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
    [activeScenarioId, locale, router, scenarios, t]
  );

  const clearToast = useCallback(() => setToast(null), []);

  return { jumpToSource, toast, clearToast };
};
