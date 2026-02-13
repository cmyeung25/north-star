import { Badge, Box, Group, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { monthIndex } from "@north-star/engine";
import { useMemo, useState } from "react";
import type { TimelineChartRange, TimelineItem } from "./timelinePreview";

type PlanLabTimelinePreviewProps = {
  items: TimelineItem[];
  range: TimelineChartRange;
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

const monthsBetweenInclusive = (startYM: string, endYM: string): number =>
  monthIndex(startYM, endYM) + 1;

const ymToIndex = (ym: string, startYM: string): number =>
  Math.max(0, monthIndex(startYM, ym));

export default function PlanLabTimelinePreview({
  items,
  range,
  height = 250,
}: PlanLabTimelinePreviewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const totalMonths = Math.max(monthsBetweenInclusive(range.startYM, range.endYM), 1);

  const ticks = useMemo(() => {
    const out: Array<{ index: number; label: string }> = [];
    for (let idx = 0; idx < totalMonths; idx += 12) {
      const [year] = range.startYM.split("-");
      const labelYear = Number(year) + Math.floor(idx / 12);
      out.push({ index: idx, label: String(labelYear) });
    }
    if (out.length === 0 || out[out.length - 1]?.index !== totalMonths - 1) {
      out.push({ index: totalMonths - 1, label: range.endYM.slice(0, 4) });
    }
    return out;
  }, [range.endYM, range.startYM, totalMonths]);

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
            const startIndex = ymToIndex(item.startYM, range.startYM);
            const endIndex = ymToIndex(item.endYM ?? range.endYM, range.startYM);
            const left = (startIndex / totalMonths) * 100;
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
                <Box w={190} style={{ minWidth: 160 }}>
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
                </Box>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea>

      <Box
        style={{
          position: "relative",
          height: 18,
          borderTop: "1px solid var(--mantine-color-gray-3)",
        }}
      >
        {ticks.map((tick) => {
          const left = (tick.index / totalMonths) * 100;
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
