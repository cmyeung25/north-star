"use client";

import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../src/lib/supabase/browser";

type RegisterFormProps = {
  onRegistered: () => void;
};

export default function RegisterForm({ onRegistered }: RegisterFormProps) {
  const t = useTranslations("auth.modal");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError(t("error.passwordMismatch"));
      return;
    }

    setLoading(true);
    const response = await supabase.auth.signUp({ email, password });

    if (response.error) {
      setLoading(false);
      setError(response.error.message);
      return;
    }

    setLoading(false);
    onRegistered();
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
      <PasswordInput
        label={t("confirmPassword")}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        required
      />
      <Button fullWidth loading={loading} onClick={handleSubmit}>
        {t("register.cta")}
      </Button>
    </Stack>
  );
}
