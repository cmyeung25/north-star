import { Badge, Box, Group, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { useState } from "react";
import type { MonthScale } from "../../lib/chart/monthScale";
import type { TimelineItem } from "./timelinePreview";

type PlanLabTimelinePreviewProps = {
  items: TimelineItem[];
  monthScale: MonthScale;
  isMobile: boolean;
  activeMonthIdx: number | null;
  onMonthClick: (monthIdx: number) => void;
  height?: number;
};

const KIND_COLORS: Record<TimelineItem["kind"], string> = {
  income: "teal",
  expense: "red",
  asset: "blue",
  liability: "orange",
  bundle: "grape",
  other: "gray",
};

const LABEL_COL_WIDTH = 220;
const ROW_HEIGHT = 24;

export default function PlanLabTimelinePreview({
  items,
  monthScale,
  isMobile,
  activeMonthIdx,
  onMonthClick,
  height = 250,
}: PlanLabTimelinePreviewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const tickEvery = isMobile ? 24 : 12;

  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        暫無可展示事件
      </Text>
    );
  }

  const axisTicks = monthScale.months
    .map((month, index) => ({ month, index }))
    .filter(({ index }) => index % tickEvery === 0);
  const lastMonth = monthScale.months[monthScale.monthCount - 1];
  if (lastMonth && axisTicks[axisTicks.length - 1]?.month !== lastMonth) {
    axisTicks.push({ month: lastMonth, index: monthScale.monthCount - 1 });
  }

  return (
    <Stack gap="xs">
      <ScrollArea h={height} type="auto" offsetScrollbars>
        <Stack gap={8} pr="xs">
          {items.map((item) => {
            const startIdx = monthScale.monthToIndex.get(item.startYM) ?? 0;
            const endIdx = monthScale.monthToIndex.get(item.endYM ?? monthScale.months[monthScale.monthCount - 1] ?? item.startYM) ?? monthScale.monthCount - 1;
            const barLeft = monthScale.xOfMonth(monthScale.months[startIdx] ?? item.startYM);
            const barWidth = Math.max((Math.max(endIdx - startIdx, 0) + 1) * monthScale.pxPerMonth, 8);
            const active = activeId === item.id;

            return (
              <Group
                key={item.id}
                gap="xs"
                wrap="nowrap"
                onClick={() => setActiveId((current) => (current === item.id ? null : item.id))}
                style={{ cursor: "pointer" }}
              >
                <Box w={LABEL_COL_WIDTH} style={{ minWidth: LABEL_COL_WIDTH }}>
                  <Group gap={6} wrap="nowrap">
                    <Badge variant="light" color={KIND_COLORS[item.kind]} size="xs">
                      {item.kind}
                    </Badge>
                    <Text size="xs" truncate>
                      {item.label}
                    </Text>
                  </Group>
                </Box>
                <Box
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = Math.max(0, event.clientX - rect.left - monthScale.leftGutterPx);
                    const monthIdx = Math.min(
                      Math.max(Math.round(x / monthScale.pxPerMonth), 0),
                      Math.max(monthScale.monthCount - 1, 0)
                    );
                    onMonthClick(monthIdx);
                  }}
                  style={{
                    position: "relative",
                    minWidth: monthScale.totalWidth,
                    width: monthScale.totalWidth,
                    height: ROW_HEIGHT,
                    borderRadius: 6,
                    background: "var(--mantine-color-gray-0)",
                    border: "1px solid var(--mantine-color-gray-2)",
                  }}
                >
                  <Tooltip label={`${item.label} · ${item.startYM}${item.endYM ? ` → ${item.endYM}` : ""} (${item.kind})`} withArrow>
                    <Box
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: barLeft,
                        width: item.isPoint ? 8 : barWidth,
                        height: item.isPoint ? 8 : 10,
                        transform: "translateY(-50%)",
                        borderRadius: item.isPoint ? 999 : 4,
                        background: "var(--mantine-color-blue-6)",
                        outline: active ? "2px solid var(--mantine-color-blue-9)" : undefined,
                      }}
                    />
                  </Tooltip>
                  {activeMonthIdx !== null && (
                    <Box
                      style={{
                        position: "absolute",
                        left: monthScale.leftGutterPx + activeMonthIdx * monthScale.pxPerMonth,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "var(--mantine-color-blue-7)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </Box>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea>

      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Box w={LABEL_COL_WIDTH} style={{ minWidth: LABEL_COL_WIDTH }} />
        <Box
          style={{
            position: "relative",
            minWidth: monthScale.totalWidth,
            width: monthScale.totalWidth,
            height: 24,
            borderTop: "1px solid var(--mantine-color-gray-3)",
          }}
        >
          {axisTicks.map((tick) => (
            <Box key={tick.month} style={{ position: "absolute", left: monthScale.xOfMonth(tick.month), top: 0 }}>
              <Box h={6} w={1} bg="gray.5" />
              <Text size="10px" c="dimmed">
                {tick.month.slice(0, 4)}
              </Text>
            </Box>
          ))}
        </Box>
      </Group>
    </Stack>
  );
}
