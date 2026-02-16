"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ScenarioSummary } from "@north-star/adapters";
import { Alert, Button, Card, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { buildAppScenarioUrl } from "../../../../lib/routes";
import {
  createScenarioAction,
  deleteScenarioAction,
  duplicateScenarioAction,
} from "../cases/actions";
import {
  CreateScenarioDialog,
  DeleteScenarioDialog,
  DuplicateScenarioDialog,
} from "./ScenarioDialogs";

const formatDate = (value: string) => new Date(value).toLocaleString();

function OpenScenarioButton({ caseId, scenarioId }: { caseId: string; scenarioId: string }) {
  const href = buildAppScenarioUrl({ caseId, scenarioId });
  return (
    <Button
      component={Link}
      href={href}
      size="xs"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "aurin:lastOpened",
            JSON.stringify({ caseId, scenarioId }),
          );
        }
      }}
    >
      開啟
    </Button>
  );
}

export function ScenariosList({ caseId, scenarios }: { caseId: string; scenarios: ScenarioSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [duplicateTarget, setDuplicateTarget] = useState<ScenarioSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScenarioSummary | null>(null);

  const submit = (fn: () => Promise<void>, onDone?: () => void) => {
    setError(null);
    startTransition(() => {
      fn()
        .then(() => {
          onDone?.();
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Action failed."));
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed">Create, duplicate and open scenarios in this case.</Text>
        <Button onClick={() => setCreateOpen(true)}>Create scenario</Button>
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}

      <Table withTableBorder striped visibleFrom="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Updated</Table.Th>
            <Table.Th>Revision</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {scenarios.map((scenario) => (
            <Table.Tr key={scenario.id}>
              <Table.Td>{scenario.title}</Table.Td>
              <Table.Td>{formatDate(scenario.updatedAt)}</Table.Td>
              <Table.Td>{scenario.revision}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <OpenScenarioButton caseId={caseId} scenarioId={scenario.id} />
                  <Button size="xs" variant="default" onClick={() => setDuplicateTarget(scenario)}>
                    Duplicate
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => setDeleteTarget(scenario)}
                  >
                    Delete
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <SimpleGrid cols={{ base: 1, sm: 2 }} hiddenFrom="sm">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} withBorder>
            <Stack gap="xs">
              <Text fw={600}>{scenario.title}</Text>
              <Text size="sm" c="dimmed">
                Updated {formatDate(scenario.updatedAt)}
              </Text>
              <Text size="sm" c="dimmed">
                Revision {scenario.revision}
              </Text>
              <Group>
                <OpenScenarioButton caseId={caseId} scenarioId={scenario.id} />
                <Button size="xs" variant="default" onClick={() => setDuplicateTarget(scenario)}>
                  Duplicate
                </Button>
                <Button size="xs" color="red" variant="light" onClick={() => setDeleteTarget(scenario)}>
                  Delete
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <CreateScenarioDialog
        opened={createOpen}
        title={createTitle}
        loading={isPending}
        onClose={() => setCreateOpen(false)}
        onTitleChange={setCreateTitle}
        onSubmit={() =>
          submit(
            () => createScenarioAction({ caseId, title: createTitle }),
            () => {
              setCreateOpen(false);
              setCreateTitle("");
            },
          )
        }
      />

      <DuplicateScenarioDialog
        opened={Boolean(duplicateTarget)}
        title={duplicateTarget ? `${duplicateTarget.title} (Copy)` : ""}
        loading={isPending}
        onClose={() => setDuplicateTarget(null)}
        onTitleChange={() => undefined}
        onSubmit={() =>
          duplicateTarget
            ? submit(
                () => duplicateScenarioAction({ caseId, scenarioId: duplicateTarget.id }),
                () => setDuplicateTarget(null),
              )
            : undefined
        }
      />

      <DeleteScenarioDialog
        opened={Boolean(deleteTarget)}
        loading={isPending}
        onClose={() => setDeleteTarget(null)}
        onSubmit={() =>
          deleteTarget
            ? submit(
                () => deleteScenarioAction({ caseId, scenarioId: deleteTarget.id }),
                () => setDeleteTarget(null),
              )
            : undefined
        }
      />
    </Stack>
  );
}
