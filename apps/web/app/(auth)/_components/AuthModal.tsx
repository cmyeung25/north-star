"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Divider, Modal, SegmentedControl, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { defaultLocale, locales, type Locale } from "../../../src/i18n/routing";
import {
  buildMemberCasesEntryHref,
  consumeMemberCasesAuthReturnIntent,
} from "../../../src/features/member/createCaseEntry";
import type { AuthModalTab } from "../../(marketing)/_components/AuthModalController";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import SocialLoginButtons from "./SocialLoginButtons";

const LOCALE_COOKIE_NAME = "aurin_locale";

const isLocale = (value: string): value is Locale => locales.includes(value as Locale);

const getLocaleFromCookie = (): Locale | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const localeCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_NAME}=`));

  if (!localeCookie) {
    return null;
  }

  const value = decodeURIComponent(localeCookie.split("=")[1] ?? "");
  return isLocale(value) ? value : null;
};

const resolveLocaleFromPathname = (pathname: string): Locale => {
  const segment = pathname.split("/").filter(Boolean)[0];

  if (segment && isLocale(segment)) {
    return segment;
  }

  return getLocaleFromCookie() ?? defaultLocale;
};

export default function AuthModal({ opened, initialTab, onClose }: { opened: boolean; initialTab: AuthModalTab; onClose: () => void }) {
  const t = useTranslations("auth.modal");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AuthModalTab>(initialTab);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setActiveTab(initialTab);
      setNotice(null);
    }
  }, [initialTab, opened]);

  const resolvedLocale = useMemo(() => resolveLocaleFromPathname(pathname), [pathname]);

  const handleClose = () => {
    const authParam = searchParams.get("auth");
    onClose();

    if (authParam === "login" || authParam === "register") {
      router.replace(pathname);
    }
  };

  const handleLoginSuccess = () => {
    const pendingEntryIntent = consumeMemberCasesAuthReturnIntent(window.sessionStorage);
    router.replace(
      buildMemberCasesEntryHref(resolvedLocale, pendingEntryIntent ?? { journey: null, presetId: null })
    );
    router.refresh();
  };

  const handleRegistered = () => {
    setNotice(t("notice.checkEmail"));
    setActiveTab("login");
  };

  return (
    <Modal opened={opened} onClose={handleClose} size="md" title={activeTab === "login" ? t("title.login") : t("title.register")} centered>
      <Stack>
        <SegmentedControl
          fullWidth
          value={activeTab}
          onChange={(value) => setActiveTab(value as AuthModalTab)}
          data={[
            { label: t("tabs.login"), value: "login" },
            { label: t("tabs.register"), value: "register" },
          ]}
        />

        {notice ? <Alert color="green">{notice}</Alert> : null}
        <SocialLoginButtons />
        <Divider label={t("divider.or")} labelPosition="center" />

        {activeTab === "login" ? <LoginForm onSuccess={handleLoginSuccess} /> : <RegisterForm onRegistered={handleRegistered} />}
        <Text size="sm" c="dimmed">
          {activeTab === "login" ? t("login.switchHint") : t("register.switchHint")}
        </Text>
      </Stack>
    </Modal>
  );
}
