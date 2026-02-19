import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, AppShellMain, AppShellNavbar, Box, Button, Group, NavLink, Stack, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import BrandLogo from "../../../../components/brand/BrandLogo";

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
      <AppShellNavbar p="sm">
        <Stack h="100%" gap="xs">
          <Group>
            <Box px="xs" py={4}>
              <BrandLogo size="md" />
            </Box>
            <Title order={4}>AURIN 財務規劃平台</Title>
          </Group>
          <NavLink component={Link} href="/member/cases" label={t("scenarios")} />
          <NavLink component={Link} href="/account" label="Account settings" />
          <Group mt="auto">
            <Button component={Link} href="/auth/logout" variant="subtle" fullWidth justify="flex-start" prefetch={false}>
              Logout
            </Button>
          </Group>
        </Stack>
      </AppShellNavbar>
      <AppShellMain>{children}</AppShellMain>
    </AppShell>
  );
}
