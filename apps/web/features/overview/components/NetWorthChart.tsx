import { Card, Stack, Text } from "@mantine/core";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { TimeSeriesPoint } from "../types";

interface NetWorthChartProps {
  data: TimeSeriesPoint[];
  title?: string;
}

export default function NetWorthChart({
  data,
  title,
}: NetWorthChartProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  return (
    <Card withBorder radius="md" padding="md">
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
                labelFormatter={(label) => t("monthLabel", { month: label })}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#12b886"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Stack>
    </Card>
  );
}
