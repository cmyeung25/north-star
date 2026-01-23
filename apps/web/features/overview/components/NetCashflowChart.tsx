import { Card, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { MilestoneMarker, TimeSeriesPoint } from "../types";

interface NetCashflowChartProps {
  data: TimeSeriesPoint[];
  markers?: MilestoneMarker[];
  title?: string;
  onClick?: () => void;
  headerRight?: ReactNode;
}

export default function NetCashflowChart({
  data,
  markers = [],
  title,
  onClick,
  headerRight,
}: NetCashflowChartProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const markerLookup = markers.reduce<Record<string, MilestoneMarker[]>>(
    (acc, marker) => {
      if (!acc[marker.month]) {
        acc[marker.month] = [];
      }
      acc[marker.month].push(marker);
      return acc;
    },
    {}
  );
  const chartData = data.map((point) => ({
    ...point,
    fill: point.value >= 0 ? "#12b886" : "#fa5252",
  }));

  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined }}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text fw={600}>{title ?? t("netCashflowTitle")}</Text>
          {headerRight ? (
            <div
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {headerRight}
            </div>
          ) : null}
        </Group>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ left: 8, right: 12 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                width={72}
                tickFormatter={(value) => formatCurrency(Number(value), undefined, locale)}
              />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value), undefined, locale)
                }
                labelFormatter={(label) => {
                  const milestoneLabels =
                    markerLookup[label]?.map(
                      (marker) =>
                        `${marker.memberName}${marker.label}${
                          marker.atAgeYears ? `（${marker.atAgeYears}歲）` : ""
                        }`
                    ) ?? [];
                  if (milestoneLabels.length === 0) {
                    return t("monthLabel", { month: label });
                  }
                  return `${t("monthLabel", { month: label })} · ${milestoneLabels.join(
                    ", "
                  )}`;
                }}
              />
              <ReferenceLine y={0} stroke="#ced4da" />
              {markers.map((marker) => (
                <ReferenceLine
                  key={marker.id}
                  x={marker.month}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                />
              ))}
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.month}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Stack>
    </Card>
  );
}
