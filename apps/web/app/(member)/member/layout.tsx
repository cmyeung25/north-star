import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, AppShellMain, AppShellNavbar, Button, Group, NavLink, Stack, Text, Title } from "@mantine/core";
import { createSupabaseServerClient } from "../../../src/lib/supabase/server";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/member");
  }

  return (
    <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
      <AppShellNavbar p="sm">
        <Stack h="100%" gap="xs">
          <div>
            <Title order={4}>會員專區</Title>
            <Text size="sm" c="dimmed">
              案例與情境管理
            </Text>
          </div>
          <NavLink component={Link} href="/member/cases" label="Cases" />
          <NavLink component={Link} href="/account" label="Account settings" />
          <Group mt="auto">
            <Button component={Link} href="/auth/logout" variant="subtle" fullWidth justify="flex-start">
              Logout
            </Button>
          </Group>
        </Stack>
      </AppShellNavbar>
      <AppShellMain>{children}</AppShellMain>
    </AppShell>
  );
}
