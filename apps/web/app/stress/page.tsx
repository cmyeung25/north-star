"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import BeforeAfterKpiGrid from "../../features/stress/components/BeforeAfterKpiGrid";
import SaveScenarioModal from "../../features/stress/components/SaveScenarioModal";
import StickyActionBar from "../../features/stress/components/StickyActionBar";
import StressCashChart from "../../features/stress/components/StressCashChart";
import StressControlCard from "../../features/stress/components/StressControlCard";
import StressInsightsCard from "../../features/stress/components/StressInsightsCard";
import {
  baselineKpis,
  baselineSeries,
  mockScenarios,
} from "../../features/stress/mockData";
import type {
  Kpis,
  StressConfig,
  StressType,
  TimeSeriesPoint,
} from "../../features/stress/types";
import { formatCurrency } from "../../lib/i18n";

const segmentOptions = {
  job_loss: [
    { label: "3 months", value: "3" },
    { label: "6 months", value: "6" },
    { label: "12 months", value: "12" },
  ],
  rate_hike: [
    { label: "+0.5%", value: "0.5" },
    { label: "+1%", value: "1" },
    { label: "+2%", value: "2" },
  ],
};

const medicalAmounts = [50000, 100000, 200000];

const stressCardCopy = {
  job_loss: {
    title: "Job loss",
    description: "Reduced income for a set duration.",
  },
  rate_hike: {
    title: "Interest rate hike",
    description: "Higher repayments on variable debt.",
  },
  medical: {
    title: "Medical expense",
    description: "One-time healthcare spending shock.",
  },
};

const clamp = (value: number, min: number) => Math.max(value, min);

const calculateRiskLevel = (kpis: Kpis): Kpis["riskLevel"] => {
  if (kpis.runwayMonths <= 8 || kpis.lowestMonthlyBalance < 0) {
    return "High";
  }
  if (kpis.runwayMonths <= 14 || kpis.lowestMonthlyBalance < 8000) {
    return "Medium";
  }
  return "Low";
};

const applyStressToKpis = (
  baseline: Kpis,
  stresses: StressConfig[]
): Kpis => {
  let next = { ...baseline };

  stresses.forEach((stress) => {
    if (stress.type === "job_loss") {
      const months = Number(stress.params.months ?? 0);
      next.lowestMonthlyBalance -= months * 2500;
      next.runwayMonths -= Math.round(months / 3) * 2;
      next.netWorthYear5 -= months * 15000;
    }

    if (stress.type === "rate_hike") {
      const rate = Number(stress.params.rate ?? 0);
      next.lowestMonthlyBalance -= rate * 12000;
      next.netWorthYear5 -= rate * 40000;
    }

    if (stress.type === "medical") {
      const amount = Number(stress.params.amount ?? 0);
      next.lowestMonthlyBalance -= amount * 0.2;
      next.runwayMonths -= Math.round(amount / 50000) * 2;
      next.netWorthYear5 -= amount;
    }
  });

  next.runwayMonths = clamp(next.runwayMonths, 0);
  next.lowestMonthlyBalance = Math.round(next.lowestMonthlyBalance);
  next.netWorthYear5 = Math.round(next.netWorthYear5);
  next.riskLevel = calculateRiskLevel(next);

  return next;
};

const applyStressToSeries = (
  baseline: TimeSeriesPoint[],
  stresses: StressConfig[]
): TimeSeriesPoint[] => {
  let next = baseline.map((point) => ({ ...point }));

  stresses.forEach((stress) => {
    if (stress.type === "job_loss") {
      const months = Number(stress.params.months ?? 0);
      const startIndex = 4;
      const endIndex = Math.min(startIndex + months, next.length);
      next = next.map((point, index) => {
        if (index >= startIndex && index < endIndex) {
          return { ...point, value: point.value - 12000 };
        }
        return point;
      });
    }

    if (stress.type === "rate_hike") {
      const rate = Number(stress.params.rate ?? 0);
      next = next.map((point, index) =>
        index > 6 ? { ...point, value: point.value - rate * 3500 } : point
      );
    }

    if (stress.type === "medical") {
      const amount = Number(stress.params.amount ?? 0);
      const dipIndex = 8;
      next = next.map((point, index) => {
        if (index === dipIndex) {
          return { ...point, value: point.value - amount * 0.6 };
        }
        if (index > dipIndex && index <= dipIndex + 3) {
          return { ...point, value: point.value - amount * 0.15 };
        }
        return point;
      });
    }
  });

  return next.map((point) => ({ ...point, value: Math.round(point.value) }));
};

const buildStressLabel = (
  type: StressType,
  value: string,
  currency: string
) => {
  if (type === "job_loss") {
    return `Job loss · ${value} months`;
  }
  if (type === "rate_hike") {
    return `Rate hike · +${value}%`;
  }
  return `Medical · ${formatCurrency(Number(value), currency)}`;
};

const buildConfig = (
  type: StressType,
  value: string,
  currency: string
): StressConfig => {
  if (type === "job_loss") {
    return {
      type,
      label: buildStressLabel(type, value, currency),
      params: { months: Number(value) },
    };
  }

  if (type === "rate_hike") {
    return {
      type,
      label: buildStressLabel(type, value, currency),
      params: { rate: Number(value) },
    };
  }

  return {
    type,
    label: buildStressLabel(type, value, currency),
    params: { amount: Number(value) },
  };
};

export default function StressPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scenarios, setScenarios] = useState(mockScenarios);
  const [selectedValues, setSelectedValues] = useState({
    job_loss: "6",
    rate_hike: "1",
    medical: "100000",
  });
  const [appliedStresses, setAppliedStresses] = useState<StressConfig[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.isActive) ?? scenarios[0],
    [scenarios]
  );

  const scenario = useMemo(() => {
    const scenarioId = searchParams?.get("scenarioId");
    return (
      scenarios.find((item) => item.id === scenarioId) ??
      activeScenario ??
      scenarios[0]
    );
  }, [activeScenario, scenarios, searchParams]);

  const scenarioId = scenario?.id ?? "";
  const currency = scenario?.baseCurrency ?? "HKD";
  const hasStress = appliedStresses.length > 0;
  const medicalOptions = useMemo(
    () =>
      medicalAmounts.map((amount) => ({
        label: formatCurrency(amount, currency),
        value: String(amount),
      })),
    [currency]
  );

  const stressedKpis = useMemo(
    () => applyStressToKpis(baselineKpis, appliedStresses),
    [appliedStresses]
  );

  const stressedSeries = useMemo(
    () => applyStressToSeries(baselineSeries, appliedStresses),
    [appliedStresses]
  );

  const updateStress = (type: StressType) => {
    const value = selectedValues[type];
    const config = buildConfig(type, value, currency);

    setAppliedStresses((current) => {
      const filtered = current.filter((item) => item.type !== type);
      return [...filtered, config];
    });
  };

  const handleRevert = () => {
    setAppliedStresses([]);
  };

  const handleSaveScenario = (name: string, includeSummary: boolean) => {
    const stressSuffix = appliedStresses.map((stress) => stress.label).join(", ");
    const displayName =
      includeSummary && stressSuffix ? `${name} · ${stressSuffix}` : name;

    setScenarios((current) => [
      {
        id: `scenario-${Date.now()}`,
        name: displayName,
        baseCurrency: currency,
        isActive: false,
      },
      ...current,
    ]);

    setSaveModalOpen(false);
    router.push("/scenarios");
  };

  const headerLinks = (
    <Group gap="sm">
      <Button
        component={Link}
        href={`/overview?scenarioId=${scenarioId}`}
        variant="subtle"
      >
        Back to Overview
      </Button>
      <Button
        component={Link}
        href={`/timeline?scenarioId=${scenarioId}`}
        variant="light"
      >
        Open Timeline
      </Button>
    </Group>
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={2}>Stress Test</Title>
          <Group gap="xs">
            <Badge color="indigo" variant="light">
              {scenario?.name ?? "Scenario"}
            </Badge>
            <Button component={Link} href="/scenarios" variant="subtle" size="xs">
              Change
            </Button>
          </Group>
        </Stack>
        {headerLinks}
      </Group>

      {hasStress && (
        <Card withBorder padding="sm" radius="md">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Active stresses
            </Text>
            <Group gap="xs">
              {appliedStresses.map((stress) => (
                <Badge key={stress.label} variant="light" color="red">
                  {stress.label}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Card>
      )}

      {isDesktop ? (
        <Group align="flex-start" grow>
          <Stack gap="md" style={{ flex: 1, minWidth: 320 }}>
            <StressControlCard
              title={stressCardCopy.job_loss.title}
              description={stressCardCopy.job_loss.description}
              options={segmentOptions.job_loss}
              value={selectedValues.job_loss}
              onChange={(value) =>
                setSelectedValues((current) => ({
                  ...current,
                  job_loss: value,
                }))
              }
              onApply={() => updateStress("job_loss")}
              isApplied={appliedStresses.some(
                (stress) => stress.type === "job_loss"
              )}
            />
            <StressControlCard
              title={stressCardCopy.rate_hike.title}
              description={stressCardCopy.rate_hike.description}
              options={segmentOptions.rate_hike}
              value={selectedValues.rate_hike}
              onChange={(value) =>
                setSelectedValues((current) => ({
                  ...current,
                  rate_hike: value,
                }))
              }
              onApply={() => updateStress("rate_hike")}
              isApplied={appliedStresses.some(
                (stress) => stress.type === "rate_hike"
              )}
            />
            <StressControlCard
              title={stressCardCopy.medical.title}
              description={stressCardCopy.medical.description}
              options={medicalOptions}
              value={selectedValues.medical}
              onChange={(value) =>
                setSelectedValues((current) => ({
                  ...current,
                  medical: value,
                }))
              }
              onApply={() => updateStress("medical")}
              isApplied={appliedStresses.some(
                (stress) => stress.type === "medical"
              )}
            />
          </Stack>

          <Stack gap="md" style={{ flex: 2, minWidth: 360 }}>
            {hasStress ? (
              <Stack gap="md">
                <BeforeAfterKpiGrid
                  baseline={baselineKpis}
                  stressed={stressedKpis}
                  currency={currency}
                />
                <StressCashChart
                  baseline={baselineSeries}
                  stressed={stressedSeries}
                />
                <StressInsightsCard riskLevel={stressedKpis.riskLevel} />
                <Alert color="yellow" variant="light">
                  This is a simulation based on assumptions.
                </Alert>
                <Group justify="flex-end">
                  <Button onClick={() => setSaveModalOpen(true)}>
                    Save as Scenario
                  </Button>
                  <Button variant="light" onClick={handleRevert}>
                    Revert
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Card withBorder padding="lg" radius="md">
                <Stack gap="sm">
                  <Title order={4}>Apply a stress test to see results</Title>
                  <Text size="sm" c="dimmed">
                    Pick one or more stress tests to compare before vs after
                    projections.
                  </Text>
                </Stack>
              </Card>
            )}
          </Stack>
        </Group>
      ) : (
        <Stack gap="md">
          <StressControlCard
            title={stressCardCopy.job_loss.title}
            description={stressCardCopy.job_loss.description}
            options={segmentOptions.job_loss}
            value={selectedValues.job_loss}
            onChange={(value) =>
              setSelectedValues((current) => ({
                ...current,
                job_loss: value,
              }))
            }
            onApply={() => updateStress("job_loss")}
            isApplied={appliedStresses.some(
              (stress) => stress.type === "job_loss"
            )}
          />
          <StressControlCard
            title={stressCardCopy.rate_hike.title}
            description={stressCardCopy.rate_hike.description}
            options={segmentOptions.rate_hike}
            value={selectedValues.rate_hike}
            onChange={(value) =>
              setSelectedValues((current) => ({
                ...current,
                rate_hike: value,
              }))
            }
            onApply={() => updateStress("rate_hike")}
            isApplied={appliedStresses.some(
              (stress) => stress.type === "rate_hike"
            )}
          />
          <StressControlCard
            title={stressCardCopy.medical.title}
            description={stressCardCopy.medical.description}
            options={medicalOptions}
            value={selectedValues.medical}
            onChange={(value) =>
              setSelectedValues((current) => ({
                ...current,
                medical: value,
              }))
            }
            onApply={() => updateStress("medical")}
            isApplied={appliedStresses.some(
              (stress) => stress.type === "medical"
            )}
          />
          {hasStress && (
            <Stack gap="md">
              <BeforeAfterKpiGrid
                baseline={baselineKpis}
                stressed={stressedKpis}
                currency={currency}
              />
              <StressCashChart
                baseline={baselineSeries}
                stressed={stressedSeries}
              />
              <Alert color="yellow" variant="light">
                This is a simulation based on assumptions.
              </Alert>
            </Stack>
          )}
          <Text size="xs" c="dimmed">
            Planning & simulation only. Not investment advice.
          </Text>
          {hasStress && (
            <StickyActionBar
              onSave={() => setSaveModalOpen(true)}
              onRevert={handleRevert}
            />
          )}
        </Stack>
      )}

      {isDesktop && (
        <Text size="xs" c="dimmed">
          Planning & simulation only. Not investment advice.
        </Text>
      )}

      <SaveScenarioModal
        opened={saveModalOpen}
        defaultName={scenario?.name ?? "New Scenario"}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveScenario}
      />
    </Stack>
  );
}
