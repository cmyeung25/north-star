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
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { useScenarioStore } from "../src/store/scenarioStore";
import { normalizeMonthInput } from "../src/utils/month";
import { Link } from "../src/i18n/navigation";
import { scenarioMoneyPath, scenarioPeoplePath, scenarioSettingsPath } from "../lib/routes/appRoutes";
import AddFlowDrawer from "../features/add/AddFlowDrawer";
import { usePathname, useRouter } from "next/navigation";
import { useUiStore } from "../src/store/uiStore";
import { useScenarioContext } from "../src/hooks/useScenarioContext";

export const desktopToolbarHeight = 72;

export default function DesktopBottomToolbar() {
  const t = useTranslations("toolbar");
  const nav = useTranslations("nav");
  const timeline = useTranslations("timeline");
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
  const router = useRouter();
  const pathname = usePathname();
  const openDrawer = useUiStore((state) => state.openDrawer);
  const scenarioContext = useScenarioContext();
  const caseId = scenarioContext?.caseId ?? "";

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
      action?: "smartInvest";
    }>
  >(
    () => [
      { label: nav("money"), href: "/money" },
      { label: nav("timeline"), href: "/timeline" },
      { label: nav("people"), href: "/people" },
      {
        label: timeline("smartInvestTitle"),
        href: "/money",
        action: "smartInvest",
      },
      { label: nav("settings"), href: "/settings" },
    ],
    [nav, timeline]
  );

  const scenarioId = activeScenarioId;
  const resolvedNavLinks = navLinks.map((link) => ({
    ...link,
    href:
      scenarioId && caseId
        ? link.href === "/money"
          ? scenarioMoneyPath(caseId, scenarioId)
          : link.href === "/timeline"
            ? `${scenarioMoneyPath(caseId, scenarioId)}?tab=timeline`
            : link.href === "/people"
              ? scenarioPeoplePath(caseId, scenarioId)
              : scenarioSettingsPath(caseId, scenarioId)
        : link.href,
  }));

  const handleNavClick = (
    event: MouseEvent<HTMLAnchorElement>,
    link: (typeof resolvedNavLinks)[number]
  ) => {
    if (link.action !== "smartInvest") {
      return;
    }
    event.preventDefault();
    openDrawer("smartInvest");
    if (!pathname.endsWith("/money")) {
      router.push(link.href);
    }
  };

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
        borderRadius: 0,
      }}
      px="lg"
      py="sm"
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="lg" align="center" wrap="nowrap">
          <Stack gap={4}>
            {/* <Text size="xs" fw={600} c="dimmed">
              {t("quickSettings")}
            </Text> */}
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
                max={960}
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
                  onClick={(event) => handleNavClick(event, link)}
                >
                  {link.label}
                </Text>
              ))}
            </Group>
          </Stack>
        </Group>
        <Group gap="md" align="center" wrap="nowrap">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            {t("addButton")}
          </Button>
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
