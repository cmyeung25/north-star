"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ScenarioSummary } from "@north-star/adapters";
import { Alert, Button, Group, Stack, Table, Text, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import {
  createScenarioAction,
  deleteScenarioAction,
  duplicateScenarioAction,
  renameScenarioAction,
} from "../../../../../../../(member)/member/cases/actions";
import { scenarioDashboardPath } from "../../../../../../../../lib/routes/appRoutes";

type Props = {
  caseId: string;
  caseTitle: string;
  activeScenarioId: string;
  scenarios: ScenarioSummary[];
};

const shortId = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export default function ScenarioSettingsClient({ caseId, caseTitle, activeScenarioId, scenarios }: Props) {
  const t = useTranslations("scenarioSettings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renameTitleById, setRenameTitleById] = useState<Record<string, string>>({});
  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId);

  const submit = (task: () => Promise<unknown>, onDone?: () => void) => {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      task()
        .then(() => {
          onDone?.();
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : t("actionFailed")));
    });
  };

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}
      {success ? <Alert color="green">{success}</Alert> : null}
      <Text size="sm" c="dimmed">
        {caseTitle} ({shortId(caseId)}) / {activeScenario?.title ?? "-"} ({shortId(activeScenarioId)})
      </Text>

      <Group>
        <TextInput
          placeholder={t("newScenario.placeholder")}
          value={newTitle}
          onChange={(event) => setNewTitle(event.currentTarget.value)}
        />
        <Button
          loading={isPending}
          onClick={() =>
            submit(
              () => createScenarioAction({ caseId, title: newTitle }),
              () => {
                setNewTitle("");
                setSuccess(t("newScenario.create"));
              },
            )
          }
        >
          {t("newScenario.create")}
        </Button>
      </Group>

      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("table.title")}</Table.Th>
            <Table.Th>{t("table.actions")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {scenarios.map((scenario) => {
            const renameTitle = renameTitleById[scenario.id] ?? scenario.title;
            return (
              <Table.Tr key={scenario.id}>
                <Table.Td>
                  <TextInput
                    value={renameTitle}
                    onChange={(event) =>
                      setRenameTitleById((prev) => ({
                        ...prev,
                        [scenario.id]: event.currentTarget.value,
                      }))
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Group>
                    <Button
                      size="xs"
                      variant={scenario.id === activeScenarioId ? "filled" : "default"}
                      onClick={() => router.push(scenarioDashboardPath(caseId, scenario.id))}
                    >
                      {t("table.open")}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={isPending}
                      onClick={() =>
                        submit(() =>
                          renameScenarioAction({
                            caseId,
                            scenarioId: scenario.id,
                            title: renameTitle,
                          }),
                        )
                      }
                    >
                      {t("table.rename")}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={isPending}
                      onClick={() => submit(() => duplicateScenarioAction({ caseId, scenarioId: scenario.id }))}
                    >
                      {t("table.duplicate")}
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      loading={isPending}
                      disabled={scenarios.length <= 1}
                      onClick={() => submit(() => deleteScenarioAction({ caseId, scenarioId: scenario.id }))}
                    >
                      {t("table.delete")}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
