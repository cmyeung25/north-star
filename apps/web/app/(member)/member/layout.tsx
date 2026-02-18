import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, NavLink, Stack, Text, Title } from "@mantine/core";
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
    <AppShell
      navbar={{ width: 240, breakpoint: "sm" }}
      padding={0}
      styles={{
        main: {
          background: "var(--aur-surface-50)",
          minHeight: "100vh",
        },
      }}
    >
      <AppShell.Navbar p="md" style={{ borderRight: "1px solid var(--aur-border-200)" }}>
        <Stack gap="xs">
          <Title order={4}>Member</Title>
          <Text size="sm" c="dimmed">
            Case / scenario management
          </Text>
          <NavLink component={Link} href="/member/cases" label="Cases" />
          <NavLink component={Link} href="/account" label="Account settings" />
          <NavLink component={Link} href="/auth/logout" label="Logout" />
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
