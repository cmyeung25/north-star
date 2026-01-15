import { Card, Stack, Text } from "@mantine/core";
import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { TimeSeriesPoint } from "../types";

interface CashBalanceChartProps {
  data: TimeSeriesPoint[];
  title?: string;
}

export default function CashBalanceChart({
  data,
  title,
}: CashBalanceChartProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const lowestPoint = data.reduce<TimeSeriesPoint | null>((lowest, point) => {
    if (!lowest || point.value < lowest.value) {
      return point;
    }
    return lowest;
  }, null);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={600}>{title ?? t("cashBalanceTitle")}</Text>
        <div style={{ width: "100%", height: 240 }}>
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
                labelFormatter={(label) => t("monthLabel", { month: label })}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4c6ef5"
                strokeWidth={2}
                dot={false}
              />
              {lowestPoint && (
                <ReferenceDot
                  x={lowestPoint.month}
                  y={lowestPoint.value}
                  r={4}
                  fill="#fa5252"
                  stroke="#fa5252"
                  label={{ value: t("lowestPointLabel"), position: "top" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {lowestPoint && (
          <Text size="xs" c="dimmed">
            {t("lowestPointSummary", {
              value: formatCurrency(lowestPoint.value, undefined, locale),
              month: lowestPoint.month,
            })}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
