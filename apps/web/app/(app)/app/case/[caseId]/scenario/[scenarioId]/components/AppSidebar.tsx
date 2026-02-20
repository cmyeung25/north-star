"use client";

import Link from "next/link";
import { AppShell, Box, Button, NavLink, ScrollArea, Stack, alpha, useMantineTheme } from "@mantine/core";
import { useTranslations } from "next-intl";

type WorkspaceTab = {
  href: string;
  label: string;
};

type AppSidebarProps = {
  tabs: WorkspaceTab[];
  pathname: string;
  backToCasesHref: string;
};

export default function AppSidebar({ tabs, pathname, backToCasesHref }: AppSidebarProps) {
  const theme = useMantineTheme();
  const t = useTranslations("app.shell");

  return (
    <AppShell.Navbar
      p="sm"
      style={{
        backgroundColor: theme.colors.polar[9],
        boxShadow: "8px 0 24px rgba(0,0,0,0.18)",
        borderInlineEnd: `1px solid ${alpha(theme.white, 0.08)}`,
      }}
    >
      <Stack h="100%" gap="sm">
        <ScrollArea type="auto" flex={1}>
          <Stack gap={4} pr="xs">
            {tabs.map((tab) => (
              <NavLink
                key={tab.href}
                component={Link}
                href={tab.href}
                active={pathname === tab.href}
                label={tab.label}
                c={alpha(theme.white, 0.92)}
                styles={{
                  root: {
                    borderRadius: theme.radius.md,
                    borderInlineStart: "3px solid transparent",
                    "&:hover": {
                      backgroundColor: alpha(theme.white, 0.06),
                    },
                  },
                  label: {
                    fontWeight: 600,
                  },
                }}
                style={{
                  backgroundColor: pathname === tab.href ? alpha(theme.colors.aurora[6], 0.18) : "transparent",
                  borderInlineStartColor: pathname === tab.href ? theme.colors.aurora[5] : "transparent",
                }}
              />
            ))}
          </Stack>
        </ScrollArea>

        <Box pt="xs" style={{ borderTop: `1px solid ${alpha(theme.white, 0.1)}` }}>
          <Button
            component={Link}
            href={backToCasesHref}
            variant="subtle"
            justify="flex-start"
            c={alpha(theme.white, 0.86)}
            styles={{ root: { width: "100%" } }}
          >
            {t("backToCases")}
          </Button>
        </Box>
      </Stack>
    </AppShell.Navbar>
  );
}
