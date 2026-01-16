import { nanoid } from "nanoid";
import type { Scenario } from "../../store/scenarioStore";
import type {
  EventDefinition,
  EventRule,
  EventRuleOverrides,
  ScenarioEventRef,
} from "./types";
import { resolveEventRule } from "./utils";

export type DuplicateCandidate = {
  id: string;
  scenarioId: string;
  scenarioName: string;
  scenarioBaseCurrency: string;
  ref: ScenarioEventRef;
  definition: EventDefinition;
  effectiveRule: EventRule;
  fingerprint: string;
  titleKey: string;
};

export type DuplicateCluster = {
  id: string;
  candidates: DuplicateCandidate[];
};

type ScheduleStats = {
  total: number;
  average: number;
  count: number;
  leading: number[];
};

const titleStopWords = new Set([
  "event",
  "plan",
  "monthly",
  "month",
  "annual",
  "year",
  "expense",
  "income",
  "payment",
  "fee",
  "cost",
]);

const normalizeTitle = (title: string) => {
  const cleaned = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !titleStopWords.has(word))
    .join("");
  return cleaned.trim();
};

const levenshtein = (a: string, b: string) => {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

const isTitleSimilar = (a: string, b: string) => {
  const normalizedA = normalizeTitle(a);
  const normalizedB = normalizeTitle(b);
  if (!normalizedA || !normalizedB) {
    return false;
  }
  if (normalizedA === normalizedB) {
    return true;
  }
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return true;
  }
  const distance = levenshtein(normalizedA, normalizedB);
  return distance <= 3 || distance <= Math.max(normalizedA.length, normalizedB.length) * 0.2;
};

const parseMonthIndex = (month?: string | null) => {
  if (!month) {
    return null;
  }
  const [year, rawMonth] = month.split("-");
  const yearNumber = Number(year);
  const monthNumber = Number(rawMonth);
  if (!Number.isFinite(yearNumber) || !Number.isFinite(monthNumber)) {
    return null;
  }
  return yearNumber * 12 + (monthNumber - 1);
};

const isMonthClose = (a?: string | null, b?: string | null, tolerance = 1) => {
  if (!a && !b) {
    return true;
  }
  const indexA = parseMonthIndex(a);
  const indexB = parseMonthIndex(b);
  if (indexA === null || indexB === null) {
    return false;
  }
  return Math.abs(indexA - indexB) <= tolerance;
};

const isNumberClose = (a?: number, b?: number, absTolerance = 100, pctTolerance = 0.1) => {
  const valueA = Number(a ?? 0);
  const valueB = Number(b ?? 0);
  const diff = Math.abs(valueA - valueB);
  const scale = Math.max(Math.abs(valueA), Math.abs(valueB));
  return diff <= Math.max(absTolerance, scale * pctTolerance);
};

const buildScheduleStats = (schedule?: EventRule["schedule"]): ScheduleStats => {
  const entries = schedule ?? [];
  const amounts = entries.map((entry) => Math.abs(entry.amount ?? 0));
  const total = amounts.reduce((sum, value) => sum + value, 0);
  const count = amounts.length;
  const average = count > 0 ? total / count : 0;
  const leading = [...entries]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(0, 4)
    .map((entry) => Math.abs(entry.amount ?? 0));
  return { total, average, count, leading };
};

const isScheduleSimilar = (a?: EventRule["schedule"], b?: EventRule["schedule"]) => {
  const statsA = buildScheduleStats(a);
  const statsB = buildScheduleStats(b);
  if (statsA.count === 0 && statsB.count === 0) {
    return true;
  }
  if (Math.abs(statsA.count - statsB.count) > 2) {
    return false;
  }
  if (!isNumberClose(statsA.total, statsB.total, 200, 0.15)) {
    return false;
  }
  if (!isNumberClose(statsA.average, statsB.average, 100, 0.15)) {
    return false;
  }
  if (statsA.leading.length !== statsB.leading.length) {
    return false;
  }
  return statsA.leading.every((value, index) =>
    isNumberClose(value, statsB.leading[index], 200, 0.2)
  );
};

export const buildFingerprint = (definition: EventDefinition, rule: EventRule) => {
  const scheduleStats = buildScheduleStats(rule.schedule);
  const paramsSignature = [
    Number(rule.monthlyAmount ?? 0).toFixed(0),
    Number(rule.oneTimeAmount ?? 0).toFixed(0),
    Number(rule.annualGrowthPct ?? 0).toFixed(2),
    parseMonthIndex(rule.startMonth ?? definition.rule.startMonth ?? "") ?? "na",
    parseMonthIndex(rule.endMonth ?? definition.rule.endMonth ?? "") ?? "na",
  ].join(":");
  const scheduleSignature = [
    scheduleStats.count,
    Math.round(scheduleStats.total),
    Math.round(scheduleStats.average),
  ].join(":");
  return [
    definition.type,
    rule.mode,
    normalizeTitle(definition.title),
    rule.mode === "schedule" ? scheduleSignature : paramsSignature,
  ].join("|");
};

const isRuleSimilar = (a: EventRule, b: EventRule) => {
  if (a.mode !== b.mode) {
    return false;
  }
  if (a.mode === "schedule") {
    return isScheduleSimilar(a.schedule, b.schedule);
  }
  return (
    isMonthClose(a.startMonth, b.startMonth) &&
    isMonthClose(a.endMonth ?? null, b.endMonth ?? null) &&
    isNumberClose(a.monthlyAmount, b.monthlyAmount) &&
    isNumberClose(a.oneTimeAmount, b.oneTimeAmount) &&
    isNumberClose(a.annualGrowthPct, b.annualGrowthPct, 1, 0.1)
  );
};

const areSchedulesEqual = (
  base?: EventRule["schedule"],
  target?: EventRule["schedule"]
) => {
  const normalizeSchedule = (schedule?: EventRule["schedule"]) =>
    (schedule ?? [])
      .map((entry) => ({
        month: entry.month,
        amount: Math.abs(entry.amount ?? 0),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  const baseEntries = normalizeSchedule(base);
  const targetEntries = normalizeSchedule(target);
  if (baseEntries.length !== targetEntries.length) {
    return false;
  }
  return baseEntries.every(
    (entry, index) =>
      entry.month === targetEntries[index]?.month &&
      isNumberClose(entry.amount, targetEntries[index]?.amount, 1, 0.01)
  );
};

export const buildEventRuleOverrides = (
  baseRule: EventRule,
  targetRule: EventRule
): EventRuleOverrides | undefined => {
  const overrides: EventRuleOverrides = {};
  if (!isMonthClose(baseRule.startMonth, targetRule.startMonth, 0)) {
    overrides.startMonth = targetRule.startMonth;
  }
  if (!isMonthClose(baseRule.endMonth ?? null, targetRule.endMonth ?? null, 0)) {
    overrides.endMonth = targetRule.endMonth ?? null;
  }
  if (!isNumberClose(baseRule.monthlyAmount, targetRule.monthlyAmount, 1, 0.01)) {
    overrides.monthlyAmount = targetRule.monthlyAmount;
  }
  if (!isNumberClose(baseRule.oneTimeAmount, targetRule.oneTimeAmount, 1, 0.01)) {
    overrides.oneTimeAmount = targetRule.oneTimeAmount;
  }
  if (
    !isNumberClose(baseRule.annualGrowthPct, targetRule.annualGrowthPct, 0.1, 0.01)
  ) {
    overrides.annualGrowthPct = targetRule.annualGrowthPct;
  }
  if (baseRule.mode !== targetRule.mode) {
    overrides.mode = targetRule.mode;
  }
  if (targetRule.mode === "schedule") {
    if (!areSchedulesEqual(baseRule.schedule, targetRule.schedule)) {
      overrides.schedule = targetRule.schedule ?? [];
    }
  } else if (baseRule.mode === "schedule" && targetRule.mode === "params") {
    overrides.schedule = undefined;
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

export const listEventRuleDifferences = (baseRule: EventRule, targetRule: EventRule) => {
  const diffs: Array<keyof EventRuleOverrides> = [];
  if (!isMonthClose(baseRule.startMonth, targetRule.startMonth, 0)) {
    diffs.push("startMonth");
  }
  if (!isMonthClose(baseRule.endMonth ?? null, targetRule.endMonth ?? null, 0)) {
    diffs.push("endMonth");
  }
  if (!isNumberClose(baseRule.monthlyAmount, targetRule.monthlyAmount, 1, 0.01)) {
    diffs.push("monthlyAmount");
  }
  if (!isNumberClose(baseRule.oneTimeAmount, targetRule.oneTimeAmount, 1, 0.01)) {
    diffs.push("oneTimeAmount");
  }
  if (
    !isNumberClose(baseRule.annualGrowthPct, targetRule.annualGrowthPct, 0.1, 0.01)
  ) {
    diffs.push("annualGrowthPct");
  }
  if (baseRule.mode !== targetRule.mode) {
    diffs.push("mode");
  }
  if (targetRule.mode === "schedule") {
    if (!areSchedulesEqual(baseRule.schedule, targetRule.schedule)) {
      diffs.push("schedule");
    }
  }
  return diffs;
};

const isCandidateSimilar = (a: DuplicateCandidate, b: DuplicateCandidate) => {
  if (a.definition.type !== b.definition.type) {
    return false;
  }
  if (!isTitleSimilar(a.definition.title, b.definition.title)) {
    return false;
  }
  return isRuleSimilar(a.effectiveRule, b.effectiveRule);
};

export const findDuplicateClusters = (
  scenarios: Scenario[],
  eventLibrary: EventDefinition[],
  scenarioIds: string[]
): DuplicateCluster[] => {
  const scenarioIdSet = new Set(scenarioIds);
  const libraryMap = new Map(eventLibrary.map((definition) => [definition.id, definition]));
  const candidates: DuplicateCandidate[] = [];

  scenarios.forEach((scenario) => {
    if (!scenarioIdSet.has(scenario.id)) {
      return;
    }
    (scenario.eventRefs ?? []).forEach((ref) => {
      const definition = libraryMap.get(ref.refId);
      if (!definition || definition.kind !== "cashflow") {
        return;
      }
      const effectiveRule = resolveEventRule(definition, ref);
      const fingerprint = buildFingerprint(definition, effectiveRule);
      candidates.push({
        id: `candidate-${nanoid(6)}`,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        scenarioBaseCurrency: scenario.baseCurrency,
        ref,
        definition,
        effectiveRule,
        fingerprint,
        titleKey: normalizeTitle(definition.title),
      });
    });
  });

  const clusters: DuplicateCluster[] = [];
  const clustersByKey = new Map<string, DuplicateCluster[]>();

  candidates.forEach((candidate) => {
    const key = `${candidate.definition.type}:${candidate.effectiveRule.mode}`;
    const bucket = clustersByKey.get(key) ?? [];
    const match = bucket.find((cluster) => isCandidateSimilar(cluster.candidates[0], candidate));
    if (match) {
      match.candidates.push(candidate);
      return;
    }
    const cluster: DuplicateCluster = {
      id: `cluster-${nanoid(6)}`,
      candidates: [candidate],
    };
    clusters.push(cluster);
    bucket.push(cluster);
    clustersByKey.set(key, bucket);
  });

  return clusters.filter((cluster) => {
    const uniqueDefs = new Set(cluster.candidates.map((candidate) => candidate.ref.refId));
    return uniqueDefs.size >= 2;
  });
};
