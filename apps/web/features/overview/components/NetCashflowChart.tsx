import { Card, Stack, Text } from "@mantine/core";
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
import type { TimeSeriesPoint } from "../types";

interface NetCashflowChartProps {
  data: TimeSeriesPoint[];
  title?: string;
  onClick?: () => void;
}

export default function NetCashflowChart({
  data,
  title,
  onClick,
}: NetCashflowChartProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
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
        <Text fw={600}>{title ?? t("netCashflowTitle")}</Text>
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
                labelFormatter={(label) => t("monthLabel", { month: label })}
              />
              <ReferenceLine y={0} stroke="#ced4da" />
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
