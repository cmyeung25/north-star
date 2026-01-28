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
import { createLiabilityItemId } from "./liabilityAdapter";
import type { LiabilityItem, LiabilityItemUpsert, LiabilityType } from "./types";

type LiabilityItemDraft = {
  id: string;
  liabilityType: LiabilityType;
  name: string;
  principalOutstanding: string;
  currency: string;
  interestRate: string;
  startMonth: string;
  termMonths: string;
  notes: string;
  source: LiabilityItem["source"];
};

const buildDraft = (item: LiabilityItem | null, baseCurrency: string): LiabilityItemDraft => {
  if (!item) {
    return {
      id: createLiabilityItemId(),
      liabilityType: "loan",
      name: "",
      principalOutstanding: "",
      currency: baseCurrency,
      interestRate: "",
      startMonth: "",
      termMonths: "12",
      notes: "",
      source: "manual",
    };
  }

  return {
    id: item.id,
    liabilityType: item.liabilityType,
    name: item.name,
    principalOutstanding: Number.isFinite(item.principalOutstanding)
      ? String(item.principalOutstanding)
      : "",
    currency: item.currency,
    interestRate: Number.isFinite(item.interestRate) ? String(item.interestRate) : "",
    startMonth: item.startMonth ?? "",
    termMonths: item.termMonths ? String(item.termMonths) : "",
    notes: item.notes ?? "",
    source: item.source,
  };
};

type LiabilityManagerProps = {
  items: LiabilityItem[];
  baseCurrency: string;
  locale: string;
  onUpsert: (item: LiabilityItemUpsert) => void;
  onDelete: (item: LiabilityItem) => void;
  onView?: (item: LiabilityItem) => void;
};

export default function LiabilityManager({
  items,
  baseCurrency,
  locale,
  onUpsert,
  onDelete,
  onView,
}: LiabilityManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<LiabilityItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const initialDraft = useMemo(
    () => buildDraft(editingItem, baseCurrency),
    [editingItem, baseCurrency]
  );

  const { draft, setDraft, errors, validate, reset } = useEntityDraft(
    initialDraft,
    (currentDraft) => {
      const nextErrors: Record<string, string> = {};
      const principalValue = Number(currentDraft.principalOutstanding);
      const rateValue = currentDraft.interestRate === "" ? null : Number(currentDraft.interestRate);
      const termValue = currentDraft.termMonths === "" ? null : Number(currentDraft.termMonths);

      if (!currentDraft.name.trim()) {
        nextErrors.name = t("liabilityFormNameRequired");
      }
      if (!Number.isFinite(principalValue) || principalValue < 0) {
        nextErrors.principalOutstanding = t("liabilityFormPrincipalRequired");
      }
      if (rateValue !== null && (!Number.isFinite(rateValue) || rateValue < 0 || rateValue > 100)) {
        nextErrors.interestRate = t("liabilityFormRateInvalid");
      }
      if (currentDraft.startMonth && !isValidMonthKey(currentDraft.startMonth)) {
        nextErrors.startMonth = t("liabilityFormMonthInvalid");
      }
      if (termValue !== null && (!Number.isFinite(termValue) || termValue <= 0)) {
        nextErrors.termMonths = t("liabilityFormTermInvalid");
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
      if (filterType !== "all" && item.liabilityType !== filterType) {
        return false;
      }
      if (searchValue && !item.name.toLowerCase().includes(searchValue)) {
        return false;
      }
      return true;
    });
  }, [items, filterType, search]);

  const typeLabel = (liabilityType: LiabilityType) => {
    switch (liabilityType) {
      case "mortgage":
        return t("liabilityTypeMortgage");
      case "loan":
        return t("liabilityTypeLoan");
      case "other":
        return t("liabilityTypeOther");
      default:
        return liabilityType;
    }
  };

  const openDrawer = (item: LiabilityItem | null) => {
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
    const nextValue: LiabilityItemUpsert = {
      id: result.value.id,
      liabilityType: result.value.liabilityType,
      name: result.value.name.trim(),
      principalOutstanding: Number(result.value.principalOutstanding),
      currency: result.value.currency,
      interestRate:
        result.value.interestRate === "" ? undefined : Number(result.value.interestRate),
      startMonth: result.value.startMonth || undefined,
      termMonths: result.value.termMonths === "" ? undefined : Number(result.value.termMonths),
      notes: result.value.notes || undefined,
      source: result.value.source,
    };
    onUpsert(nextValue);
    closeDrawer();
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group>
          <Select
            label={t("liabilityFilterType")}
            value={filterType}
            onChange={(value) => setFilterType(value ?? "all")}
            data={[
              { value: "all", label: t("liabilityFilterAll") },
              { value: "mortgage", label: t("liabilityTypeMortgage") },
              { value: "loan", label: t("liabilityTypeLoan") },
              { value: "other", label: t("liabilityTypeOther") },
            ]}
          />
          <TextInput
            label={t("liabilityFilterSearch")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
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
            const valueLabel = formatCurrency(
              item.principalOutstanding,
              item.currency,
              locale
            );
            return (
              <Card key={item.id} withBorder radius="md" padding="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Text fw={600}>{item.name}</Text>
                    <Text size="xs" c="dimmed">
                      {typeLabel(item.liabilityType)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("liabilityItemMeta", {
                        value: valueLabel,
                        month: item.startMonth || "--",
                      })}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    {onView && (
                      <Button size="xs" variant="light" onClick={() => onView(item)}>
                        {t("liabilityManagerView")}
                      </Button>
                    )}
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
          <Select
            label={t("liabilityFormTypeLabel")}
            value={draft.liabilityType}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                liabilityType: (value ?? "loan") as LiabilityType,
              }))
            }
            data={[
              { value: "mortgage", label: t("liabilityTypeMortgage") },
              { value: "loan", label: t("liabilityTypeLoan") },
              { value: "other", label: t("liabilityTypeOther") },
            ]}
          />
          <TextInput
            label={t("liabilityFormNameLabel")}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.currentTarget.value }))}
            error={errors.name}
          />
          <NumberInput
            label={t("liabilityFormPrincipalLabel")}
            value={draft.principalOutstanding}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                principalOutstanding: value === "" || value === null ? "" : String(value),
              }))
            }
            min={0}
            error={errors.principalOutstanding}
          />
          <NumberInput
            label={t("liabilityFormRateLabel")}
            value={draft.interestRate}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                interestRate: value === "" || value === null ? "" : String(value),
              }))
            }
            min={0}
            max={100}
            suffix="%"
            error={errors.interestRate}
          />
          <MonthField
            label={t("liabilityFormStartMonthLabel")}
            value={draft.startMonth}
            onChange={(value) => setDraft((current) => ({ ...current, startMonth: value }))}
            error={errors.startMonth}
          />
          <NumberInput
            label={t("liabilityFormTermMonthsLabel")}
            value={draft.termMonths}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                termMonths: value === "" || value === null ? "" : String(value),
              }))
            }
            min={1}
            error={errors.termMonths}
          />
          <TextInput
            label={t("liabilityFormNotesLabel")}
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDrawer}>
              {common("actionCancel")}
            </Button>
            <Button onClick={handleSave}>{common("actionSave")}</Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
