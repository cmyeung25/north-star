"use client";

import { Alert, Button, Code, Group, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../../src/lib/supabase/browser";

type CaseRecord = {
  id: string;
  name: string | null;
  created_at: string;
};

export default function DebugSupabasePanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userInfo, setUserInfo] = useState<string>("Not checked");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    const session = sessionData.session;
    setUserInfo(session?.user ? `${session.user.id} (${session.user.email ?? "no-email"})` : "Not signed in");

    const { data, error: caseError } = await supabase
      .from("cases")
      .select("id,name,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (caseError) {
      setError(caseError.message);
      setLoading(false);
      return;
    }

    setCases(data ?? []);
    setLoading(false);
  };

  const createTestCase = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      setError("Please sign in first.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("cases").insert({
      name: `Test case ${new Date().toISOString()}`,
      user_id: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    await load();
  };

  return (
    <Stack>
      <Title order={2}>Supabase Debug Smoke Test</Title>
      <Text size="sm" c="dimmed">
        Use this page to verify auth session + RLS access for <Code>cases</Code>.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      <Group>
        <Button onClick={load} loading={loading}>
          Refresh Session + Cases
        </Button>
        <Button variant="outline" onClick={createTestCase} loading={loading}>
          Create test case
        </Button>
      </Group>
      <Paper withBorder p="md">
        <Text fw={600}>Current session user</Text>
        <Code>{userInfo}</Code>
      </Paper>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Created At</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cases.map((entry) => (
            <Table.Tr key={entry.id}>
              <Table.Td>{entry.id}</Table.Td>
              <Table.Td>{entry.name ?? "-"}</Table.Td>
              <Table.Td>{entry.created_at}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
