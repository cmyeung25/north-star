"use client";

import {
  AppShell,
  Button,
  Container,
  Group,
  MantineProvider,
  Stack,
  Text,
  createTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isFirebaseConfigured } from "../lib/firebaseClient";
import { t } from "../lib/i18n";
import { useAuthState } from "../src/hooks/useAuthState";
import { startAutoSync, stopAutoSync } from "../src/sync/autoSync";
import {
  hydrateScenarioStore,
  initializeScenarioPersistence,
} from "../src/store/scenarioPersistence";
import {
  hydrateSettingsStore,
  initializeSettingsPersistence,
} from "../src/store/settingsPersistence";
import { useSettingsStore } from "../src/store/settingsStore";
import { getActiveScenario, useScenarioStore } from "../src/store/scenarioStore";

const theme = createTheme({
  primaryColor: "indigo",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
  },
  defaultRadius: "md",
});

const navItems = [
  { label: t("navHome"), href: "/" },
  { label: t("navOverview"), href: "/overview" },
  { label: t("navScenarios"), href: "/scenarios" },
  { label: t("navTimeline"), href: "/timeline" },
  { label: t("navStress"), href: "/stress" },
  { label: t("navSettings"), href: "/settings" },
];

export default function Providers({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();
  const router = useRouter();
  const authState = useAuthState();
  const autoSyncEnabled = useSettingsStore((state) => state.autoSyncEnabled);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const [scenarioHydrated, setScenarioHydrated] = useState(false);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const isSignedIn = authState.status === "signed-in";
  const statusLabel = isSignedIn
    ? `Signed in · Auto-sync ${autoSyncEnabled ? "on" : "off"}`
    : "Local mode · Data saved on this device";
  const actionLabel = isSignedIn ? "Sync settings" : "Sign in to sync";

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let settingsCleanup: (() => void) | undefined;
    let active = true;

    const start = async () => {
      await hydrateScenarioStore();
      await hydrateSettingsStore();
      if (!active) {
        return;
      }
      setScenarioHydrated(true);
      cleanup = initializeScenarioPersistence();
      settingsCleanup = initializeSettingsPersistence();
    };

    void start();

    return () => {
      active = false;
      if (cleanup) {
        cleanup();
      }
      if (settingsCleanup) {
        settingsCleanup();
      }
    };
  }, []);

  useEffect(() => {
    if (!scenarioHydrated || pathname === "/onboarding") {
      return;
    }

    if (activeScenario && activeScenario.meta?.onboardingVersion !== 1) {
      router.replace("/onboarding");
    }
  }, [activeScenario, pathname, router, scenarioHydrated]);

  useEffect(() => {
    if (
      authState.status !== "signed-in" ||
      !authState.user ||
      !autoSyncEnabled ||
      !isFirebaseConfigured
    ) {
      stopAutoSync();
      return;
    }

    startAutoSync(authState.user.uid);

    return () => {
      stopAutoSync();
    };
  }, [authState.status, authState.user, autoSyncEnabled]);

  return (
    <MantineProvider theme={theme}>
      <AppShell
        header={{ height: 64 }}
        navbar={isDesktop ? { width: 220, breakpoint: 0 } : undefined}
        footer={!isDesktop ? { height: 72 } : undefined}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Text fw={600} size="lg">
              {t("appName")}
            </Text>
            <Group gap="xs" align="center">
              <Text size="xs" c="dimmed">
                {statusLabel}
              </Text>
              <Button
                component={Link}
                href="/settings#sync"
                size="xs"
                variant="subtle"
                disabled={!isFirebaseConfigured && !isSignedIn}
              >
                {actionLabel}
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        {isDesktop && (
          <AppShell.Navbar p="md">
            <Stack gap="xs">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  variant={pathname === item.href ? "light" : "subtle"}
                  justify="flex-start"
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          </AppShell.Navbar>
        )}

        {!isDesktop && (
          <AppShell.Footer p="xs">
            <Group grow>
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  variant={pathname === item.href ? "light" : "subtle"}
                >
                  {item.label}
                </Button>
              ))}
            </Group>
          </AppShell.Footer>
        )}

        <AppShell.Main>
          <Container size="lg" px="md" py="xl">
            {children}
          </Container>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
