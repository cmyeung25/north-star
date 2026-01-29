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
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";
import { formatCurrency } from "../../lib/i18n";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import { isValidMonthKey } from "../../src/utils/monthKey";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import { createAssetItemId } from "./assetAdapter";
import type { AssetItem, AssetItemUpsert, AssetType } from "./types";

type AssetItemDraft = {
  id: string;
  assetType: AssetType;
  name: string;
  currentValue: string;
  currency: string;
  ownerMemberId: string;
  startMonth: string;
  notes: string;
  source: AssetItem["source"];
  generatedByEventId?: string;
};

const buildDraft = (item: AssetItem | null, baseCurrency: string): AssetItemDraft => {
  if (!item) {
    return {
      id: createAssetItemId("property"),
      assetType: "property",
      name: "",
      currentValue: "",
      currency: baseCurrency,
      ownerMemberId: "",
      startMonth: "",
      notes: "",
      source: "manual",
    };
  }

  return {
    id: item.id,
    assetType: item.assetType,
    name: item.name,
    currentValue: Number.isFinite(item.currentValue) ? String(item.currentValue) : "",
    currency: item.currency,
    ownerMemberId: item.ownerMemberId ?? "",
    startMonth: item.startMonth ?? "",
    notes: item.notes ?? "",
    source: item.source,
    generatedByEventId: item.generatedByEventId,
  };
};

type AssetManagerProps = {
  items: AssetItem[];
  baseCurrency: string;
  locale: string;
  members: ScenarioMember[];
  onUpsert: (item: AssetItemUpsert) => void;
  onDelete: (item: AssetItem) => void;
  onView?: (item: AssetItem) => void;
  onEditEvent?: (eventId: string) => void;
  onDetach?: (item: AssetItem) => void;
};

export default function AssetManager({
  items,
  baseCurrency,
  locale,
  members,
  onUpsert,
  onDelete,
  onView,
  onEditEvent,
  onDetach,
}: AssetManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<AssetItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const initialDraft = useMemo(
    () => buildDraft(editingItem, baseCurrency),
    [editingItem, baseCurrency]
  );

  const { draft, setDraft, errors, validate, reset } = useEntityDraft(
    initialDraft,
    (currentDraft) => {
      const nextErrors: Record<string, string> = {};
      const valueNumber = Number(currentDraft.currentValue);

      if (!currentDraft.name.trim()) {
        nextErrors.name = t("assetFormNameRequired");
      }
      if (!Number.isFinite(valueNumber) || valueNumber < 0) {
        nextErrors.currentValue = t("assetFormValueRequired");
      }
      if (currentDraft.startMonth && !isValidMonthKey(currentDraft.startMonth)) {
        nextErrors.startMonth = t("assetFormMonthInvalid");
      }

      return {
        isValid: Object.keys(nextErrors).length === 0,
        errors: nextErrors,
        value: currentDraft,
      };
    }
  );
  const isReadOnly = draft.source === "eventGenerated" || draft.source === "derived";

  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filterType !== "all" && item.assetType !== filterType) {
        return false;
      }
      if (searchValue && !item.name.toLowerCase().includes(searchValue)) {
        return false;
      }
      return true;
    });
  }, [items, filterType, search]);

  const typeLabel = (assetType: AssetType) => {
    switch (assetType) {
      case "property":
        return t("assetTypeProperty");
      case "investment":
        return t("assetTypeInvestment");
      case "insurance":
        return t("assetTypeInsurance");
      case "car":
        return t("assetTypeCar");
      default:
        return assetType;
    }
  };

  const openDrawer = (item: AssetItem | null) => {
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
    if (!result.isValid || !result.value) {
      return;
    }
    const nextValue: AssetItemUpsert = {
      id: result.value.id,
      assetType: result.value.assetType,
      name: result.value.name.trim(),
      currentValue: Number(result.value.currentValue),
      currency: result.value.currency,
      ownerMemberId: result.value.ownerMemberId || undefined,
      startMonth: result.value.startMonth || undefined,
      notes: result.value.notes || undefined,
      source: result.value.source,
      generatedByEventId: result.value.generatedByEventId,
    };
    onUpsert(nextValue);
    closeDrawer();
  };

  const handleTypeChange = (value: string | null) => {
    if (!value) {
      return;
    }
    setDraft((current) => ({
      ...current,
      assetType: value as AssetType,
      id: editingItem ? current.id : createAssetItemId(value as AssetType),
    }));
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group>
          <Select
            label={t("assetFilterType")}
            value={filterType}
            onChange={(value) => setFilterType(value ?? "all")}
            data={[
              { value: "all", label: t("assetFilterAll") },
              { value: "property", label: t("assetTypeProperty") },
              { value: "investment", label: t("assetTypeInvestment") },
              { value: "insurance", label: t("assetTypeInsurance") },
              { value: "car", label: t("assetTypeCar") },
            ]}
          />
          <TextInput
            label={t("assetFilterSearch")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
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
            const ownerLabel =
              (item.ownerMemberId
                ? members.find((member) => member.id === item.ownerMemberId)?.name
                : null) ?? t("flowMemberHousehold");
            const valueLabel = formatCurrency(item.currentValue, item.currency, locale);
            const isGenerated = item.source === "eventGenerated";
            return (
              <Card key={item.id} withBorder radius="md" padding="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Text fw={600}>{item.name}</Text>
                    <Text size="xs" c="dimmed">
                      {typeLabel(item.assetType)} · {ownerLabel}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("assetItemMeta", {
                        value: valueLabel,
                        month: item.startMonth || "--",
                      })}
                    </Text>
                    {isGenerated && (
                      <Text size="xs" c="dimmed">
                        {t("eventGeneratedBadge")}
                      </Text>
                    )}
                  </Stack>
                  <Group gap="xs">
                    {onView && (
                      <Button size="xs" variant="light" onClick={() => onView(item)}>
                        {t("assetManagerView")}
                      </Button>
                    )}
                    {isGenerated ? (
                      <>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => item.generatedByEventId && onEditEvent?.(item.generatedByEventId)}
                          disabled={!item.generatedByEventId}
                        >
                          {t("eventGeneratedEdit")}
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => onDetach?.(item)}
                        >
                          {t("eventGeneratedDetach")}
                        </Button>
                      </>
                    ) : (
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
          {editingItem?.source === "eventGenerated" && (
            <Card withBorder radius="md" padding="sm">
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t("eventGeneratedTitle")}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("eventGeneratedHint")}
                </Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() =>
                      editingItem.generatedByEventId &&
                      onEditEvent?.(editingItem.generatedByEventId)
                    }
                    disabled={!editingItem.generatedByEventId}
                  >
                    {t("eventGeneratedEdit")}
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => onDetach?.(editingItem)}
                  >
                    {t("eventGeneratedDetach")}
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
          <Select
            label={t("assetFormTypeLabel")}
            value={draft.assetType}
            onChange={handleTypeChange}
            data={[
              { value: "property", label: t("assetTypeProperty") },
              { value: "investment", label: t("assetTypeInvestment") },
              { value: "insurance", label: t("assetTypeInsurance") },
              { value: "car", label: t("assetTypeCar") },
            ]}
            disabled={isReadOnly}
          />
          <TextInput
            label={t("assetFormNameLabel")}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.currentTarget.value }))}
            error={errors.name}
            disabled={isReadOnly}
          />
          <NumberInput
            label={t("assetFormValueLabel")}
            value={draft.currentValue}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                currentValue: value === "" || value === null ? "" : String(value),
              }))
            }
            min={0}
            error={errors.currentValue}
            disabled={isReadOnly}
          />
          <MonthField
            label={t("assetFormStartMonthLabel")}
            value={draft.startMonth}
            onChange={(value) => setDraft((current) => ({ ...current, startMonth: value }))}
            error={errors.startMonth}
            disabled={isReadOnly}
          />
          <Select
            label={t("assetFormOwnerLabel")}
            value={draft.ownerMemberId}
            onChange={(value) =>
              setDraft((current) => ({ ...current, ownerMemberId: value ?? "" }))
            }
            data={[
              { value: "", label: t("flowMemberHousehold") },
              ...members.map((member) => ({ value: member.id, label: member.name })),
            ]}
            disabled={isReadOnly}
          />
          <TextInput
            label={t("assetFormNotesLabel")}
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.currentTarget.value }))}
            disabled={isReadOnly}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDrawer}>
              {common("actionCancel")}
            </Button>
            <Button onClick={handleSave} disabled={isReadOnly}>
              {common("actionSave")}
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
