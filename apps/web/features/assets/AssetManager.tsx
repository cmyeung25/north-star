"use client";

import {
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import MonthField from "../../components/MonthField";
import { formatCurrency } from "../../lib/i18n";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import { compareMonthKey, isValidMonthKey } from "../../src/utils/monthKey";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import { createAssetItemId } from "./assetAdapter";
import type { AssetItem, AssetItemUpsert, AssetType } from "./types";
import {
  buildDerivedMoneyItemsForAsset,
  findOverlappingManualItems,
} from "../moneyFlow/derivedMoneyItems";
import type { MoneyItem } from "../moneyFlow/types";

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
  purchaseFees: Array<{
    id: string;
    label: string;
    amount: string;
    month: string;
  }>;
  ongoingCosts: Array<{
    key: string;
    label: string;
    enabled: boolean;
    amount: string;
    startMonth: string;
  }>;
  rental: {
    isRented: boolean;
    rentAmountMonthly: string;
    rentStartMonth: string;
    rentEndMonth: string;
  };
};

const propertyOngoingCostKeys = [
  { key: "managementFee", labelKey: "assetOngoingManagementFee" },
  { key: "groundRent", labelKey: "assetOngoingGroundRent" },
  { key: "insurance", labelKey: "assetOngoingInsurance" },
  { key: "maintenance", labelKey: "assetOngoingMaintenance" },
] as const;

const carOngoingCostKeys = [
  { key: "insurance", labelKey: "assetOngoingInsurance" },
  { key: "inspection", labelKey: "assetOngoingInspection" },
  { key: "maintenance", labelKey: "assetOngoingMaintenance" },
] as const;

const buildOngoingCostDrafts = (
  assetType: AssetType,
  existing: AssetItem["ongoingCosts"] | undefined,
  startMonth: string,
  t: ReturnType<typeof useTranslations>
) => {
  const template =
    assetType === "property" ? propertyOngoingCostKeys : carOngoingCostKeys;
  return template.map((entry) => {
    const existingEntry = existing?.find((item) => item.key === entry.key);
    return {
      key: entry.key,
      label: t(entry.labelKey),
      enabled: existingEntry?.enabled ?? false,
      amount: Number.isFinite(existingEntry?.amount)
        ? String(existingEntry?.amount)
        : "",
      startMonth: existingEntry?.startMonth ?? startMonth ?? "",
    };
  });
};

const buildDraft = (item: AssetItem | null, baseCurrency: string, t: ReturnType<typeof useTranslations>): AssetItemDraft => {
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
      purchaseFees: [],
      ongoingCosts: buildOngoingCostDrafts("property", undefined, "", t),
      rental: {
        isRented: false,
        rentAmountMonthly: "",
        rentStartMonth: "",
        rentEndMonth: "",
      },
    };
  }

  const startMonth = item.startMonth ?? "";
  return {
    id: item.id,
    assetType: item.assetType,
    name: item.name,
    currentValue: Number.isFinite(item.currentValue) ? String(item.currentValue) : "",
    currency: item.currency,
    ownerMemberId: item.ownerMemberId ?? "",
    startMonth,
    notes: item.notes ?? "",
    source: item.source,
    generatedByEventId: item.generatedByEventId,
    purchaseFees:
      item.purchaseFees?.map((fee) => ({
        id: fee.id,
        label: fee.label,
        amount: Number.isFinite(fee.amount) ? String(fee.amount) : "",
        month: fee.month ?? startMonth,
      })) ?? [],
    ongoingCosts:
      item.assetType === "property" || item.assetType === "car"
        ? buildOngoingCostDrafts(
            item.assetType,
            item.ongoingCosts,
            startMonth,
            t
          )
        : [],
    rental: {
      isRented: item.rental?.isRented ?? false,
      rentAmountMonthly: Number.isFinite(item.rental?.rentAmountMonthly)
        ? String(item.rental?.rentAmountMonthly)
        : "",
      rentStartMonth: item.rental?.rentStartMonth ?? startMonth,
      rentEndMonth: item.rental?.rentEndMonth ?? "",
    },
  };
};

type AssetManagerProps = {
  items: AssetItem[];
  baseCurrency: string;
  locale: string;
  members: ScenarioMember[];
  moneyItems: MoneyItem[];
  onUpsert: (item: AssetItemUpsert) => void;
  onDelete: (item: AssetItem) => void;
  onView?: (item: AssetItem) => void;
  onEditEvent?: (eventId: string) => void;
  onDetach?: (item: AssetItem) => void;
  openEditId?: string | null;
  onOpenEditHandled?: () => void;
};

export default function AssetManager({
  items,
  baseCurrency,
  locale,
  members,
  moneyItems,
  onUpsert,
  onDelete,
  onView,
  onEditEvent,
  onDetach,
  openEditId,
  onOpenEditHandled,
}: AssetManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<AssetItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const initialDraft = useMemo(
    () => buildDraft(editingItem, baseCurrency, t),
    [editingItem, baseCurrency, t]
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
      if (currentDraft.assetType === "property" || currentDraft.assetType === "car") {
        currentDraft.purchaseFees.forEach((fee) => {
          const hasContent = Boolean(
            fee.label.trim() || fee.amount || fee.month.trim()
          );
          if (!hasContent) {
            return;
          }
          if (!fee.label.trim()) {
            nextErrors[`purchaseFees.${fee.id}.label`] = t("assetFeeLabelRequired");
          }
          const feeAmount = Number(fee.amount);
          if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
            nextErrors[`purchaseFees.${fee.id}.amount`] = t("assetFeeAmountRequired");
          }
          if (!isValidMonthKey(fee.month)) {
            nextErrors[`purchaseFees.${fee.id}.month`] = t("assetFeeMonthRequired");
          }
        });
        currentDraft.ongoingCosts.forEach((cost) => {
          if (!cost.enabled) {
            return;
          }
          const costAmount = Number(cost.amount);
          if (!Number.isFinite(costAmount) || costAmount <= 0) {
            nextErrors[`ongoingCosts.${cost.key}.amount`] = t("assetOngoingAmountRequired");
          }
          if (!isValidMonthKey(cost.startMonth)) {
            nextErrors[`ongoingCosts.${cost.key}.startMonth`] = t("assetOngoingMonthRequired");
          }
        });
      }
      if (currentDraft.assetType === "property" && currentDraft.rental.isRented) {
        const rentAmount = Number(currentDraft.rental.rentAmountMonthly);
        if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
          nextErrors.rentAmountMonthly = t("assetRentalAmountRequired");
        }
        if (!isValidMonthKey(currentDraft.rental.rentStartMonth)) {
          nextErrors.rentStartMonth = t("assetRentalStartMonthRequired");
        }
        if (currentDraft.rental.rentEndMonth) {
          if (!isValidMonthKey(currentDraft.rental.rentEndMonth)) {
            nextErrors.rentEndMonth = t("assetRentalEndMonthInvalid");
          } else if (
            isValidMonthKey(currentDraft.rental.rentStartMonth) &&
            compareMonthKey(
              currentDraft.rental.rentStartMonth,
              currentDraft.rental.rentEndMonth
            ) > 0
          ) {
            nextErrors.rentEndMonth = t("assetRentalEndMonthInvalid");
          }
        }
      }

      return {
        isValid: Object.keys(nextErrors).length === 0,
        errors: nextErrors,
        value: currentDraft,
      };
    }
  );
  const isReadOnly = draft.source === "eventGenerated" || draft.source === "derived";
  const manualMoneyItems = useMemo(
    () => moneyItems.filter((item) => item.source === "manual"),
    [moneyItems]
  );
  const derivedLabels = useMemo(
    () => ({
      ongoingCostLabels: {
        managementFee: t("assetOngoingManagementFee"),
        groundRent: t("assetOngoingGroundRent"),
        insurance: t("assetOngoingInsurance"),
        maintenance: t("assetOngoingMaintenance"),
        inspection: t("assetOngoingInspection"),
      },
      rentalIncomeLabel: t("assetRentalIncomeLabel"),
    }),
    [t]
  );
  const overlappingManualItems = useMemo(() => {
    if (draft.assetType !== "property" && draft.assetType !== "car") {
      return [];
    }
    const candidateAsset: AssetItem = {
      id: draft.id,
      assetType: draft.assetType,
      name: draft.name,
      currentValue: Number(draft.currentValue),
      currency: draft.currency,
      ownerMemberId: draft.ownerMemberId || undefined,
      startMonth: draft.startMonth || undefined,
      notes: draft.notes || undefined,
      purchaseFees: draft.purchaseFees.map((fee) => ({
        id: fee.id,
        label: fee.label,
        amount: Number(fee.amount),
        month: fee.month,
      })),
      ongoingCosts: draft.ongoingCosts.map((cost) => ({
        key: cost.key,
        enabled: cost.enabled,
        amount: Number(cost.amount),
        startMonth: cost.startMonth,
      })),
      rental:
        draft.assetType === "property"
          ? {
              isRented: draft.rental.isRented,
              rentAmountMonthly: Number(draft.rental.rentAmountMonthly),
              rentStartMonth: draft.rental.rentStartMonth,
              rentEndMonth: draft.rental.rentEndMonth || undefined,
            }
          : undefined,
      source: draft.source,
      generatedByEventId: draft.generatedByEventId,
    };
    const candidates = buildDerivedMoneyItemsForAsset({
      asset: candidateAsset,
      baseCurrency,
      labels: derivedLabels,
    });
    return findOverlappingManualItems(manualMoneyItems, candidates);
  }, [baseCurrency, draft, derivedLabels, manualMoneyItems]);

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

  useEffect(() => {
    if (!openEditId) {
      return;
    }
    const target = items.find((item) => item.id === openEditId) ?? null;
    if (target) {
      openDrawer(target);
      onOpenEditHandled?.();
    }
  }, [items, openEditId, onOpenEditHandled]);

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
      purchaseFees:
        result.value.assetType === "property" || result.value.assetType === "car"
          ? result.value.purchaseFees
              .map((fee) => ({
                id: fee.id,
                label: fee.label.trim(),
                amount: Number(fee.amount),
                month: fee.month,
              }))
              .filter(
                (fee) =>
                  fee.label &&
                  Number.isFinite(fee.amount) &&
                  fee.amount > 0 &&
                  isValidMonthKey(fee.month)
              )
          : undefined,
      ongoingCosts:
        result.value.assetType === "property" || result.value.assetType === "car"
          ? result.value.ongoingCosts.map((cost) => ({
              key: cost.key,
              enabled: cost.enabled,
              amount: cost.enabled ? Number(cost.amount) : 0,
              startMonth: cost.startMonth,
            }))
          : undefined,
      rental:
        result.value.assetType === "property"
          ? {
              isRented: result.value.rental.isRented,
              rentAmountMonthly: Number(result.value.rental.rentAmountMonthly || 0),
              rentStartMonth: result.value.rental.rentStartMonth,
              rentEndMonth: result.value.rental.rentEndMonth || undefined,
            }
          : undefined,
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
    setDraft((current) => {
      const nextType = value as AssetType;
      const startMonth = current.startMonth;
      const nextOngoingCosts =
        nextType === "property" || nextType === "car"
          ? buildOngoingCostDrafts(nextType, undefined, startMonth, t)
          : [];
      return {
        ...current,
        assetType: nextType,
        id: editingItem ? current.id : createAssetItemId(nextType),
        ongoingCosts: nextOngoingCosts,
        purchaseFees:
          nextType === "property" || nextType === "car" ? current.purchaseFees : [],
        rental:
          nextType === "property"
            ? current.rental
            : { isRented: false, rentAmountMonthly: "", rentStartMonth: "", rentEndMonth: "" },
      };
    });
  };

  const handleAddPurchaseFee = () => {
    setDraft((current) => ({
      ...current,
      purchaseFees: [
        ...current.purchaseFees,
        {
          id: nanoid(),
          label: "",
          amount: "",
          month: current.startMonth || "",
        },
      ],
    }));
  };

  const handleRemovePurchaseFee = (id: string) => {
    setDraft((current) => ({
      ...current,
      purchaseFees: current.purchaseFees.filter((fee) => fee.id !== id),
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
            const isDerived = item.source === "derived";
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
                    {isDerived && (
                      <Text size="xs" c="dimmed">
                        {t("derivedBadge")}
                      </Text>
                    )}
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
                    ) : isDerived ? (
                      <>
                        <Button size="xs" variant="light" onClick={() => openDrawer(item)}>
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => onDetach?.(item)}
                        >
                          {t("derivedDetach")}
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
          {(draft.assetType === "property" || draft.assetType === "car") && (
            <>
              <Divider />
              <Stack gap="xs">
                <Text fw={600}>{t("assetPurchaseFeesTitle")}</Text>
                <Text size="xs" c="dimmed">
                  {t("assetPurchaseFeesHint")}
                </Text>
                {draft.purchaseFees.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    {t("assetPurchaseFeesEmpty")}
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {draft.purchaseFees.map((fee) => (
                      <Group key={fee.id} align="flex-end" wrap="wrap">
                        <TextInput
                          label={t("assetPurchaseFeeLabel")}
                          value={fee.label}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              purchaseFees: current.purchaseFees.map((entry) =>
                                entry.id === fee.id
                                  ? { ...entry, label: event.currentTarget.value }
                                  : entry
                              ),
                            }))
                          }
                          error={errors[`purchaseFees.${fee.id}.label`]}
                          disabled={isReadOnly}
                        />
                        <NumberInput
                          label={t("assetPurchaseFeeAmount")}
                          value={fee.amount}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              purchaseFees: current.purchaseFees.map((entry) =>
                                entry.id === fee.id
                                  ? {
                                      ...entry,
                                      amount:
                                        value === "" || value === null
                                          ? ""
                                          : String(value),
                                    }
                                  : entry
                              ),
                            }))
                          }
                          min={0}
                          error={errors[`purchaseFees.${fee.id}.amount`]}
                          disabled={isReadOnly}
                        />
                        <MonthField
                          label={t("assetPurchaseFeeMonth")}
                          value={fee.month}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              purchaseFees: current.purchaseFees.map((entry) =>
                                entry.id === fee.id ? { ...entry, month: value } : entry
                              ),
                            }))
                          }
                          error={errors[`purchaseFees.${fee.id}.month`]}
                          disabled={isReadOnly}
                        />
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleRemovePurchaseFee(fee.id)}
                          disabled={isReadOnly}
                        >
                          {common("actionDelete")}
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                )}
                <Group>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={handleAddPurchaseFee}
                    disabled={isReadOnly}
                  >
                    {t("assetPurchaseFeeAdd")}
                  </Button>
                </Group>
              </Stack>

              <Divider />

              <Stack gap="xs">
                <Text fw={600}>{t("assetOngoingCostsTitle")}</Text>
                <Text size="xs" c="dimmed">
                  {t("assetOngoingCostsHint")}
                </Text>
                <Stack gap="sm">
                  {draft.ongoingCosts.map((cost) => (
                    <Group key={cost.key} align="flex-end" wrap="wrap">
                      <Switch
                        label={cost.label}
                        checked={cost.enabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            ongoingCosts: current.ongoingCosts.map((entry) =>
                              entry.key === cost.key
                                ? { ...entry, enabled: event.currentTarget.checked }
                                : entry
                            ),
                          }))
                        }
                        disabled={isReadOnly}
                      />
                      <NumberInput
                        label={t("assetOngoingAmountLabel")}
                        value={cost.amount}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            ongoingCosts: current.ongoingCosts.map((entry) =>
                              entry.key === cost.key
                                ? {
                                    ...entry,
                                    amount:
                                      value === "" || value === null
                                        ? ""
                                        : String(value),
                                  }
                                : entry
                            ),
                          }))
                        }
                        min={0}
                        error={errors[`ongoingCosts.${cost.key}.amount`]}
                        disabled={isReadOnly || !cost.enabled}
                      />
                      <MonthField
                        label={t("assetOngoingStartMonthLabel")}
                        value={cost.startMonth}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            ongoingCosts: current.ongoingCosts.map((entry) =>
                              entry.key === cost.key ? { ...entry, startMonth: value } : entry
                            ),
                          }))
                        }
                        error={errors[`ongoingCosts.${cost.key}.startMonth`]}
                        disabled={isReadOnly || !cost.enabled}
                      />
                    </Group>
                  ))}
                </Stack>
              </Stack>

              {draft.assetType === "property" && (
                <>
                  <Divider />
                  <Stack gap="xs">
                    <Text fw={600}>{t("assetRentalTitle")}</Text>
                    <Text size="xs" c="dimmed">
                      {t("assetRentalHint")}
                    </Text>
                    <Switch
                      label={t("assetRentalToggle")}
                      checked={draft.rental.isRented}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rental: {
                            ...current.rental,
                            isRented: event.currentTarget.checked,
                          },
                        }))
                      }
                      disabled={isReadOnly}
                    />
                    {draft.rental.isRented && (
                      <Group align="flex-end" wrap="wrap">
                        <NumberInput
                          label={t("assetRentalAmountLabel")}
                          value={draft.rental.rentAmountMonthly}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              rental: {
                                ...current.rental,
                                rentAmountMonthly:
                                  value === "" || value === null ? "" : String(value),
                              },
                            }))
                          }
                          min={0}
                          error={errors.rentAmountMonthly}
                          disabled={isReadOnly}
                        />
                        <MonthField
                          label={t("assetRentalStartMonthLabel")}
                          value={draft.rental.rentStartMonth}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              rental: { ...current.rental, rentStartMonth: value },
                            }))
                          }
                          error={errors.rentStartMonth}
                          disabled={isReadOnly}
                        />
                        <MonthField
                          label={t("assetRentalEndMonthLabel")}
                          value={draft.rental.rentEndMonth}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              rental: { ...current.rental, rentEndMonth: value },
                            }))
                          }
                          error={errors.rentEndMonth}
                          disabled={isReadOnly}
                        />
                      </Group>
                    )}
                  </Stack>
                </>
              )}

              {overlappingManualItems.length > 0 && (
                <Card withBorder radius="md" padding="sm">
                  <Text size="sm" c="orange">
                    {t("derivedDoubleCountWarning")}
                  </Text>
                </Card>
              )}
            </>
          )}
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
