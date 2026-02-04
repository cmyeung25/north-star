import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan } from "../../src/domain/planLab/types";
import type { EventDefinition } from "../../src/domain/events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import {
  getProjectionForPlanSnapshot,
  type PlanProjectionResult,
} from "./planLabPlans";

type PlanCompareEntry = {
  status: "idle" | "loading" | "ready" | "error";
  result: PlanProjectionResult | null;
};

type UsePlanCompareProjectionsParams = {
  scenario: Scenario | null;
  planA: Plan | null;
  planB: Plan | null;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  debounceMs?: number;
};

const buildCacheKey = (
  scenarioId: string | null,
  scenarioVersion: number | undefined,
  planId: string | null
) =>
  `${scenarioId ?? "none"}:${scenarioVersion ?? 0}:${planId ?? "none"}`;

export const usePlanCompareProjections = ({
  scenario,
  planA,
  planB,
  eventLibrary,
  members,
  budgetRules,
  debounceMs = 250,
}: UsePlanCompareProjectionsParams) => {
  const cacheRef = useRef<Map<string, PlanProjectionResult>>(new Map());
  const [planAState, setPlanAState] = useState<PlanCompareEntry>({
    status: "idle",
    result: null,
  });
  const [planBState, setPlanBState] = useState<PlanCompareEntry>({
    status: "idle",
    result: null,
  });
  const updatePlanAState = (next: PlanCompareEntry) => {
    setPlanAState((current) =>
      current.status === next.status && current.result === next.result ? current : next
    );
  };
  const updatePlanBState = (next: PlanCompareEntry) => {
    setPlanBState((current) =>
      current.status === next.status && current.result === next.result ? current : next
    );
  };

  const scenarioId = scenario?.id ?? null;
  const scenarioVersion = scenario?.version;

  const planAKey = useMemo(
    () => buildCacheKey(scenarioId, scenarioVersion, planA?.id ?? null),
    [scenarioId, scenarioVersion, planA?.id]
  );
  const planBKey = useMemo(
    () => buildCacheKey(scenarioId, scenarioVersion, planB?.id ?? null),
    [scenarioId, scenarioVersion, planB?.id]
  );

  useEffect(() => {
    if (!scenario || !planA) {
      updatePlanAState({ status: "idle", result: null });
      return;
    }
    const cached = cacheRef.current.get(planAKey);
    if (cached) {
      updatePlanAState({
        status: cached.errors.length > 0 ? "error" : "ready",
        result: cached,
      });
      return;
    }
    updatePlanAState({ status: "loading", result: null });
    const handle = setTimeout(() => {
      const result = getProjectionForPlanSnapshot(
        planA,
        scenario,
        eventLibrary,
        members,
        budgetRules
      );
      cacheRef.current.set(planAKey, result);
      updatePlanAState({
        status: result.errors.length > 0 ? "error" : "ready",
        result,
      });
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [
    budgetRules,
    debounceMs,
    eventLibrary,
    members,
    planA,
    planAKey,
    scenario,
  ]);

  useEffect(() => {
    if (!scenario || !planB) {
      updatePlanBState({ status: "idle", result: null });
      return;
    }
    const cached = cacheRef.current.get(planBKey);
    if (cached) {
      updatePlanBState({
        status: cached.errors.length > 0 ? "error" : "ready",
        result: cached,
      });
      return;
    }
    updatePlanBState({ status: "loading", result: null });
    const handle = setTimeout(() => {
      const result = getProjectionForPlanSnapshot(
        planB,
        scenario,
        eventLibrary,
        members,
        budgetRules
      );
      cacheRef.current.set(planBKey, result);
      updatePlanBState({
        status: result.errors.length > 0 ? "error" : "ready",
        result,
      });
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [
    budgetRules,
    debounceMs,
    eventLibrary,
    members,
    planB,
    planBKey,
    scenario,
  ]);

  return {
    planA: planAState,
    planB: planBState,
  };
};
