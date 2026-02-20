"use client";

import Image from "next/image";
import { Button, Group, Paper, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Link } from "../../src/i18n/navigation";
import { createSupabaseBrowserClient } from "../../src/lib/supabase/browser";
import LanguageSwitcher from "../LanguageSwitcher";
import { useAuthModal } from "../../app/(marketing)/_components/AuthModalController";

export default function MarketingHeader() {
  const t = useTranslations("marketing.web");
  const locale = useLocale();
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (mounted) {
        setIsSignedIn(Boolean(user));
      }
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <Paper
      radius="xl"
      px="md"
      py="sm"
      bg="rgba(11, 27, 58, 0.55)"
      style={{ backdropFilter: "blur(6px)", border: "1px solid rgba(221, 231, 255, 0.2)" }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Link href="/web" style={{ textDecoration: "none" }}>
          <Group gap="xs">
            <Image src="/aurin-icon-square-white.png" alt="Aurin" width={32} height={32} priority />
            <Text fw={700} c="white">
              Aurin
            </Text>
          </Group>
        </Link>

        <Group gap="xs">
          <LanguageSwitcher />
          <Button variant="subtle" color="gray" size="xs" onClick={() => openAuthModal("login")}>
            {t("cta.login")}
          </Button>
          <Button
            color="aurora"
            size="xs"
            onClick={() => {
              if (isSignedIn) {
                router.push(`/${locale}/member/cases`);
                return;
              }
              openAuthModal("register");
            }}
          >
            {t("cta.start")}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
