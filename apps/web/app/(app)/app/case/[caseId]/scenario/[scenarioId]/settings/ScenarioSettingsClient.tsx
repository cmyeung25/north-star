"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { ScenarioSummary } from "@north-star/adapters";
import { Alert, Accordion, Button, Divider, Group, NumberInput, Stack, Table, Text, TextInput, Tooltip } from "@mantine/core";
import { useTranslations } from "next-intl";
import {
  scenarioAssumptionConstraints,
  scenarioAssumptionSchema,
} from "../../../../../../../../src/domain/scenarioAssumptions";
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
  caseTitle: string;
  activeScenarioId: string;
  scenarios: ScenarioSummary[];
  assumptions: ScenarioAssumptionsDto;
};

const dirtyCheckFields: Array<keyof ScenarioAssumptionsDto> = [
  "inflationRate",
  "salaryGrowthRate",
  "investmentReturnPct",
  "rentAnnualGrowthPct",
  "propertyAppreciationPct",
  "cashYieldPct",
  "carDepreciationRatePct",
  "emergencyFundMonths",
];

const shortId = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export default function ScenarioSettingsClient({ caseId, caseTitle, activeScenarioId, scenarios, assumptions }: Props) {
  const t = useTranslations("scenarioSettings");
  const validation = useTranslations("validation");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renameTitleById, setRenameTitleById] = useState<Record<string, string>>({});
  const [assumptionValues, setAssumptionValues] = useState<ScenarioAssumptionsDto>(assumptions);
  const [savedAssumptions, setSavedAssumptions] = useState<ScenarioAssumptionsDto>(assumptions);
  const [assumptionErrors, setAssumptionErrors] = useState<Partial<Record<keyof ScenarioAssumptionsDto, string>>>({});
  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId);
  const hasUnsavedChanges = useMemo(
    () => dirtyCheckFields.some((field) => assumptionValues[field] !== savedAssumptions[field]),
    [assumptionValues, savedAssumptions],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const message = t("unsavedChangesConfirm");
    const onAnchorClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", onAnchorClick, true);
    return () => document.removeEventListener("click", onAnchorClick, true);
  }, [hasUnsavedChanges, t]);

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

  const submitAssumptions = () => {
    const result = scenarioAssumptionSchema.safeParse({
      inflationRate: assumptionValues.inflationRate,
      salaryGrowthRate: assumptionValues.salaryGrowthRate,
      rentAnnualGrowthPct: assumptionValues.rentAnnualGrowthPct,
      propertyAppreciationPct: assumptionValues.propertyAppreciationPct,
      cashYieldPct: assumptionValues.cashYieldPct,
      carDepreciationRatePct: assumptionValues.carDepreciationRatePct,
      emergencyFundMonths: assumptionValues.emergencyFundMonths,
    });

    if (!result.success) {
      const issues = new Map(result.error.issues.map((issue) => [issue.path[0], issue.message]));
      setAssumptionErrors({
        inflationRate: typeof issues.get("inflationRate") === "string" ? validation(issues.get("inflationRate") as string) : "",
        salaryGrowthRate:
          typeof issues.get("salaryGrowthRate") === "string" ? validation(issues.get("salaryGrowthRate") as string) : "",
        rentAnnualGrowthPct:
          typeof issues.get("rentAnnualGrowthPct") === "string"
            ? validation(issues.get("rentAnnualGrowthPct") as string)
            : "",
        propertyAppreciationPct:
          typeof issues.get("propertyAppreciationPct") === "string"
            ? validation(issues.get("propertyAppreciationPct") as string)
            : "",
        cashYieldPct: typeof issues.get("cashYieldPct") === "string" ? validation(issues.get("cashYieldPct") as string) : "",
        carDepreciationRatePct:
          typeof issues.get("carDepreciationRatePct") === "string"
            ? validation(issues.get("carDepreciationRatePct") as string)
            : "",
        emergencyFundMonths:
          typeof issues.get("emergencyFundMonths") === "string"
            ? validation(issues.get("emergencyFundMonths") as string)
            : "",
      });
      return;
    }

    setAssumptionErrors({});
    submit(
      () =>
        updateScenarioAssumptionsAction({
          caseId,
          scenarioId: activeScenarioId,
          assumptions: assumptionValues,
        }),
      () => {
        setSavedAssumptions(assumptionValues);
        setSuccess(t("assumptions.updated"));
      },
    );
  };

  const withTooltip = (label: string, tooltip: string) => (
    <Group gap={4} align="center">
      <Text component="span">{label}</Text>
      <Tooltip label={tooltip} withArrow>
        <Text component="span" c="dimmed" style={{ cursor: "help" }}>
          ⓘ
        </Text>
      </Tooltip>
    </Group>
  );

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}
      {success ? <Alert color="green">{success}</Alert> : null}
      <Text size="sm" c="dimmed">
        {caseTitle} ({shortId(caseId)}) / {activeScenario?.title ?? "-"} ({shortId(activeScenarioId)})
      </Text>

      <Stack gap="xs">
        <Divider label={t("assumptions.title")} labelPosition="left" />
        <Group grow align="flex-start">
          <NumberInput
            label={withTooltip(t("assumptions.inflationRate.label"), t("assumptions.percentTooltip"))}
            value={assumptionValues.inflationRate}
            decimalScale={2}
            min={scenarioAssumptionConstraints.inflationRate.min}
            max={scenarioAssumptionConstraints.inflationRate.max}
            step={scenarioAssumptionConstraints.inflationRate.step}
            error={assumptionErrors.inflationRate}
            onChange={(value) =>
              setAssumptionValues((prev) => ({
                ...prev,
                inflationRate: typeof value === "number" ? value : prev.inflationRate,
              }))
            }
          />
          <NumberInput
            label={withTooltip(t("assumptions.salaryGrowthRate.label"), t("assumptions.percentTooltip"))}
            value={assumptionValues.salaryGrowthRate}
            decimalScale={2}
            min={scenarioAssumptionConstraints.salaryGrowthRate.min}
            max={scenarioAssumptionConstraints.salaryGrowthRate.max}
            step={scenarioAssumptionConstraints.salaryGrowthRate.step}
            error={assumptionErrors.salaryGrowthRate}
            onChange={(value) =>
              setAssumptionValues((prev) => ({
                ...prev,
                salaryGrowthRate: typeof value === "number" ? value : prev.salaryGrowthRate,
              }))
            }
          />
          <NumberInput
            label={withTooltip(t("assumptions.investmentReturnPct.label"), t("assumptions.percentTooltip"))}
            value={assumptionValues.investmentReturnPct}
            decimalScale={2}
            min={scenarioAssumptionConstraints.investmentReturnPct.min}
            max={scenarioAssumptionConstraints.investmentReturnPct.max}
            step={scenarioAssumptionConstraints.investmentReturnPct.step}
            onChange={(value) =>
              setAssumptionValues((prev) => ({
                ...prev,
                investmentReturnPct: typeof value === "number" ? value : prev.investmentReturnPct,
              }))
            }
          />
        </Group>
        <Accordion variant="contained" radius="md" defaultValue={null}>
          <Accordion.Item value="advanced-assumptions">
            <Accordion.Control>{t("assumptions.advancedTitle")}</Accordion.Control>
            <Accordion.Panel>
              <Stack>
                <Group grow align="flex-start">
                  <NumberInput
                    label={withTooltip(t("assumptions.rentAnnualGrowthPct.label"), t("assumptions.percentTooltip"))}
                    value={assumptionValues.rentAnnualGrowthPct}
                    decimalScale={2}
                    min={scenarioAssumptionConstraints.rentAnnualGrowthPct.min}
                    max={scenarioAssumptionConstraints.rentAnnualGrowthPct.max}
                    step={scenarioAssumptionConstraints.rentAnnualGrowthPct.step}
                    error={assumptionErrors.rentAnnualGrowthPct}
                    onChange={(value) =>
                      setAssumptionValues((prev) => ({
                        ...prev,
                        rentAnnualGrowthPct: typeof value === "number" ? value : prev.rentAnnualGrowthPct,
                      }))
                    }
                  />
                  <NumberInput
                    label={withTooltip(t("assumptions.propertyAppreciationPct.label"), t("assumptions.percentTooltip"))}
                    value={assumptionValues.propertyAppreciationPct}
                    decimalScale={2}
                    min={scenarioAssumptionConstraints.propertyAppreciationPct.min}
                    max={scenarioAssumptionConstraints.propertyAppreciationPct.max}
                    step={scenarioAssumptionConstraints.propertyAppreciationPct.step}
                    error={assumptionErrors.propertyAppreciationPct}
                    onChange={(value) =>
                      setAssumptionValues((prev) => ({
                        ...prev,
                        propertyAppreciationPct:
                          typeof value === "number" ? value : prev.propertyAppreciationPct,
                      }))
                    }
                  />
                </Group>
                <Group grow align="flex-start">
                  <NumberInput
                    label={withTooltip(t("assumptions.cashYieldPct.label"), t("assumptions.percentTooltip"))}
                    value={assumptionValues.cashYieldPct}
                    decimalScale={2}
                    min={scenarioAssumptionConstraints.cashYieldPct.min}
                    max={scenarioAssumptionConstraints.cashYieldPct.max}
                    step={scenarioAssumptionConstraints.cashYieldPct.step}
                    error={assumptionErrors.cashYieldPct}
                    onChange={(value) =>
                      setAssumptionValues((prev) => ({
                        ...prev,
                        cashYieldPct: typeof value === "number" ? value : prev.cashYieldPct,
                      }))
                    }
                  />
                  <NumberInput
                    label={withTooltip(t("assumptions.carDepreciationRatePct.label"), t("assumptions.percentTooltip"))}
                    value={assumptionValues.carDepreciationRatePct}
                    decimalScale={2}
                    min={scenarioAssumptionConstraints.carDepreciationRatePct.min}
                    max={scenarioAssumptionConstraints.carDepreciationRatePct.max}
                    step={scenarioAssumptionConstraints.carDepreciationRatePct.step}
                    error={assumptionErrors.carDepreciationRatePct}
                    onChange={(value) =>
                      setAssumptionValues((prev) => ({
                        ...prev,
                        carDepreciationRatePct:
                          typeof value === "number" ? value : prev.carDepreciationRatePct,
                      }))
                    }
                  />
                  <NumberInput
                    label={withTooltip(t("assumptions.emergencyFundMonths.label"), t("assumptions.monthsTooltip"))}
                    value={assumptionValues.emergencyFundMonths}
                    min={scenarioAssumptionConstraints.emergencyFundMonths.min}
                    max={scenarioAssumptionConstraints.emergencyFundMonths.max}
                    step={scenarioAssumptionConstraints.emergencyFundMonths.step}
                    error={assumptionErrors.emergencyFundMonths}
                    onChange={(value) =>
                      setAssumptionValues((prev) => ({
                        ...prev,
                        emergencyFundMonths: typeof value === "number" ? value : prev.emergencyFundMonths,
                      }))
                    }
                  />
                </Group>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
        <Group justify="flex-end" gap="xs">
          <Text size="sm" c="dimmed">
            {t("assumptions.scopeNote")}
          </Text>
          <Button loading={isPending} onClick={submitAssumptions}>
            {t("assumptions.save")}
          </Button>
        </Group>
      </Stack>

      <Divider />

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
