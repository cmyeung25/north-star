"use client";

import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../src/lib/supabase/browser";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const response =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    if (mode === "sign-up") {
      setMessage("Sign-up succeeded. Check your inbox if email confirmation is enabled.");
      return;
    }

    const callbackUrl = searchParams.get("callbackUrl");
    const destination = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/member/cases";

    router.push(destination);
    router.refresh();
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    await supabase.auth.signOut();
    setLoading(false);
    setMessage("Signed out.");
    router.refresh();
  };

  return (
    <Stack maw={420} mx="auto" mt="xl">
      <Title order={2}>Supabase Account</Title>
      <Text c="dimmed" size="sm">
        Email/password sign-in for Supabase smoke testing.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {message && <Alert color="green">{message}</Alert>}
      <Paper withBorder radius="md" p="md">
        <Stack>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
          <Button loading={loading} onClick={handleAuth}>
            {mode === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
          <Button
            variant="subtle"
            onClick={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}
          >
            {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </Button>
          <Button variant="outline" color="gray" onClick={handleSignOut}>
            Sign out
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
