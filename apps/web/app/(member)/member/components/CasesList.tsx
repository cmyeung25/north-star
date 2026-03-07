"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import type { CaseSummary } from "@north-star/adapters";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Menu,
  Paper,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  createCaseAction,
  deleteCaseAction,
  duplicateCaseAction,
  renameCaseAction,
} from "../cases/actions";
import { formatIsoYmdHms } from "../../../../lib/date/format";
import { caseEnterPath, scenarioOnboardingPath } from "../../../../lib/routes/canonicalRoutes";
import { CreateCaseDialog, DeleteCaseDialog, RenameCaseDialog } from "./CaseDialogs";
import { RouteLoadingOverlay } from "../../../../src/components/loading/route-loading-overlay";
import type { Locale } from "../../../../src/i18n/routing";
import {
  getScenarioSeeds,
  type ScenarioSeedTranslator,
} from "../../../../src/scenarios/scenarioSeeds";
import { getDraftStorageKey } from "../../../../src/features/onboarding/draftStorage";
import {
  buildOnboardingDraftStateFromSeed,
  MEMBER_CASE_PRESET_SEED_IDS,
} from "../../../../src/features/onboarding/seedPrefill";

const formatDate = (value: string) => formatIsoYmdHms(value);

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("member.list");

  return (
    <Paper p="xl">
      <Stack align="center" gap="sm">
        <ThemeIcon size={44} radius="xl" variant="light" color="polar">
          <Text>??</Text>
        </ThemeIcon>
        <Text fw={600}>{t("emptyTitle")}</Text>
        <Text c="dimmed" ta="center" maw={380}>
          {t("emptyDescription")}
        </Text>
        <Button onClick={onCreate}>{t("createCase")}</Button>
      </Stack>
    </Paper>
  );
}

const presetSeedIdSet = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

export function CasesList({ cases }: { cases: CaseSummary[] }) {
  const t = useTranslations("member.list");
  const tMessages = useTranslations();
  const loadingT = useTranslations("loading");
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [currency, setCurrency] = useState("HKD");
  const [createStartMode, setCreateStartMode] = useState<"blank" | "preset">("blank");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<CaseSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CaseSummary | null>(null);
  const [openingCase, setOpeningCase] = useState<CaseSummary | null>(null);

  const presetSeeds = useMemo(
    () =>
      getScenarioSeeds(tMessages as unknown as ScenarioSeedTranslator).filter((seed) =>
        presetSeedIdSet.has(seed.id)
      ),
    [tMessages]
  );

  const selectedPreset = useMemo(
    () => presetSeeds.find((seed) => seed.id === selectedPresetId) ?? null,
    [presetSeeds, selectedPresetId]
  );

  const resetCreateDialog = () => {
    setCreateOpen(false);
    setNewTitle("");
    setCurrency("HKD");
    setCreateStartMode("blank");
    setSelectedPresetId(null);
  };

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

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presetSeeds.find((seed) => seed.id === presetId);
    if (preset && newTitle.trim().length === 0) {
      setNewTitle(preset.title);
    }
  };

  return (
    <Stack gap="md">
      <RouteLoadingOverlay
        opened={Boolean(openingCase)}
        title={loadingT("openingCase", { title: openingCase?.title ?? "" })}
        description={loadingT("loadingPlanningData")}
      />
      <Group justify="space-between" align="end">
        <div>
          <Text fw={600}>{t("heading")}</Text>
          <Text c="dimmed" size="sm">
            {t("subheading")}
          </Text>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t("createCase")}</Button>
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}

      {cases.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <Paper p={0}>
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("columns.title")}</Table.Th>
                  <Table.Th>{t("columns.updated")}</Table.Th>
                  <Table.Th>{t("columns.actions")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cases.map((entry) => (
                  <Table.Tr key={entry.id}>
                    <Table.Td>{entry.title}</Table.Td>
                    <Table.Td>{formatDate(entry.updatedAt)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          variant="light"
                          color="gray"
                          size="xs"
                          disabled={isPending || Boolean(openingCase)}
                          onClick={() => {
                            setError(null);
                            setOpeningCase(entry);
                            window.requestAnimationFrame(() => {
                              try {
                                router.push(caseEnterPath(entry.id, locale as Locale));
                              } catch (reason) {
                                setOpeningCase(null);
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : t("actionFailed"),
                                );
                              }
                            });
                          }}
                        >
                          {t("openPlanning")}
                        </Button>
                        <Menu withinPortal position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label={t("moreActionsAriaLabel")}>
                              ??
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              onClick={() => {
                                setRenameTarget(entry);
                                setRenameTitle(entry.title);
                              }}
                            >
                              {t("rename")}
                            </Menu.Item>
                            <Menu.Item
                              onClick={() =>
                                submit(() => duplicateCaseAction({ caseId: entry.id }))
                              }
                            >
                              {t("duplicate")}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item color="red" onClick={() => setDeleteTarget(entry)}>
                              {t("delete")}
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      <CreateCaseDialog
        opened={createOpen}
        title={newTitle}
        currency={currency}
        loading={isPending}
        startMode={createStartMode}
        selectedPresetId={selectedPresetId}
        presets={presetSeeds.map((seed) => ({
          id: seed.id,
          title: seed.title,
          description: seed.description,
          tags: seed.tags,
          keyNumbers: seed.keyNumbers,
        }))}
        onClose={resetCreateDialog}
        onTitleChange={setNewTitle}
        onCurrencyChange={setCurrency}
        onStartModeChange={(value) => {
          setCreateStartMode(value);
          if (value === "blank") {
            setSelectedPresetId(null);
          }
        }}
        onPresetChange={handleSelectPreset}
        onSubmit={() =>
          submit(
            () => createCaseAction({ title: newTitle, currency }),
            ({ caseId, scenarioId }) => {
              if (createStartMode === "preset" && selectedPreset) {
                const draftState = buildOnboardingDraftStateFromSeed(selectedPreset.payload);
                window.localStorage.setItem(
                  getDraftStorageKey(scenarioId),
                  JSON.stringify(draftState)
                );
              }
              resetCreateDialog();
              router.push(scenarioOnboardingPath(caseId, scenarioId, locale as Locale));
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
            ? submit(
                () => renameCaseAction({ caseId: renameTarget.id, title: renameTitle }),
                () => setRenameTarget(null),
              )
            : undefined
        }
      />

      <DeleteCaseDialog
        opened={Boolean(deleteTarget)}
        loading={isPending}
        onClose={() => setDeleteTarget(null)}
        onSubmit={() =>
          deleteTarget
            ? submit(
                () => deleteCaseAction({ caseId: deleteTarget.id }),
                () => setDeleteTarget(null),
              )
            : undefined
        }
      />
    </Stack>
  );
}