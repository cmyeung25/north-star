import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, Button, Group, NavLink, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';

type Props = { children: ReactNode; params: { locale: string } };

export default async function MemberLayout({ children, params }: Props) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginPath = params.locale === "en" ? "/en/auth/login?redirectTo=/en/member" : "/auth/login?redirectTo=/member";
    redirect(loginPath);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "nav" });

  return (
    <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
      <AppShell.Navbar p="sm">
        <Stack h="100%" gap="xs">
          <div>
            <Title order={4}>會員專區</Title>
            <Text size="sm" c="dimmed">
              案例與情境管理
            </Text>
          </div>
          <NavLink component={Link} href="/member/cases" label={t("scenarios")} />
          <NavLink component={Link} href="/account" label="Account settings" />
          <Group mt="auto">
            <Button component={Link} href="/auth/logout" variant="subtle" fullWidth justify="flex-start">
              Logout
            </Button>
          </Group>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
