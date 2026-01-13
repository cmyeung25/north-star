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
import { formatCurrency } from "../../../lib/i18n";
import type { TimeSeriesPoint } from "../types";

interface CashBalanceChartProps {
  data: TimeSeriesPoint[];
  title?: string;
}

export default function CashBalanceChart({
  data,
  title = "Cash Balance",
}: CashBalanceChartProps) {
  const lowestPoint = data.reduce<TimeSeriesPoint | null>((lowest, point) => {
    if (!lowest || point.value < lowest.value) {
      return point;
    }
    return lowest;
  }, null);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={600}>{title}</Text>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 8, right: 12 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                width={72}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelFormatter={(label) => `Month ${label}`}
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
                  label={{ value: "Lowest point", position: "top" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {lowestPoint && (
          <Text size="xs" c="dimmed">
            Lowest: {formatCurrency(lowestPoint.value)} in {lowestPoint.month}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
