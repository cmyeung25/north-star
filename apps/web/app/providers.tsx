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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isFirebaseConfigured } from "../lib/firebaseClient";
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
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Link } from "../src/i18n/navigation";

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

const stripLocalePrefix = (pathname: string, locale: string) => {
  if (!pathname.startsWith(`/${locale}`)) {
    return pathname;
  }

  const nextPath = pathname.replace(`/${locale}`, "");
  return nextPath === "" ? "/" : nextPath;
};

export default function Providers({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("common");
  const nav = useTranslations("nav");
  const authState = useAuthState();
  const autoSyncEnabled = useSettingsStore((state) => state.autoSyncEnabled);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const [scenarioHydrated, setScenarioHydrated] = useState(false);
  const normalizedPathname = stripLocalePrefix(pathname, locale);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const navItems = [
    { label: nav("home"), href: "/" },
    { label: nav("overview"), href: "/overview" },
    { label: nav("scenarios"), href: "/scenarios" },
    { label: nav("timeline"), href: "/timeline" },
    { label: nav("stress"), href: "/stress" },
    { label: nav("settings"), href: "/settings" },
  ];

  const isSignedIn = authState.status === "signed-in";
  const statusLabel = isSignedIn
    ? t("statusSignedIn", { mode: autoSyncEnabled ? t("statusOn") : t("statusOff") })
    : t("statusLocalMode");
  const actionLabel = isSignedIn ? t("syncSettings") : t("signInToSync");

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
    if (!scenarioHydrated || normalizedPathname === "/onboarding") {
      return;
    }

    if (scenarios.length === 0) {
      if (normalizedPathname !== "/scenarios") {
        router.replace(`/${locale}/onboarding`);
      }
      return;
    }

    if (scenarios.length > 0 && !scenarios.some((scenario) => scenario.id === activeScenarioId)) {
      const fallbackId = scenarios[0]?.id;
      if (fallbackId) {
        setActiveScenario(fallbackId);
        if (normalizedPathname !== "/scenarios") {
          router.replace(`/${locale}/overview`);
        }
      }
      return;
    }

    if (activeScenario && activeScenario.clientComputed?.onboardingCompleted !== true) {
      router.replace(`/${locale}/onboarding`);
    }
  }, [
    activeScenario,
    activeScenarioId,
    locale,
    normalizedPathname,
    router,
    scenarioHydrated,
    scenarios,
    setActiveScenario,
  ]);

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
              <LanguageSwitcher />
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
                  variant={normalizedPathname === item.href ? "light" : "subtle"}
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
                  variant={normalizedPathname === item.href ? "light" : "subtle"}
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
