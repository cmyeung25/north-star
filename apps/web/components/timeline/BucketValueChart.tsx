"use client";

import { Card, Stack, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import {
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../lib/i18n";

export type BucketValueSeries = {
  bucketId: string;
  bucketName: string;
  series: Array<{ month: string; value: number }>;
};

type BucketValueChartProps = {
  series: BucketValueSeries[];
  currency: string;
};

const colors = [
  "#4c6ef5",
  "#12b886",
  "#fab005",
  "#7950f2",
  "#fa5252",
  "#15aabf",
  "#fd7e14",
];

type ChartPoint = { month: string } & Record<string, number | string>;

const buildChartData = (series: BucketValueSeries[]) => {
  const monthLookup = new Map<string, ChartPoint>();
  series.forEach((bucket) => {
    bucket.series.forEach((point) => {
      if (!monthLookup.has(point.month)) {
        const row: ChartPoint = { month: point.month };
        monthLookup.set(point.month, row);
      }
      const row = monthLookup.get(point.month);
      if (!row) {
        return;
      }
      row[bucket.bucketId] = point.value;
    });
  });
  return Array.from(monthLookup.values()).sort((a, b) =>
    a.month < b.month ? -1 : 1
  );
};

export default function BucketValueChart({ series, currency }: BucketValueChartProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();

  if (series.length === 0) {
    return (
      <Card withBorder padding="md" radius="md">
        <Text size="sm" c="dimmed">
          {t("bucketValueEmpty")}
        </Text>
      </Card>
    );
  }

  const chartData = buildChartData(series);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Text fw={600}>{t("bucketValueTitle")}</Text>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ left: 16, right: 24 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                width={80}
                tickFormatter={(value) =>
                  formatCurrency(Number(value), currency, locale)
                }
              />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value), currency, locale)
                }
              />
              <Legend />
              {series.map((bucket, index) => (
                <Line
                  key={bucket.bucketId}
                  type="monotone"
                  dataKey={bucket.bucketId}
                  name={bucket.bucketName}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Stack>
    </Card>
  );
}
