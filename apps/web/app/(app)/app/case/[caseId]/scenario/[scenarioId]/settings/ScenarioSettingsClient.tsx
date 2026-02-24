"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ScenarioSummary } from "@north-star/adapters";
import { Alert, Button, Divider, Group, NumberInput, Stack, Table, TextInput } from "@mantine/core";
import {
  createScenarioAction,
  deleteScenarioAction,
  duplicateScenarioAction,
  renameScenarioAction,
} from "../../../../../../../(member)/member/cases/actions";
import { scenarioDashboardPath } from "../../../../../../../../lib/routes/appRoutes";
import { type ScenarioAssumptionsDto, updateScenarioAssumptionsAction } from "./actions";

type Props = {
  caseId: string;
  activeScenarioId: string;
  scenarios: ScenarioSummary[];
  assumptions: ScenarioAssumptionsDto;
};

export default function ScenarioSettingsClient({ caseId, activeScenarioId, scenarios, assumptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renameTitleById, setRenameTitleById] = useState<Record<string, string>>({});
  const [assumptionValues, setAssumptionValues] = useState<ScenarioAssumptionsDto>(assumptions);

  const submit = (task: () => Promise<unknown>, onDone?: () => void) => {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      task()
        .then(() => {
          onDone?.();
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Action failed."));
    });
  };

  const submitAssumptions = () => {
    submit(
      () =>
        updateScenarioAssumptionsAction({
          caseId,
          scenarioId: activeScenarioId,
          assumptions: assumptionValues,
        }),
      () => {
        setSuccess("假設已更新。");
      },
    );
  };

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}
      {success ? <Alert color="green">{success}</Alert> : null}

      <Stack gap="xs">
        <Divider label="Scenario assumptions" labelPosition="left" />
        <Group grow align="flex-start">
          <NumberInput
            label="Inflation rate (%)"
            value={assumptionValues.inflationRate}
            decimalScale={2}
            onChange={(value) =>
              setAssumptionValues((prev) => ({
                ...prev,
                inflationRate: typeof value === "number" ? value : prev.inflationRate,
              }))
            }
          />
          <NumberInput
            label="Salary growth rate (%)"
            value={assumptionValues.salaryGrowthRate}
            decimalScale={2}
            onChange={(value) =>
              setAssumptionValues((prev) => ({
                ...prev,
                salaryGrowthRate: typeof value === "number" ? value : prev.salaryGrowthRate,
              }))
            }
          />
          <NumberInput
            label="Investment return (%)"
            value={assumptionValues.investmentReturnPct}
            decimalScale={2}
            onChange={(value) =>
              setAssumptionValues((prev) => ({
                ...prev,
                investmentReturnPct: typeof value === "number" ? value : prev.investmentReturnPct,
              }))
            }
          />
        </Group>
        <Group justify="flex-end">
          <Button loading={isPending} onClick={submitAssumptions}>
            儲存假設
          </Button>
        </Group>
      </Stack>

      <Divider />

      <Group>
        <TextInput
          placeholder="New scenario name"
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
              },
            )
          }
        >
          新增情景
        </Button>
      </Group>

      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Actions</Table.Th>
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
                      開啟
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
                      改名
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={isPending}
                      onClick={() => submit(() => duplicateScenarioAction({ caseId, scenarioId: scenario.id }))}
                    >
                      複製
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      loading={isPending}
                      disabled={scenarios.length <= 1}
                      onClick={() => submit(() => deleteScenarioAction({ caseId, scenarioId: scenario.id }))}
                    >
                      刪除
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
