import type { ScenarioEvent } from "../scenarioV2/events";
import type { PlanLabEventsPatch, PlanLabSnapshotPayload } from "./types";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

const formatDelta = (amount: number) => {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded)}`;
};

const resolveEventAmount = (event: ScenarioEvent) => {
  if (event.type === "cashflow") {
    return { amount: event.amount, cadence: event.cadence };
  }
  if (event.type === "housing") {
    if (event.kind === "rent") {
      return { amount: event.rentMonthly ?? 0, cadence: "monthly" };
    }
    return { amount: event.mortgagePayment ?? 0, cadence: "monthly" };
  }
  if (event.type === "loan") {
    return { amount: event.monthlyPayment ?? 0, cadence: "monthly" };
  }
  if (event.type === "insurance") {
    const total = (event.policies ?? []).reduce(
      (sum, policy) => sum + (policy.premiumMonthly ?? 0),
      0
    );
    return { amount: total, cadence: "monthly" };
  }
  return { amount: event.amount, cadence: "oneOff" };
};

const describeEvent = (event: ScenarioEvent) => {
  const label = event.label ?? event.id;
  const { amount, cadence } = resolveEventAmount(event);
  const delta = formatDelta(
    event.type === "cashflow" && event.kind === "expense" ? -amount : amount
  );
  if (cadence === "oneOff") {
    const month =
      event.type === "adjustment"
        ? event.month
        : event.type === "cashflow"
          ? event.occurrenceMonth
          : undefined;
    return `${label} (${delta} one-off${month ? ` in ${month}` : ""})`;
  }
  if (cadence === "quarterly") {
    return `${label} (${delta} quarterly)`;
  }
  if (cadence === "yearly") {
    return `${label} (${delta} yearly)`;
  }
  if (cadence === "everyNMonths") {
    return `${label} (${delta} every ${event.type === "cashflow" ? event.everyNMonths ?? 1 : 1} months)`;
  }
  return `${label} (${delta}/mo)`;
};

const summarizePatch = (patch: PlanLabEventsPatch) => {
  const add = patch.add.map((event) => ({
    id: event.id,
    kind: "add" as const,
    text: describeEvent(event),
  }));
  const update = patch.update.map((entry) => ({
    id: entry.id,
    kind: "update" as const,
    text: entry.patch.label ? entry.patch.label : entry.id,
  }));
  const remove = patch.remove.map((id) => ({
    id,
    kind: "remove" as const,
    text: id,
  }));
  return [...add, ...update, ...remove];
};

export const diffSummaryFromPatches = (
  a: PlanLabSnapshotPayload,
  b: PlanLabSnapshotPayload,
  translate?: TranslateFn
): string[] => {
  const t =
    translate ??
    ((_, fallback, values) => {
      if (!values) {
        return fallback;
      }
      return Object.entries(values).reduce(
        (result, [key, value]) =>
          result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
        fallback
      );
    });
  const aSummary = summarizePatch(a.eventsPatch);
  const bSummary = summarizePatch(b.eventsPatch);

  const aIds = new Set(aSummary.map((entry) => `${entry.kind}:${entry.id}`));
  const bIds = new Set(bSummary.map((entry) => `${entry.kind}:${entry.id}`));

  const onlyA = aSummary.filter((entry) => !bIds.has(`${entry.kind}:${entry.id}`));
  const onlyB = bSummary.filter((entry) => !aIds.has(`${entry.kind}:${entry.id}`));

  const lines: string[] = [];
  onlyA.slice(0, 3).forEach((entry) => {
    lines.push(
      t("planLabDiffOnlyA", "Only A: {text}", {
        text: entry.text,
      })
    );
  });
  onlyB.slice(0, 3).forEach((entry) => {
    lines.push(
      t("planLabDiffOnlyB", "Only B: {text}", {
        text: entry.text,
      })
    );
  });

  if (lines.length === 0) {
    lines.push(t("planLabDiffSummaryFallback", "No event differences detected."));
  }

  return lines.slice(0, 6);
};
