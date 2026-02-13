import { parseMonthStrict } from "../../src/utils/month";

export type TimelineItemKind =
  | "income"
  | "expense"
  | "asset"
  | "liability"
  | "bundle"
  | "other";

export type TimelinePreviewSourceItem = {
  id: string;
  label: string;
  kind: "event" | "rule" | "position";
  category?: string;
  startMonth?: string;
  endMonth?: string | null;
  enabled: boolean;
  frequency?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths" | "schedule";
};

export type TimelineItem = {
  id: string;
  label: string;
  kind: TimelineItemKind;
  startYM: string;
  endYM?: string;
  isPoint?: boolean;
  meta?: { source?: "baseline" | "experiment"; refId?: string };
};

export type TimelineChartRange = {
  startYM: string;
  endYM: string;
};

const inferKind = (item: TimelinePreviewSourceItem): TimelineItemKind => {
  const text = `${item.category ?? ""} ${item.label}`.toLowerCase();
  if (text.includes("income") || text.includes("薪") || text.includes("人工") || text.includes("收入")) {
    return "income";
  }
  if (text.includes("expense") || text.includes("支出") || text.includes("cost") || text.includes("開支")) {
    return "expense";
  }
  if (
    text.includes("mortgage") ||
    text.includes("loan") ||
    text.includes("供款") ||
    text.includes("債")
  ) {
    return "liability";
  }
  if (
    text.includes("home") ||
    text.includes("asset") ||
    text.includes("租") ||
    text.includes("樓")
  ) {
    return "asset";
  }
  return item.kind === "position" ? "asset" : "other";
};

const normalizeMonthInRange = (month: string, range: TimelineChartRange): string | null => {
  const parsed = parseMonthStrict(month);
  if (!parsed.ok) {
    return null;
  }
  if (parsed.month < range.startYM) {
    return range.startYM;
  }
  if (parsed.month > range.endYM) {
    return range.endYM;
  }
  return parsed.month;
};

export const buildTimelineItemsForPreview = (
  items: TimelinePreviewSourceItem[],
  range: TimelineChartRange
): TimelineItem[] => {
  return items
    .filter((item) => item.enabled)
    .flatMap((item) => {
      const normalizedStart = item.startMonth
        ? normalizeMonthInRange(item.startMonth, range)
        : null;
      if (!normalizedStart) {
        return [];
      }
      const normalizedEndRaw = item.endMonth
        ? normalizeMonthInRange(item.endMonth, range)
        : undefined;
      const normalizedEnd = normalizedEndRaw ?? undefined;
      const isPoint =
        item.frequency === "oneOff" ||
        (Boolean(normalizedEnd) && normalizedStart === normalizedEnd);
      return [
        {
          id: item.id,
          label: item.label,
          kind: inferKind(item),
          startYM: normalizedStart,
          endYM: isPoint ? undefined : normalizedEnd,
          isPoint,
          meta: { source: "experiment" },
        } satisfies TimelineItem,
      ];
    })
    .sort((a, b) => a.startYM.localeCompare(b.startYM));
};
