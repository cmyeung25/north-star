"use client";

import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Container,
  Group,
  MantineProvider,
  Menu,
  NavLink,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
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
import ScenarioSwitcher from "../components/ScenarioSwitcher";
import BrandLogo from "../components/brand/BrandLogo";
import {
  desktopToolbarHeight,
} from "../components/DesktopBottomToolbar";
import { Link } from "../src/i18n/navigation";
import { aurinTheme } from "./theme/aurinTheme";
import { createSupabaseBrowserClient } from "../src/lib/supabase/browser";
import { CaseScenarioProvider } from "../src/contexts/CaseScenarioProvider";


const stripLocalePrefix = (pathname: string, locale: string) => {
  if (!pathname.startsWith(`/${locale}`)) {
    return pathname;
  }

  const nextPath = pathname.replace(`/${locale}`, "");
  return nextPath === "" ? "/" : nextPath;
};

type ProvidersProps = {
  children: ReactNode;
  initialSupabaseUser: User | null;
};

export default function Providers({ children, initialSupabaseUser }: ProvidersProps) {
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
  const [supabaseUser, setSupabaseUser] = useState<User | null>(initialSupabaseUser);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const normalizedPathname = stripLocalePrefix(pathname, locale);
  const isOnboarding = normalizedPathname.startsWith("/onboarding");
  const skipScenarioGuard =
    isOnboarding || normalizedPathname.startsWith("/login") || normalizedPathname.startsWith("/debug");
  const isWorkspaceAppRoute = normalizedPathname.startsWith("/app/case/");

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const navItems = [
    { label: nav("dashboard"), href: "/dashboard" },
    { label: nav("planLab"), href: "/plan-lab" },
    { label: nav("money"), href: "/money" },
    { label: nav("people"), href: "/people" },
    { label: nav("settings"), href: "/settings" },
    { label: nav("scenarios"), href: "/member/cases" },
  ];

  const isSignedIn = authState.status === "signed-in";
  const statusLabel = isSignedIn
    ? t("statusSignedIn", { mode: autoSyncEnabled ? t("statusOn") : t("statusOff") })
    : t("statusLocalMode");
  const actionLabel = isSignedIn ? t("syncSettings") : t("signInToSync");
  const shellBg = "var(--mantine-color-polar-9)";
  const shellActive = "rgba(221, 231, 255, 0.18)";

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
    const height = isOnboarding
      ? 0
      : isDesktop
      ? desktopToolbarHeight
      : footerRef.current?.offsetHeight ?? 0;
    document.documentElement.style.setProperty(
      "--bottom-nav-height",
      `${height}px`
    );
    return () => {
      document.documentElement.style.setProperty("--bottom-nav-height", "0px");
    };
  }, [isDesktop, isOnboarding, normalizedPathname]);

  useEffect(() => {
    if (!scenarioHydrated || skipScenarioGuard) {
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
          router.replace(`/${locale}/dashboard`);
        }
      }
      return;
    }

    const shouldSkipOnboarding =
      activeScenario?.clientComputed?.onboardingCompleted === true ||
      activeScenario?.meta?.skipOnboarding === true ||
      activeScenario?.meta?.isSeeded === true;

    if (activeScenario && !shouldSkipOnboarding) {
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
    skipScenarioGuard,
  ]);

  useEffect(() => {
    if (
      authState.status !== "signed-in" ||
      !authState.user ||
      !autoSyncEnabled ||
      !isFirebaseConfigured ||
      isWorkspaceAppRoute
    ) {
      stopAutoSync();
      return;
    }

    startAutoSync(authState.user.uid);

    return () => {
      stopAutoSync();
    };
  }, [authState.status, authState.user, autoSyncEnabled, isWorkspaceAppRoute]);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setSupabaseUser(data.user ?? null);
    };

    void loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      router.refresh();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const handleSupabaseSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const supabaseEmail = supabaseUser?.email ?? null;

  return (
    <CaseScenarioProvider>
      <MantineProvider theme={aurinTheme}>
      <AppShell
        header={{ height: 64 }}
        navbar={isDesktop ? { width: 220, breakpoint: 0 } : undefined}
        footer={!isDesktop ? { height: 72 } : undefined}
        padding="md"
      >
        <AppShell.Header
          style={{
            background: shellBg,
            color: "var(--mantine-color-gray-0)",
            borderColor: "var(--mantine-color-polar-8)",
          }}
        >
          {isDesktop ? (
            <Group h="100%" px="md" justify="space-between">
              <BrandLogo size="md" href="/member/cases" priority />
              <Group gap="xs" align="center">
                <ScenarioSwitcher />
                <Button
                  component={Link}
                  href="/plan-lab"
                  size="xs"
                  color="aurora"
                >
                  {nav("planLab")}
                </Button>
                <Group gap={6}>
                  <Text size="xs" c="gray.2">
                    {isSignedIn ? t("statusSignedIn", { mode: autoSyncEnabled ? t("statusOn") : t("statusOff") }) : t("statusLocalMode")}
                  </Text>
                  <Badge size="sm" color="ice" variant="light">
                    {isSignedIn ? (autoSyncEnabled ? t("statusOn") : t("statusOff")) : t("statusOff")}
                  </Badge>
                </Group>
                {!isSignedIn && (
                  <Button
                    component={Link}
                    href="/people#sync"
                    size="xs"
                    variant="outline"
                    disabled={!isFirebaseConfigured}
                    color="gray"
                  >
                    {actionLabel}
                  </Button>
                )}
                <LanguageSwitcher />
                {supabaseEmail ? (
                  <Group gap="xs">
                    <Text size="xs" c="gray.2">
                      {supabaseEmail}
                    </Text>
                    <Button size="xs" variant="light" onClick={handleSupabaseSignOut}>
                      Sign out
                    </Button>
                  </Group>
                ) : (
                  <Button component={Link} href="/login" size="xs" variant="light">
                    Sign in
                  </Button>
                )}
              </Group>
            </Group>
          ) : (
            <Group h="100%" px="md" justify="space-between">
              <BrandLogo variant="icon" collapsed size="md" href="/member/cases" priority />
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t("actionMore")}>
                    ⋯
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Stack gap="xs" px="xs" py="xs">
                    <ScenarioSwitcher />
                    <Button
                      component={Link}
                      href="/plan-lab"
                      size="xs"
                      color="aurora"
                      fullWidth
                    >
                      {nav("planLab")}
                    </Button>
                    <Group gap={6} align="center">
                      <Text size="xs" c="gray.3">
                        {statusLabel}
                      </Text>
                      <Badge size="sm" color="ice" variant="light">
                        {isSignedIn ? (autoSyncEnabled ? t("statusOn") : t("statusOff")) : t("statusOff")}
                      </Badge>
                    </Group>
                    {!isSignedIn && (
                      <Button
                        component={Link}
                        href="/people#sync"
                        size="xs"
                        variant="outline"
                        disabled={!isFirebaseConfigured}
                        fullWidth
                      >
                        {actionLabel}
                      </Button>
                    )}
                    {supabaseEmail ? (
                      <Group justify="space-between">
                        <Text size="xs" c="gray.3">
                          {supabaseEmail}
                        </Text>
                        <Button size="xs" variant="light" onClick={handleSupabaseSignOut}>
                          Sign out
                        </Button>
                      </Group>
                    ) : (
                      <Button component={Link} href="/login" size="xs" variant="light" fullWidth>
                        Sign in
                      </Button>
                    )}
                    <LanguageSwitcher />
                  </Stack>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </AppShell.Header>

        {isDesktop && !isOnboarding && (
          <AppShell.Navbar
            p="md"
            style={{
              background: shellBg,
              color: "var(--mantine-color-gray-0)",
              borderColor: "var(--mantine-color-polar-8)",
            }}
          >
            <Stack gap="xs">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  active={normalizedPathname === item.href}
                  styles={{
                    root: {
                      color: "var(--mantine-color-gray-0)",
                      borderLeft: normalizedPathname === item.href
                        ? "3px solid var(--mantine-color-aurora-6)"
                        : "3px solid transparent",
                      borderRadius: "var(--mantine-radius-md)",
                      backgroundColor: normalizedPathname === item.href ? shellActive : "transparent",
                      "&:hover": {
                        backgroundColor: "var(--mantine-color-polar-8)",
                      },
                    },
                  }}
                />
              ))}
            </Stack>
          </AppShell.Navbar>
        )}

        {!isDesktop && !isOnboarding &&  (
          <AppShell.Footer p="xs" ref={footerRef} style={{ borderTop: "1px solid var(--mantine-color-polar-8)", background: "var(--mantine-color-polar-9)" }}>
            <Group grow>
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  variant="subtle"
                  c="gray.1"
                  style={normalizedPathname === item.href
                    ? { borderTop: "2px solid var(--mantine-color-aurora-6)", background: "rgba(221, 231, 255, 0.18)" }
                    : { borderTop: "2px solid transparent" }}
                >
                  {item.label}
                </Button>
              ))}
            </Group>
          </AppShell.Footer>
        )}

        <AppShell.Main>
          <Container
            px="xs"
            fluid 
          >
            {children}
          </Container>
        </AppShell.Main>
        {/* {isDesktop && !isOnboarding && <DesktopBottomToolbar />} */}
      </AppShell>
      </MantineProvider>
    </CaseScenarioProvider>
  );
}
