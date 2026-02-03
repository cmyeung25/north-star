"use client";

import {
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import type {
  ScenarioLiability,
  ScenarioLiabilityKind,
} from "../../src/store/scenarioStore";

type LiabilitySourceEvent = {
  id: string;
  label: string;
  hasRelatedDebt?: boolean;
  hasRelatedCashflows?: boolean;
};

type ScenarioLiabilityDraft = {
  id: string;
  kind: ScenarioLiabilityKind;
  label: string;
  principalOutstanding: string;
  annualInterestRatePct: string;
  termYears: string;
};

const buildDraft = (item: ScenarioLiability | null): ScenarioLiabilityDraft => ({
  id: item?.id ?? nanoid(),
  kind: item?.kind ?? "loan",
  label: item?.label ?? "",
  principalOutstanding:
    item?.principalOutstanding !== undefined &&
    Number.isFinite(item.principalOutstanding)
      ? String(item.principalOutstanding)
      : "",
  annualInterestRatePct:
    item?.annualInterestRatePct !== undefined &&
    Number.isFinite(item.annualInterestRatePct)
      ? String(item.annualInterestRatePct)
      : "",
  termYears:
    item?.termYears !== undefined && Number.isFinite(item.termYears)
      ? String(item.termYears)
      : "",
});

type ScenarioLiabilityManagerProps = {
  items: ScenarioLiability[];
  sourceEventsByLiabilityId: Record<string, LiabilitySourceEvent[]>;
  onUpsert: (item: ScenarioLiability) => void;
  onDelete: (item: ScenarioLiability) => void;
  onEditEvent?: (eventId: string) => void;
  openEditId?: string | null;
  onOpenEditHandled?: () => void;
};

export default function ScenarioLiabilityManager({
  items,
  sourceEventsByLiabilityId,
  onUpsert,
  onDelete,
  onEditEvent,
  openEditId,
  onOpenEditHandled,
}: ScenarioLiabilityManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<ScenarioLiability | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const initialDraft = useMemo(() => buildDraft(editingItem), [editingItem]);
  const { draft, setDraft, errors, validate, reset } = useEntityDraft(
    initialDraft,
    (currentDraft) => {
      const nextErrors: Record<string, string> = {};
      const principalValue = Number(currentDraft.principalOutstanding);
      const rateValue =
        currentDraft.annualInterestRatePct === ""
          ? null
          : Number(currentDraft.annualInterestRatePct);
      const termValue =
        currentDraft.termYears === "" ? null : Number(currentDraft.termYears);

      if (!currentDraft.label.trim()) {
        nextErrors.label = t("liabilityFormNameRequired");
      }
      if (!Number.isFinite(principalValue) || principalValue < 0) {
        nextErrors.principalOutstanding = t("liabilityFormPrincipalRequired");
      }
      if (rateValue !== null && (!Number.isFinite(rateValue) || rateValue < 0 || rateValue > 100)) {
        nextErrors.annualInterestRatePct = t("liabilityFormRateInvalid");
      }
      if (termValue !== null && (!Number.isFinite(termValue) || termValue <= 0)) {
        nextErrors.termYears = t("liabilityFormTermInvalid");
      }

      return {
        isValid: Object.keys(nextErrors).length === 0,
        errors: nextErrors,
        value: currentDraft,
      };
    }
  );

  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filterType !== "all" && item.kind !== filterType) {
        return false;
      }
      if (searchValue && !(item.label ?? "").toLowerCase().includes(searchValue)) {
        return false;
      }
      return true;
    });
  }, [items, filterType, search]);

  const typeLabel = (liabilityType: ScenarioLiabilityKind) => {
    switch (liabilityType) {
      case "mortgage":
        return t("liabilityTypeMortgage");
      case "loan":
        return t("liabilityTypeLoan");
      case "carLoan":
        return t("liabilityTypeCarLoan");
      case "credit":
        return t("liabilityTypeCredit");
      case "other":
        return t("liabilityTypeOther");
      default:
        return liabilityType;
    }
  };

  const openDrawer = (item: ScenarioLiability | null) => {
    setEditingItem(item);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingItem(null);
    reset();
  };

  const handleSave = () => {
    const result = validate();
    if (!result.isValid) {
      return;
    }
    onUpsert({
      id: draft.id,
      kind: draft.kind,
      label: draft.label.trim(),
      principalOutstanding: Number(draft.principalOutstanding),
      annualInterestRatePct:
        draft.annualInterestRatePct === ""
          ? undefined
          : Number(draft.annualInterestRatePct),
      termYears: draft.termYears === "" ? undefined : Number(draft.termYears),
      source: "manual",
    });
    closeDrawer();
  };

  useEffect(() => {
    if (!openEditId) {
      return;
    }
    const match = items.find((item) => item.id === openEditId) ?? null;
    const isDerived =
      match?.source === "eventGenerated" ||
      Boolean(match?.createdByEventId) ||
      (sourceEventsByLiabilityId[match?.id ?? ""]?.length ?? 0) > 0;
    if (match && !isDerived) {
      openDrawer(match);
    }
    onOpenEditHandled?.();
  }, [items, onOpenEditHandled, openEditId, sourceEventsByLiabilityId]);

  const typeOptions = [
    { value: "mortgage", label: t("liabilityTypeMortgage") },
    { value: "loan", label: t("liabilityTypeLoan") },
    { value: "carLoan", label: t("liabilityTypeCarLoan") },
    { value: "credit", label: t("liabilityTypeCredit") },
    { value: "other", label: t("liabilityTypeOther") },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group>
          <Select
            label={t("liabilityFilterType")}
            value={filterType}
            onChange={(value) => setFilterType(value ?? "all")}
            data={[{ value: "all", label: t("liabilityFilterAll") }, ...typeOptions]}
          />
          <TextInput
            label={t("liabilityFilterSearch")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget?.value ?? "")}
          />
        </Group>
        <Button onClick={() => openDrawer(null)}>{t("liabilityManagerAdd")}</Button>
      </Group>

      {filteredItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("liabilityManagerEmpty")}
        </Text>
      ) : (
        <Stack gap="sm">
          {filteredItems.map((item) => {
            const sources = sourceEventsByLiabilityId[item.id] ?? [];
            const isDerived =
              item.source === "eventGenerated" ||
              Boolean(item.createdByEventId) ||
              sources.length > 0;
            const canEdit = !isDerived;
            const primarySource = sources[0];
            const eventId = primarySource?.id ?? item.createdByEventId ?? null;
            const handleEditEvent = () => {
              if (eventId) {
                onEditEvent?.(eventId);
              }
            };
            return (
              <Card key={item.id} withBorder radius="md" padding="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Text fw={600}>{item.label ?? t("liabilityUntitled")}</Text>
                    <Text size="xs" c="dimmed">
                      {typeLabel(item.kind)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("liabilityItemMetaV2", {
                        principal:
                          item.principalOutstanding !== undefined
                            ? item.principalOutstanding
                            : "--",
                        rate:
                          item.annualInterestRatePct !== undefined
                            ? item.annualInterestRatePct
                            : "--",
                        term: item.termYears !== undefined ? item.termYears : "--",
                      })}
                    </Text>
                    {isDerived && (
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {t("eventSourceLabel")}
                        </Text>
                        <Group gap="xs">
                          <Button size="xs" variant="light" onClick={handleEditEvent}>
                            {t("eventRelationEvent")}
                          </Button>
                          {primarySource?.hasRelatedDebt && (
                            <Button size="xs" variant="light" onClick={handleEditEvent}>
                              {t("eventRelationDebt")}
                            </Button>
                          )}
                          {primarySource?.hasRelatedCashflows && (
                            <Button size="xs" variant="light" onClick={handleEditEvent}>
                              {t("eventRelationCashflows")}
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    )}
                  </Stack>
                  <Group gap="xs">
                    {canEdit ? (
                      <>
                        <Button size="xs" variant="light" onClick={() => openDrawer(item)}>
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => onDelete(item)}
                        >
                          {common("actionDelete")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="xs"
                        variant="light"
                        onClick={handleEditEvent}
                        disabled={!eventId}
                      >
                        {t("eventGeneratedEdit")}
                      </Button>
                    )}
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      <Drawer
        opened={isDrawerOpen}
        onClose={closeDrawer}
        position="right"
        size="md"
        title={editingItem ? t("liabilityFormEditTitle") : t("liabilityFormCreateTitle")}
      >
        <Stack gap="sm">
          <TextInput
            label={t("liabilityFormNameLabel")}
            value={draft.label}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                label: event.currentTarget?.value ?? "",
              }))
            }
            error={errors.label}
          />
          <Select
            label={t("liabilityFormTypeLabel")}
            value={draft.kind}
            data={typeOptions}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                kind: (value ?? "loan") as ScenarioLiabilityKind,
              }))
            }
          />
          <NumberInput
            label={t("liabilityFormPrincipalLabel")}
            value={
              draft.principalOutstanding === ""
                ? ""
                : Number(draft.principalOutstanding)
            }
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                principalOutstanding: value === "" ? "" : String(value),
              }))
            }
            error={errors.principalOutstanding}
            min={0}
            thousandSeparator
          />
          <NumberInput
            label={t("liabilityFormRateLabel")}
            value={
              draft.annualInterestRatePct === ""
                ? ""
                : Number(draft.annualInterestRatePct)
            }
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                annualInterestRatePct: value === "" ? "" : String(value),
              }))
            }
            error={errors.annualInterestRatePct}
            min={0}
            max={100}
          />
          <NumberInput
            label={t("liabilityFormTermYearsLabel")}
            value={draft.termYears === "" ? "" : Number(draft.termYears)}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                termYears: value === "" ? "" : String(value),
              }))
            }
            error={errors.termYears}
            min={1}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeDrawer}>
              {common("actionCancel")}
            </Button>
            <Button onClick={handleSave}>{common("actionSave")}</Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
