"use client";

import React from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import {
  JourneySummaryCard,
  buildMemberJourneySummary,
} from "../../../../src/features/member/presetJourneySummary";
import type { MemberJourneyId } from "../../../../src/features/member/createCaseEntry";

type CreateCasePresetOption = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  keyNumbers: { label: string; value: string }[];
};

type CreateCaseDialogProps = {
  opened: boolean;
  title: string;
  currency: string;
  loading?: boolean;
  startMode: "blank" | "preset";
  selectedPresetId: string | null;
  journeyId?: MemberJourneyId | null;
  presets: CreateCasePresetOption[];
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onStartModeChange: (value: "blank" | "preset") => void;
  onPresetChange: (presetId: string) => void;
  onSubmit: () => void;
};

export function CreateCaseDialog(props: CreateCaseDialogProps) {
  const t = useTranslations("member.caseDialogs");

  const journeySummary =
    props.journeyId && props.startMode === "preset"
      ? buildMemberJourneySummary(t, props.journeyId)
      : null;

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("createTitle")} centered size="lg">
      <Stack>
        <TextInput
          label={t("caseTitleLabel")}
          placeholder={t("caseTitlePlaceholder")}
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          required
        />
        <Select
          label={t("currencyLabel")}
          value={props.currency}
          onChange={(value) => props.onCurrencyChange(value ?? "HKD")}
          data={["HKD", "USD", "CNY"]}
        />
        <Stack gap="xs">
          <Text fw={600} size="sm">{t("createModeLabel")}</Text>
          <SegmentedControl
            value={props.startMode}
            onChange={(value) => props.onStartModeChange(value === "preset" ? "preset" : "blank")}
            data={[
              { label: t("createModeBlank"), value: "blank" },
              { label: t("createModePreset"), value: "preset" },
            ]}
          />
          <Text size="xs" c="dimmed">
            {props.startMode === "preset" ? t("createModeHintPreset") : t("createModeHintBlank")}
          </Text>
        </Stack>
        {props.startMode === "preset" ? (
          <Stack gap="xs">
            {journeySummary ? (
              <JourneySummaryCard title={t("journey.title")} summary={journeySummary} />
            ) : null}
            <Group justify="space-between" align="center">
              <Text fw={600} size="sm">{t("presetTitle")}</Text>
              <Text size="xs" c="dimmed">{t("presetHint")}</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {props.presets.map((preset) => {
                const selected = props.selectedPresetId === preset.id;
                return (
                  <Card
                    key={preset.id}
                    withBorder
                    radius="md"
                    padding="md"
                    style={{ borderColor: selected ? "var(--mantine-color-aurora-5)" : undefined }}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={2}>
                          <Text fw={600}>{preset.title}</Text>
                          <Text size="sm" c="dimmed">{preset.description}</Text>
                        </Stack>
                        {selected ? <Badge color="aurora">{t("presetSelected")}</Badge> : null}
                      </Group>
                      {preset.tags.length > 0 ? (
                        <Group gap={6} wrap="wrap">
                          {preset.tags.map((tag) => (
                            <Badge key={`${preset.id}-${tag}`} variant="light" color="gray">{tag}</Badge>
                          ))}
                        </Group>
                      ) : null}
                      <Stack gap={4}>
                        {preset.keyNumbers.map((item) => (
                          <Group key={`${preset.id}-${item.label}`} justify="space-between" gap="xs">
                            <Text size="xs" c="dimmed">{item.label}</Text>
                            <Text size="xs" fw={600}>{item.value}</Text>
                          </Group>
                        ))}
                      </Stack>
                      <Button
                        variant={selected ? "filled" : "light"}
                        color={selected ? "aurora" : "gray"}
                        onClick={() => props.onPresetChange(preset.id)}
                      >
                        {selected ? t("presetSelected") : t("presetApply")}
                      </Button>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button
            loading={props.loading}
            onClick={props.onSubmit}
            disabled={props.startMode === "preset" && !props.selectedPresetId}
          >
            {t("create")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type RenameCaseDialogProps = {
  opened: boolean;
  title: string;
  loading?: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

export function RenameCaseDialog(props: RenameCaseDialogProps) {
  const t = useTranslations("member.caseDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("renameTitle")} centered>
      <Stack>
        <TextInput
          label={t("caseTitleLabel")}
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>{t("save")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type DeleteCaseDialogProps = {
  opened: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export function DeleteCaseDialog(props: DeleteCaseDialogProps) {
  const t = useTranslations("member.caseDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("deleteTitle")} centered>
      <Stack>
        <div>{t("deleteConfirm")}</div>
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button color="red" loading={props.loading} onClick={props.onSubmit}>{t("delete")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
