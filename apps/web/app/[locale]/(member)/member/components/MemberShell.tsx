"use client";

import { AppShell, AppShellMain, AppShellNavbar, Avatar, Box, Button, Group, Menu, NavLink, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import BrandLogo from "../../../../../components/brand/BrandLogo";
import { Link, usePathname } from "../../../../../src/i18n/navigation";

type MemberShellProps = {
  children: ReactNode;
  userEmail?: string;
  title?: string;
  description?: string;
};

export function MemberShell({ children, userEmail, title, description }: MemberShellProps) {
  const pathname = usePathname();
  const t = useTranslations("memberShell");

  return (
    <AppShell navbar={{ width: 220, breakpoint: "sm" }} padding={0}>
      <AppShellNavbar bg="polar.9" p="md">
        <Stack h="100%" gap="xs">
          <Box px="xs" pb="xs">
            <BrandLogo size="md" />
          </Box>

          <NavLink
            component={Link}
            href="/member/cases"
            label={t("cases")}
            active={pathname === "/member/cases" || pathname.startsWith("/member/cases/")}
            color="aurora"
            styles={{
              root: { color: "#E2E8F0", borderRadius: 10 },
              label: { color: "inherit", fontWeight: 600 },
            }}
          />
          <NavLink
            component={Link}
            href="/account"
            label={t("accountSettings")}
            active={pathname.startsWith("/account")}
            color="aurora"
            styles={{
              root: { color: "#E2E8F0", borderRadius: 10 },
              label: { color: "inherit", fontWeight: 600 },
            }}
          />

          <Box mt="auto" p="xs" bg="rgba(255,255,255,0.06)" style={{ borderRadius: 10 }}>
            <Menu position="top-start" withinPortal>
              <Menu.Target>
                <Button
                  variant="subtle"
                  fullWidth
                  justify="space-between"
                  color="gray"
                  px={0}
                  styles={{
                    root: { color: "#E2E8F0" },
                    section: { color: "#CBD5E1" },
                    label: { width: "100%" },
                  }}
                >
                  <Group wrap="nowrap" gap="xs">
                    <Avatar color="polar" radius="xl" size="sm">
                      {(userEmail ?? "U")[0]?.toUpperCase()}
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="xs" fw={600} c="#F8FAFC" lineClamp={1}>
                        {userEmail ?? t("member")}
                      </Text>
                      <Text size="xs" c="#94A3B8">
                        {t("signedIn")}
                      </Text>
                    </Stack>
                  </Group>
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item component={Link} href="/account">
                  {t("accountSettings")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item component={Link} href="/auth/logout" color="red">
                  {t("logout")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
        </Stack>
      </AppShellNavbar>
      <AppShellMain bg="#F8FAFC" mih="100dvh" p="xl">
        {(title || description) && (
          <Stack gap={4} mb="md">
            {title && <Title order={2}>{title}</Title>}
            {description && (
              <Text c="dimmed" size="lg">
                {description}
              </Text>
            )}
          </Stack>
        )}
        {children}
      </AppShellMain>
    </AppShell>
  );
}
