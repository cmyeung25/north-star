"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CaseSummary } from "@north-star/adapters";
import { ActionIcon, Alert, Button, Card, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { createCaseAction, deleteCaseAction, renameCaseAction } from "../cases/actions";
import { formatIsoYmdHms } from "../../../../lib/date/format";
import { memberCaseEnterPath, scenarioOnboardingPath } from "../../../../lib/routes/appRoutes";
import { CreateCaseDialog, DeleteCaseDialog, RenameCaseDialog } from "./CaseDialogs";

const formatDate = (value: string) => formatIsoYmdHms(value);

export function CasesList({ cases }: { cases: CaseSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [currency, setCurrency] = useState("HKD");
  const [renameTarget, setRenameTarget] = useState<CaseSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CaseSummary | null>(null);

  const submit = <T,>(fn: () => Promise<T>, onDone?: (result: T) => void) => {
    setError(null);
    startTransition(() => {
      fn()
        .then((result) => {
          onDone?.(result);
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Action failed."));
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed">Manage your cases and jump into planning in one click.</Text>
        <Button onClick={() => setCreateOpen(true)}>Create case</Button>
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}

      <Table withTableBorder striped visibleFrom="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Updated</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cases.map((entry) => (
            <Table.Tr key={entry.id}>
              <Table.Td>
                {entry.title}
              </Table.Td>
              <Table.Td>{formatDate(entry.updatedAt)}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button
                    variant="light"
                    size="xs"
                    component={Link}
                    href={memberCaseEnterPath(entry.id)}
                  >
                    進入計劃
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => {
                      setRenameTarget(entry);
                      setRenameTitle(entry.title);
                    }}
                  >
                    ✏️
                  </ActionIcon>
                  <ActionIcon color="red" variant="subtle" onClick={() => setDeleteTarget(entry)}>
                    🗑️
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <SimpleGrid cols={{ base: 1, sm: 2 }} hiddenFrom="sm">
        {cases.map((entry) => (
          <Card key={entry.id} withBorder>
            <Stack gap="xs">
              <Text fw={600}>{entry.title}</Text>
              <Text size="sm" c="dimmed">
                Updated {formatDate(entry.updatedAt)}
              </Text>
              <Group>
                <Button
                  size="xs"
                  component={Link}
                  href={memberCaseEnterPath(entry.id)}
                >
                  進入計劃
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => {
                    setRenameTarget(entry);
                    setRenameTitle(entry.title);
                  }}
                >
                  Rename
                </Button>
                <Button color="red" variant="light" size="xs" onClick={() => setDeleteTarget(entry)}>
                  Delete
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <CreateCaseDialog
        opened={createOpen}
        title={newTitle}
        currency={currency}
        loading={isPending}
        onClose={() => setCreateOpen(false)}
        onTitleChange={setNewTitle}
        onCurrencyChange={setCurrency}
        onSubmit={() =>
          submit(
            () => createCaseAction({ title: newTitle, currency }),
            ({ caseId, scenarioId }) => {
              setCreateOpen(false);
              setNewTitle("");
              setCurrency("HKD");
              router.push(scenarioOnboardingPath(caseId, scenarioId));
            },
          )
        }
      />

      <RenameCaseDialog
        opened={Boolean(renameTarget)}
        title={renameTitle}
        loading={isPending}
        onClose={() => setRenameTarget(null)}
        onTitleChange={setRenameTitle}
        onSubmit={() =>
          renameTarget
            ? submit(() => renameCaseAction({ caseId: renameTarget.id, title: renameTitle }), () => setRenameTarget(null))
            : undefined
        }
      />

      <DeleteCaseDialog
        opened={Boolean(deleteTarget)}
        loading={isPending}
        onClose={() => setDeleteTarget(null)}
        onSubmit={() =>
          deleteTarget
            ? submit(() => deleteCaseAction({ caseId: deleteTarget.id }), () => setDeleteTarget(null))
            : undefined
        }
      />
    </Stack>
  );
}
