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
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "../lib/i18n";

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
  { label: t("navScenarios"), href: "/scenarios" },
  { label: t("navTimeline"), href: "/timeline" },
  { label: t("navStress"), href: "/stress" },
];

export default function Providers({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();

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
