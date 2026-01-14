"use client";

import {
  Button,
  Card,
  Group,
  Notification,
  NumberInput,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getScenarioById, useScenarioStore } from "../../src/store/scenarioStore";
import {
  buildScenarioUrl,
  getScenarioIdFromSearchParams,
  resolveScenarioId,
} from "../../src/utils/scenarioContext";

type ToastState = {
  message: string;
  color?: string;
};

const horizonOptions = [
  { value: "120", label: "10y" },
  { value: "240", label: "20y" },
  { value: "360", label: "30y" },
];

const baseMonthHelper = "Leave empty to auto-use the earliest event start month.";

const isValidBaseMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const scenarioIdFromQuery = getScenarioIdFromSearchParams(searchParams);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );

  const [toast, setToast] = useState<ToastState | null>(null);
  const [baseMonthInput, setBaseMonthInput] = useState("");
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (
      scenarioIdFromQuery &&
      scenarioIdFromQuery !== activeScenarioId &&
      scenarios.some((scenario) => scenario.id === scenarioIdFromQuery)
    ) {
      setActiveScenario(scenarioIdFromQuery);
    }
  }, [activeScenarioId, scenarioIdFromQuery, scenarios, setActiveScenario]);

  const resolvedScenarioId = useMemo(
    () => resolveScenarioId(searchParams, activeScenarioId, scenarios),
    [activeScenarioId, scenarios, searchParams]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);

  useEffect(() => {
    if (!scenario) {
      return;
    }
    setBaseMonthInput(scenario.assumptions.baseMonth ?? "");
  }, [scenario]);

  const showToast = (message: string, color?: string) => {
    setToast({ message, color });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2000);
  };

  const handleAssumptionChange = (
    patch: Parameters<typeof updateScenarioAssumptions>[1]
  ) => {
    if (!scenario) {
      return;
    }
    updateScenarioAssumptions(scenario.id, patch);
    showToast("Saved", "teal");
  };

  if (!scenario) {
    return null;
  }

  const { assumptions } = scenario;
  const horizonValue = horizonOptions.some(
    (option) => Number(option.value) === assumptions.horizonMonths
  )
    ? String(assumptions.horizonMonths)
    : "240";

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Settings</Title>
        <Text c="dimmed" size="sm">
          Customize assumptions for {scenario.name}.
        </Text>
      </Stack>

      {toast && (
        <Notification color={toast.color} onClose={() => setToast(null)}>
          {toast.message}
        </Notification>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={6}>
            <Text fw={600}>Planning horizon</Text>
            <SegmentedControl
              data={horizonOptions}
              value={horizonValue}
              onChange={(value) =>
                handleAssumptionChange({ horizonMonths: Number(value) })
              }
            />
          </Stack>

          <NumberInput
            label="Initial cash"
            value={assumptions.initialCash}
            min={0}
            step={1000}
            thousandSeparator=","
            onChange={(value) => {
              if (typeof value === "number") {
                handleAssumptionChange({ initialCash: value });
              }
            }}
          />

          <Stack gap={6}>
            <TextInput
              label="Base month"
              placeholder="YYYY-MM"
              value={baseMonthInput}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setBaseMonthInput(nextValue);
                if (nextValue.trim() === "") {
                  handleAssumptionChange({ baseMonth: null });
                } else if (isValidBaseMonth(nextValue)) {
                  handleAssumptionChange({ baseMonth: nextValue });
                }
              }}
            />
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {baseMonthHelper}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setBaseMonthInput("");
                  handleAssumptionChange({ baseMonth: null });
                }}
              >
                Auto
              </Button>
            </Group>
          </Stack>

          <Group grow>
            <NumberInput
              label="Inflation rate (%)"
              value={assumptions.inflationRate ?? ""}
              min={0}
              step={0.1}
              decimalScale={2}
              onChange={(value) =>
                handleAssumptionChange({
                  inflationRate: typeof value === "number" ? value : undefined,
                })
              }
            />
            <NumberInput
              label="Salary growth (%)"
              value={assumptions.salaryGrowthRate ?? ""}
              min={0}
              step={0.1}
              decimalScale={2}
              onChange={(value) =>
                handleAssumptionChange({
                  salaryGrowthRate: typeof value === "number" ? value : undefined,
                })
              }
            />
          </Group>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Emergency fund target</Text>
              <Text size="sm" c="dimmed">
                {assumptions.emergencyFundMonths ?? 6} months
              </Text>
            </Group>
            <Slider
              min={3}
              max={12}
              step={1}
              value={assumptions.emergencyFundMonths ?? 6}
              onChange={(value) =>
                handleAssumptionChange({ emergencyFundMonths: value })
              }
            />
          </Stack>
        </Stack>
      </Card>

      <Group>
        <Button component={Link} href={buildScenarioUrl("/overview", scenario.id)}>
          Open Overview
        </Button>
        <Button
          component={Link}
          href={buildScenarioUrl("/timeline", scenario.id)}
          variant="light"
        >
          Open Timeline
        </Button>
      </Group>
    </Stack>
  );
}
