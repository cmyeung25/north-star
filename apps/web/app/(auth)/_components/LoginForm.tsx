"use client";

import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../src/lib/supabase/browser";

type LoginFormProps = {
  onSuccess: () => void;
};

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const t = useTranslations("auth.modal");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const response = await supabase.auth.signInWithPassword({ email, password });
    if (response.error) {
      setLoading(false);
      setError(t("error.invalidCredentials"));
      return;
    }

    const timeoutMs = 2000;
    const intervalMs = 100;
    const startedAt = Date.now();
    let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] = response.data.session;

    while (!session && Date.now() - startedAt < timeoutMs) {
      const { data } = await supabase.auth.getSession();
      session = data.session;

      if (!session) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}
      <TextInput
        label={t("email")}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
        required
      />
      <PasswordInput
        label={t("password")}
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        required
      />
      <Button fullWidth loading={loading} onClick={handleSubmit}>
        {t("login.cta")}
      </Button>
    </Stack>
  );
}
