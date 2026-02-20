"use client";

import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../src/lib/supabase/browser";

import { defaultLocale, locales, type Locale } from "../../../src/i18n/routing";

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

const withLocale = (locale: Locale, path: string) => `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debugLog = (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.info("[login]", ...args);
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const response =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (response.error) {
      setLoading(false);
      setError(response.error.message);
      return;
    }

    if (mode === "sign-up") {
      setLoading(false);
      setMessage(t("messages.signUpSuccess"));
      return;
    }

    debugLog("signIn response has session", Boolean(response.data.session));

    const waitForSession = async () => {
      const timeoutMs = 2000;
      const intervalMs = 100;
      const startedAt = Date.now();
      let session = response.data.session;

      while (!session && Date.now() - startedAt < timeoutMs) {
        const { data } = await supabase.auth.getSession();
        session = data.session;

        if (!session) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      return session;
    };

    const session = await waitForSession();
    debugLog("getSession result", Boolean(session));

    const callbackUrl = searchParams.get("callbackUrl") ?? searchParams.get("redirectTo");
    const resolvedLocale = getLocaleFromCookie() ?? defaultLocale;
    const localizedCasesPath = withLocale(resolvedLocale, "/member/cases");

    const destination = callbackUrl && callbackUrl.startsWith("/")
      ? callbackUrl.startsWith("/member/")
        ? withLocale(resolvedLocale, callbackUrl)
        : callbackUrl
      : localizedCasesPath;

    debugLog("navigation start", destination);
    setLoading(false);

    router.replace(destination);
    router.refresh();
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    await supabase.auth.signOut();
    setLoading(false);
    setMessage(t("messages.signedOut"));
    router.refresh();
  };

  return (
    <Stack maw={420} mx="auto" mt="xl">
      <Title order={2}>{t("title")}</Title>
      <Text c="dimmed" size="sm">
        {t("description")}
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {message && <Alert color="green">{message}</Alert>}
      <Paper withBorder radius="md" p="md">
        <Stack>
          <TextInput
            label={t("emailLabel")}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
          />
          <PasswordInput
            label={t("passwordLabel")}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
          <Button loading={loading} onClick={handleAuth}>
            {mode === "sign-in" ? t("actions.signIn") : t("actions.signUp")}
          </Button>
          <Button
            variant="subtle"
            onClick={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}
          >
            {mode === "sign-in" ? t("actions.needAccount") : t("actions.haveAccount")}
          </Button>
          <Button variant="outline" color="gray" onClick={handleSignOut}>
            {t("actions.signOut")}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
