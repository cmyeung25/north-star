"use client";

import {
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useScenarioStore } from "../src/store/scenarioStore";
import { normalizeMonthInput } from "../src/utils/month";
import { Link } from "../src/i18n/navigation";
import { buildScenarioUrl } from "../src/utils/scenarioContext";
import AddFlowDrawer from "../features/add/AddFlowDrawer";

export const desktopToolbarHeight = 72;

export default function DesktopBottomToolbar() {
  const t = useTranslations("toolbar");
  const nav = useTranslations("nav");
  const assumptions = useTranslations("assumptions");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const appSettings = useScenarioStore((state) => state.appSettings);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setGlobalBaseMonth = useScenarioStore((state) => state.setGlobalBaseMonth);
  const setGlobalHorizonMonths = useScenarioStore((state) => state.setGlobalHorizonMonths);
  const setAnnualInflationPct = useScenarioStore((state) => state.setAnnualInflationPct);
  const setViewMode = useScenarioStore((state) => state.setViewMode);
  const [addOpen, setAddOpen] = useState(false);

  const baseMonthStoreValue = appSettings.globalBaseMonth ?? "";
  const [baseMonthInput, setBaseMonthInput] = useState(baseMonthStoreValue);
  const [baseMonthError, setBaseMonthError] = useState<string | null>(null);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setBaseMonthInput(baseMonthStoreValue);
    }
  }, [baseMonthStoreValue]);

  const handleBaseMonthChange = (value: string) => {
    setBaseMonthInput(value);
    const normalized = normalizeMonthInput(value);
    if (normalized.status === "valid" && normalized.month) {
      setGlobalBaseMonth(normalized.month);
      setBaseMonthError(null);
      return;
    }
    if (normalized.status === "empty") {
      setGlobalBaseMonth(null);
      setBaseMonthError(null);
      return;
    }
    if (normalized.status === "invalid") {
      setBaseMonthError(validation("useYearMonth"));
      return;
    }
    setBaseMonthError(null);
  };

  const handleBaseMonthBlur = () => {
    isEditingRef.current = false;
    const normalized = normalizeMonthInput(baseMonthInput);
    if (normalized.status === "invalid") {
      setBaseMonthInput(baseMonthStoreValue);
      setBaseMonthError(null);
    }
  };

  const navLinks = useMemo<
    Array<{
      label: string;
      href: "/money" | "/timeline" | "/people" | "/settings";
    }>
  >(
    () => [
      { label: nav("money"), href: "/money" },
      { label: nav("timeline"), href: "/timeline" },
      { label: nav("people"), href: "/people" },
      { label: nav("settings"), href: "/settings" },
    ],
    [nav]
  );

  const scenarioId = activeScenarioId;
  const resolvedNavLinks = navLinks.map((link) => ({
    ...link,
    href: scenarioId ? buildScenarioUrl(link.href, scenarioId) : link.href,
  }));

  return (
    <Paper
      shadow="sm"
      withBorder
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
      }}
      px="lg"
      py="sm"
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="md" align="center" wrap="nowrap">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            {t("addButton")}
          </Button>
        </Group>

        <Group gap="lg" align="center" wrap="nowrap">
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed">
              {t("quickSettings")}
            </Text>
            <Group gap="sm" wrap="nowrap">
              <TextInput
                label={assumptions("baseMonth")}
                value={baseMonthInput}
                onChange={(event) => handleBaseMonthChange(event.currentTarget.value)}
                placeholder={common("yearMonthPlaceholder")}
                error={baseMonthError ?? undefined}
                size="xs"
                w={140}
                onFocus={() => {
                  isEditingRef.current = true;
                }}
                onBlur={handleBaseMonthBlur}
              />
              <NumberInput
                label={assumptions("horizonMonths")}
                value={appSettings.globalHorizonMonths}
                min={60}
                max={480}
                step={12}
                size="xs"
                w={140}
                onChange={(value) => {
                  if (typeof value === "number") {
                    setGlobalHorizonMonths(value);
                  }
                }}
              />
              <NumberInput
                label={assumptions("annualInflationPct")}
                value={appSettings.annualInflationPct}
                min={0}
                step={0.1}
                decimalScale={2}
                size="xs"
                w={150}
                onChange={(value) =>
                  setAnnualInflationPct(typeof value === "number" ? value : 0)
                }
              />
              <Stack gap={4}>
                <Text size="xs" fw={600}>
                  {assumptions("viewModeLabel")}
                </Text>
                <SegmentedControl
                  data={[
                    { value: "nominal", label: assumptions("viewNominal") },
                    { value: "real", label: assumptions("viewReal") },
                  ]}
                  size="xs"
                  value={appSettings.viewMode}
                  onChange={(value) => setViewMode(value as "nominal" | "real")}
                />
              </Stack>
            </Group>
          </Stack>

          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed">
              {t("quickNav")}
            </Text>
            <Group gap="xs" wrap="nowrap">
              {resolvedNavLinks.map((link) => (
                <Text
                  key={link.href}
                  component={Link}
                  href={link.href}
                  size="sm"
                  fw={500}
                >
                  {link.label}
                </Text>
              ))}
            </Group>
          </Stack>
        </Group>
      </Group>
      <AddFlowDrawer
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        scenarioId={scenarioId}
      />
    </Paper>
  );
}
