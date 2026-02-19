"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";
import BrandLogo from "../../../components/brand/BrandLogo";

type MemberShellProps = {
  children: ReactNode;
  userEmail?: string;
};

export function MemberShell({ children, userEmail }: MemberShellProps) {
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure(false);

  const navLinkStyles = {
    root: {
      color: "#E2E8F0",
      borderRadius: 10,
      paddingTop: 10,
      paddingBottom: 10,
    },
    label: { color: "inherit", fontWeight: 600, fontSize: "0.875rem" },
    section: { color: "inherit" },
  } as const;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={{ base: "md", sm: "xl" }}
    >
      <AppShell.Header bg="polar.9" withBorder={false}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs" wrap="nowrap">
            <BrandLogo size="sm" />
            <Text c="white" fw={700} fz="sm">
              會員區
            </Text>
          </Group>
          <Burger
            opened={opened}
            onClick={toggle}
            color="#E2E8F0"
            hiddenFrom="sm"
            size="sm"
            aria-label="Toggle navigation"
          />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar bg="polar.9" p="md">
        <Stack h="100%" gap="xs">
          <Text c="white" fw={700} fz="sm" px="xs" pb="xs" visibleFrom="sm">
            Member Console
          </Text>

          <NavLink
            component={Link}
            href="/member/cases"
            label="個案"
            active={pathname === "/member/cases" || pathname.startsWith("/member/cases/")}
            color="aurora"
            styles={navLinkStyles}
            onClick={close}
          />
          <NavLink
            component={Link}
            href="/account"
            label="帳戶設定"
            active={pathname.startsWith("/account")}
            color="aurora"
            styles={navLinkStyles}
            onClick={close}
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
                    root: { color: "#E2E8F0", minHeight: 44 },
                    section: { color: "#CBD5E1" },
                    label: { width: "100%" },
                  }}
                >
                  <Group wrap="nowrap" gap="xs">
                    <Avatar color="polar" radius="xl" size="sm">
                      {(userEmail ?? "U")[0]?.toUpperCase()}
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="sm" fw={600} c="#F8FAFC" lineClamp={1}>
                        {userEmail ?? "會員"}
                      </Text>
                      <Text size="xs" c="#94A3B8">
                        已登入
                      </Text>
                    </Stack>
                  </Group>
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item component={Link} href="/account" onClick={close}>
                  帳戶設定
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item component={Link} href="/auth/logout" color="red" onClick={close}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main bg="#F8FAFC" mih="100dvh">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
