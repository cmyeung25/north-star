import { Card, Stack, Text } from "@mantine/core";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { MilestoneMarker, TimeSeriesPoint } from "../types";

interface NetWorthChartProps {
  data: TimeSeriesPoint[];
  markers?: MilestoneMarker[];
  title?: string;
  onClick?: () => void;
}

export default function NetWorthChart({
  data,
  markers = [],
  title,
  onClick,
}: NetWorthChartProps) {
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
        <Text fw={600}>{title ?? t("netWorthTitle")}</Text>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 8, right: 12 }}>
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
              <Line
                type="monotone"
                dataKey="value"
                stroke="#12b886"
                strokeWidth={2}
                dot={false}
              />
              {markers.map((marker) => (
                <ReferenceLine
                  key={marker.id}
                  x={marker.month}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Stack>
    </Card>
  );
}
