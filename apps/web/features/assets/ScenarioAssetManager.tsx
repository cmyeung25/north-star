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
import { formatCurrency } from "../../lib/i18n";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import type { ScenarioAsset, ScenarioAssetKind } from "../../src/store/scenarioStore";

type AssetSourceEvent = {
  id: string;
  label: string;
  hasRelatedDebt?: boolean;
  hasRelatedCashflows?: boolean;
};

type ScenarioAssetDraft = {
  id: string;
  kind: ScenarioAssetKind;
  label: string;
  currentValue: string;
};

const buildDraft = (item: ScenarioAsset | null): ScenarioAssetDraft => ({
  id: item?.id ?? nanoid(),
  kind: item?.kind ?? "cash",
  label: item?.label ?? "",
  currentValue:
    item?.currentValue !== undefined && Number.isFinite(item.currentValue)
      ? String(item.currentValue)
      : "",
});

type ScenarioAssetManagerProps = {
  items: ScenarioAsset[];
  baseCurrency: string;
  locale: string;
  sourceEventsByAssetId: Record<string, AssetSourceEvent[]>;
  onUpsert: (item: ScenarioAsset) => void;
  onDelete: (item: ScenarioAsset) => void;
  onEditEvent?: (eventId: string) => void;
  openEditId?: string | null;
  onOpenEditHandled?: () => void;
};

export default function ScenarioAssetManager({
  items,
  baseCurrency,
  locale,
  sourceEventsByAssetId,
  onUpsert,
  onDelete,
  onEditEvent,
  openEditId,
  onOpenEditHandled,
}: ScenarioAssetManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<ScenarioAsset | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const initialDraft = useMemo(() => buildDraft(editingItem), [editingItem]);
  const { draft, setDraft, errors, validate, reset } = useEntityDraft(
    initialDraft,
    (currentDraft) => {
      const nextErrors: Record<string, string> = {};
      const currentValue = Number(currentDraft.currentValue);
      if (!currentDraft.label.trim()) {
        nextErrors.label = t("assetFormNameRequired");
      }
      if (!Number.isFinite(currentValue) || currentValue < 0) {
        nextErrors.currentValue = t("assetFormValueRequired");
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

  const typeLabel = (assetType: ScenarioAssetKind) => {
    switch (assetType) {
      case "cash":
        return t("assetTypeCash");
      case "home":
        return t("assetTypeProperty");
      case "investment":
        return t("assetTypeInvestment");
      case "car":
        return t("assetTypeCar");
      case "policy":
        return t("assetTypePolicy");
      case "other":
        return t("assetTypeOther");
      default:
        return assetType;
    }
  };

  const openDrawer = (item: ScenarioAsset | null) => {
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
      currentValue: Number(draft.currentValue),
      currency: baseCurrency,
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
      (sourceEventsByAssetId[match?.id ?? ""]?.length ?? 0) > 0;
    if (match && !isDerived) {
      openDrawer(match);
    }
    onOpenEditHandled?.();
  }, [items, onOpenEditHandled, openEditId, sourceEventsByAssetId]);

  const typeOptions = [
    { value: "cash", label: t("assetTypeCash") },
    { value: "home", label: t("assetTypeProperty") },
    { value: "investment", label: t("assetTypeInvestment") },
    { value: "car", label: t("assetTypeCar") },
    { value: "policy", label: t("assetTypePolicy") },
    { value: "other", label: t("assetTypeOther") },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group>
          <Select
            label={t("assetFilterType")}
            value={filterType}
            onChange={(value) => setFilterType(value ?? "all")}
            data={[{ value: "all", label: t("assetFilterAll") }, ...typeOptions]}
          />
          <TextInput
            label={t("assetFilterSearch")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget?.value ?? "")}
          />
        </Group>
        <Button onClick={() => openDrawer(null)}>{t("assetManagerAdd")}</Button>
      </Group>

      {filteredItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("assetManagerEmpty")}
        </Text>
      ) : (
        <Stack gap="sm">
          {filteredItems.map((item) => {
            const sources = sourceEventsByAssetId[item.id] ?? [];
            const isDerived =
              item.source === "eventGenerated" ||
              Boolean(item.createdByEventId) ||
              sources.length > 0;
            const valueLabel = Number.isFinite(item.currentValue ?? Number.NaN)
              ? formatCurrency(item.currentValue ?? 0, item.currency ?? baseCurrency, locale)
              : t("assetValueUnset");
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
                    <Text fw={600}>{item.label ?? t("assetUntitled")}</Text>
                    <Text size="xs" c="dimmed">
                      {typeLabel(item.kind)} · {valueLabel}
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
        title={editingItem ? t("assetFormEditTitle") : t("assetFormCreateTitle")}
      >
        <Stack gap="sm">
          <TextInput
            label={t("assetFormNameLabel")}
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
            label={t("assetFormTypeLabel")}
            value={draft.kind}
            data={typeOptions}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                kind: (value ?? "cash") as ScenarioAssetKind,
              }))
            }
          />
          <NumberInput
            label={t("assetFormValueLabel")}
            value={draft.currentValue === "" ? "" : Number(draft.currentValue)}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                currentValue: value === "" ? "" : String(value),
              }))
            }
            error={errors.currentValue}
            min={0}
            thousandSeparator
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
