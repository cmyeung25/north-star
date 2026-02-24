"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ScenarioSummary } from "@north-star/adapters";
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  createScenarioAction,
  deleteScenarioAction,
  duplicateScenarioAction,
  renameScenarioAction,
} from "../../../../../../../(member)/member/cases/actions";
import { scenarioDashboardPath } from "../../../../../../../../lib/routes/appRoutes";
import { updateScenarioAssumptionsAction } from "./actions";

type Props = {
  caseId: string;
  activeScenarioId: string;
  scenarios: ScenarioSummary[];
  assumptionDefaults: {
    inflationRate: number;
    salaryGrowthRate: number;
    propertyAppreciationPct: number;
  };
};

export default function ScenarioSettingsClient({
  caseId,
  activeScenarioId,
  scenarios,
  assumptionDefaults,
}: Props) {
  const router = useRouter();
  const t = useTranslations("assumptions");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renameTitleById, setRenameTitleById] = useState<Record<string, string>>({});
  const [inflationRate, setInflationRate] = useState<number | string>(assumptionDefaults.inflationRate);
  const [salaryGrowthRate, setSalaryGrowthRate] = useState<number | string>(assumptionDefaults.salaryGrowthRate);
  const [propertyAppreciationPct, setPropertyAppreciationPct] = useState<number | string>(
    assumptionDefaults.propertyAppreciationPct,
  );

  useEffect(() => {
    setInflationRate(assumptionDefaults.inflationRate);
    setSalaryGrowthRate(assumptionDefaults.salaryGrowthRate);
    setPropertyAppreciationPct(assumptionDefaults.propertyAppreciationPct);
  }, [assumptionDefaults]);

  const submit = (task: () => Promise<unknown>, onDone?: () => void) => {
    setError(null);
    startTransition(() => {
      task()
        .then(() => {
          onDone?.();
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Action failed."));
    });
  };

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}

      <Stack gap="xs">
        <Title order={4}>{t("settingsScenarioAssumptionsTitle")}</Title>
        <Text c="dimmed" size="sm">
          {t("settingsScenarioAssumptionsHint")}
        </Text>
        <Group align="end">
          <NumberInput
            label={t("inflationRate")}
            value={inflationRate}
            onChange={setInflationRate}
            min={-50}
            max={50}
            step={0.1}
            w={180}
          />
          <NumberInput
            label={t("salaryGrowth")}
            value={salaryGrowthRate}
            onChange={setSalaryGrowthRate}
            min={-50}
            max={50}
            step={0.1}
            w={180}
          />
          <NumberInput
            label={t("propertyAppreciation")}
            value={propertyAppreciationPct}
            onChange={setPropertyAppreciationPct}
            min={-50}
            max={50}
            step={0.1}
            w={180}
          />
          <Button
            loading={isPending}
            onClick={() =>
              submit(() =>
                updateScenarioAssumptionsAction({
                  caseId,
                  scenarioId: activeScenarioId,
                  assumptions: {
                    inflationRate: Number(inflationRate ?? 0),
                    salaryGrowthRate: Number(salaryGrowthRate ?? 0),
                    propertyAppreciationPct: Number(propertyAppreciationPct ?? 0),
                  },
                }),
              )
            }
          >
            {t("settingsSaveAssumptions")}
          </Button>
        </Group>
      </Stack>

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
