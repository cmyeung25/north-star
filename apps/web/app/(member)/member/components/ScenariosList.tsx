"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ScenarioSummary } from "@north-star/adapters";
import { Alert, Button, Card, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { buildAppScenarioUrl } from "../../../../lib/routes";
import { scenarioOnboardingPath } from "../../../../lib/routes/appRoutes";
import { formatIsoYmdHms } from "../../../../lib/date/format";
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

const formatDate = (value: string) => formatIsoYmdHms(value);

function markLastOpened(caseId: string, scenarioId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("aurin:lastOpened", JSON.stringify({ caseId, scenarioId }));
}

function OpenScenarioButtons({ caseId, scenarioId }: { caseId: string; scenarioId: string }) {
  const t = useTranslations("member.list");
  const href = buildAppScenarioUrl({ caseId, scenarioId });

  return (
    <Group gap="xs">
      <Button
        component={Link}
        href={href}
        size="xs"
        onClick={() => {
          markLastOpened(caseId, scenarioId);
        }}
      >
        {t("openApp")}
      </Button>
      <Button
        size="xs"
        variant="default"
        onClick={() => {
          markLastOpened(caseId, scenarioId);
          window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        {t("openInNewWindow")}
      </Button>
    </Group>
  );
}

export function ScenariosList({ caseId, scenarios }: { caseId: string; scenarios: ScenarioSummary[] }) {
  const t = useTranslations("member.list");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [duplicateTarget, setDuplicateTarget] = useState<ScenarioSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScenarioSummary | null>(null);

  const submit = <T,>(fn: () => Promise<T>, onDone?: (result: T) => void) => {
    setError(null);
    startTransition(() => {
      fn()
        .then((result) => {
          onDone?.(result);
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : t("actionFailed")));
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed">{t("scenariosDescription")}</Text>
        <Button onClick={() => setCreateOpen(true)}>{t("createScenario")}</Button>
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}

      <Table withTableBorder striped visibleFrom="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("columns.title")}</Table.Th>
            <Table.Th>{t("columns.updated")}</Table.Th>
            <Table.Th>{t("columns.revision")}</Table.Th>
            <Table.Th>{t("columns.actions")}</Table.Th>
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
                  <OpenScenarioButtons caseId={caseId} scenarioId={scenario.id} />
                  <Button size="xs" variant="default" onClick={() => setDuplicateTarget(scenario)}>
                    {t("duplicate")}
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => setDeleteTarget(scenario)}
                  >
                    {t("delete")}
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
                {t("updatedAt", { value: formatDate(scenario.updatedAt) })}
              </Text>
              <Text size="sm" c="dimmed">
                {t("revisionValue", { value: scenario.revision })}
              </Text>
              <Group>
                <OpenScenarioButtons caseId={caseId} scenarioId={scenario.id} />
                <Button size="xs" variant="default" onClick={() => setDuplicateTarget(scenario)}>
                  {t("duplicate")}
                </Button>
                <Button size="xs" color="red" variant="light" onClick={() => setDeleteTarget(scenario)}>
                  {t("delete")}
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
            ({ scenarioId }) => {
              setCreateOpen(false);
              setCreateTitle("");
              router.push(scenarioOnboardingPath(caseId, scenarioId));
            },
          )
        }
      />

      <DuplicateScenarioDialog
        opened={Boolean(duplicateTarget)}
        title={duplicateTarget ? t("copyTitleValue", { title: duplicateTarget.title }) : ""}
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
