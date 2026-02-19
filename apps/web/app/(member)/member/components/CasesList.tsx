"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CaseSummary } from "@north-star/adapters";
import { ActionIcon, Alert, Button, Group, Menu, Paper, Stack, Table, Text, ThemeIcon } from "@mantine/core";
import { createCaseAction, deleteCaseAction, duplicateCaseAction, renameCaseAction } from "../cases/actions";
import { formatIsoYmdHms } from "../../../../lib/date/format";
import { memberCaseEnterPath, scenarioOnboardingPath } from "../../../../lib/routes/appRoutes";
import { CreateCaseDialog, DeleteCaseDialog, RenameCaseDialog } from "./CaseDialogs";

const formatDate = (value: string) => formatIsoYmdHms(value);

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Paper p="xl">
      <Stack align="center" gap="sm">
        <ThemeIcon size={44} radius="xl" variant="light" color="polar">
          <Text>📁</Text>
        </ThemeIcon>
        <Text fw={600}>尚未建立任何案例</Text>
        <Text c="dimmed" ta="center" maw={380}>
          建立第一個案例後，你可以快速進入規劃，並在後續管理情境與設定。
        </Text>
        <Button onClick={onCreate}>
          建立案例
        </Button>
      </Stack>
    </Paper>
  );
}

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
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Text fw={600}>Cases</Text>
          <Text c="dimmed" size="sm">
            Case 與帳務管理入口。深入操作請進入規劃。
          </Text>
        </div>
        <Button onClick={() => setCreateOpen(true)}>建立案例</Button>
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}

      {cases.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <Paper p={0}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>標題</Table.Th>
                <Table.Th>更新時間</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cases.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.title}</Table.Td>
                  <Table.Td>{formatDate(entry.updatedAt)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button variant="light" color="gray" size="xs" component={Link} href={memberCaseEnterPath(entry.id)}>
                        進入規劃
                      </Button>
                      <Menu withinPortal position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" aria-label="更多操作">
                            ⋯
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            onClick={() => {
                              setRenameTarget(entry);
                              setRenameTitle(entry.title);
                            }}
                          >
                            Rename
                          </Menu.Item>
                          <Menu.Item
                            onClick={() => submit(() => duplicateCaseAction({ caseId: entry.id }))}
                          >
                            Duplicate
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" onClick={() => setDeleteTarget(entry)}>
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

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
