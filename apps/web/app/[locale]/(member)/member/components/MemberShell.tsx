"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, AppShellMain, AppShellNavbar, Avatar, Box, Button, Group, Menu, NavLink, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type MemberShellProps = {
  children: ReactNode;
  userEmail?: string;
};

export function MemberShell({ children, userEmail }: MemberShellProps) {
  const pathname = usePathname();

  return (
    <AppShell navbar={{ width: 220, breakpoint: "sm" }} padding={0}>
      <AppShellNavbar bg="polar.9" p="md">
        <Stack h="100%" gap="xs">
          <Text c="white" fw={700} fz="sm" px="xs" pb="xs">
            Member Console
          </Text>

          <NavLink
            component={Link}
            href="/member/cases"
            label="Cases"
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
            label="Account settings"
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
                        {userEmail ?? "Member"}
                      </Text>
                      <Text size="xs" c="#94A3B8">
                        已登入
                      </Text>
                    </Stack>
                  </Group>
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item component={Link} href="/account">
                  Account settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item component={Link} href="/auth/logout" color="red">
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
        </Stack>
      </AppShellNavbar>
      <AppShellMain bg="#F8FAFC" mih="100dvh" p="xl">
        {children}
      </AppShellMain>
    </AppShell>
  );
}
