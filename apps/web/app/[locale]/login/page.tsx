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
      setMessage("Sign-up succeeded. Check your inbox if email confirmation is enabled.");
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

    const callbackUrl = searchParams.get("callbackUrl");
    const destination = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/member/cases";

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
