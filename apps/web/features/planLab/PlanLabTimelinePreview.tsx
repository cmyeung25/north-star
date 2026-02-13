import { Badge, Box, Group, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { useMemo, useState, type MouseEvent } from "react";
import type { ProjectionXDomain } from "./projectionXDomain";
import type { TimelineChartRange, TimelineItem } from "./timelinePreview";

type PlanLabTimelinePreviewProps = {
  items: TimelineItem[];
  range: TimelineChartRange;
  xDomain: ProjectionXDomain;
  plotLeftGutter?: number;
  activeMonthIdx: number | null;
  onActiveMonthChange: (monthIdx: number | null) => void;
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

export default function PlanLabTimelinePreview({
  items,
  range,
  xDomain,
  plotLeftGutter = 80,
  activeMonthIdx,
  onActiveMonthChange,
  onMonthClick,
  height = 250,
}: PlanLabTimelinePreviewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const totalMonths = Math.max(xDomain.months.length, 1);
  const monthSpan = Math.max(totalMonths - 1, 1);
  const monthIndexLookup = useMemo(
    () =>
      xDomain.months.reduce<Record<string, number>>((acc, month, index) => {
        acc[month] = index;
        return acc;
      }, {}),
    [xDomain.months]
  );

  const ticks = useMemo(() => {
    const out: Array<{ index: number; label: string }> = [];
    for (let idx = 0; idx < totalMonths; idx += 12) {
      const month = xDomain.months[idx] ?? range.startYM;
      out.push({ index: idx, label: month.slice(0, 4) });
    }
    if (out.length === 0 || out[out.length - 1]?.index !== totalMonths - 1) {
      out.push({ index: totalMonths - 1, label: (xDomain.months[totalMonths - 1] ?? range.endYM).slice(0, 4) });
    }
    return out;
  }, [range.endYM, range.startYM, totalMonths, xDomain.months]);

  const monthFromPointer = (event: MouseEvent<HTMLDivElement>): number | null => {
    if (xDomain.months.length === 0) {
      return null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const ratio = rect.width > 0 ? relative / rect.width : 0;
    const idx = Math.round(ratio * (xDomain.months.length - 1));
    return Math.min(Math.max(idx, xDomain.startMonthIdx), xDomain.endMonthIdx);
  };

  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        暫無可展示事件
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <ScrollArea h={height} type="auto" offsetScrollbars>
        <Stack gap={6} pr="xs">
          {items.map((item) => {
            const startIndex = monthIndexLookup[item.startYM] ?? xDomain.startMonthIdx;
            const endIndex = monthIndexLookup[item.endYM ?? range.endYM] ?? xDomain.endMonthIdx;
            const left = ((startIndex - xDomain.startMonthIdx) / monthSpan) * 100;
            const width = Math.max(((endIndex - startIndex + 1) / totalMonths) * 100, 0.8);
            const active = activeId === item.id;
            return (
              <Group
                key={item.id}
                gap="xs"
                wrap="nowrap"
                onClick={() => setActiveId((current) => (current === item.id ? null : item.id))}
                style={{ cursor: "pointer" }}
              >
                <Box w={plotLeftGutter} style={{ minWidth: plotLeftGutter }}>
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
                  onMouseMove={(event) => {
                    const monthIdx = monthFromPointer(event);
                    if (monthIdx !== null) {
                      onActiveMonthChange(monthIdx);
                    }
                  }}
                  onMouseLeave={() => onActiveMonthChange(null)}
                  onClick={(event) => {
                    const monthIdx = monthFromPointer(event);
                    if (monthIdx !== null) {
                      onMonthClick(monthIdx);
                    }
                  }}
                  style={{
                    position: "relative",
                    flex: 1,
                    minWidth: 220,
                    height: 22,
                    borderRadius: 6,
                    background: "var(--mantine-color-gray-0)",
                    border: "1px solid var(--mantine-color-gray-2)",
                  }}
                >
                  <Tooltip
                    label={`${item.label} · ${item.startYM}${item.endYM ? ` → ${item.endYM}` : ""} (${item.kind})`}
                    withArrow
                  >
                    <Box
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: `${left}%`,
                        width: item.isPoint ? 8 : `${width}%`,
                        height: item.isPoint ? 8 : 10,
                        transform: "translate(-50%, -50%)",
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
                        left: `${((activeMonthIdx - xDomain.startMonthIdx) / monthSpan) * 100}%`,
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

      <Box
        style={{
          position: "relative",
          marginLeft: plotLeftGutter,
          height: 18,
          borderTop: "1px solid var(--mantine-color-gray-3)",
        }}
      >
        {ticks.map((tick) => {
          const left = (tick.index / monthSpan) * 100;
          return (
            <Box key={`${tick.index}-${tick.label}`} style={{ position: "absolute", left: `${left}%`, top: 0 }}>
              <Box h={6} w={1} bg="gray.5" />
              <Text size="10px" c="dimmed">
                {tick.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
