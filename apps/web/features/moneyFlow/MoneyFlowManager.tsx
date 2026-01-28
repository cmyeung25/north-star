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
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";
import { compareMonthKey, isValidMonthKey } from "../../src/utils/monthKey";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import type {
  MoneyItem,
  MoneyItemCadence,
  MoneyItemKind,
  MoneyItemSourceType,
  MoneyItemUpsert,
} from "./types";
import { formatCurrency } from "../../lib/i18n";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import { resolveMoneyItemCategoryLabel, resolveMoneyItemTitle } from "./moneyFlowAdapter";

type MoneyItemDraft = {
  kind: MoneyItemKind;
  cadence: MoneyItemCadence;
  amount: string;
  currency: string;
  category: string;
  memberId: string;
  startMonth: string;
  endMonth: string;
  month: string;
  notes: string;
  source: MoneyItem["source"];
  sourceType: MoneyItemSourceType;
  sourceId?: string;
};

const buildDraft = (
  item: MoneyItem | null,
  defaults: {
    baseCurrency: string;
    defaultKind: MoneyItemKind;
    defaultCadence: MoneyItemCadence;
  }
): MoneyItemDraft => {
  if (!item) {
    return {
      kind: defaults.defaultKind,
      cadence: defaults.defaultCadence,
      amount: "",
      currency: defaults.baseCurrency,
      category: "",
      memberId: "",
      startMonth: "",
      endMonth: "",
      month: "",
      notes: "",
      source: "manual" as const,
      sourceType:
        defaults.defaultKind === "expense" && defaults.defaultCadence === "recurring"
          ? ("budgetRule" as const)
          : ("event" as const),
      sourceId: undefined,
    };
  }

  return {
    kind: item.kind,
    cadence: item.cadence,
    amount: Number.isFinite(item.amount) ? String(item.amount) : "",
    currency: item.currency,
    category: item.category,
    memberId: item.memberId ?? "",
    startMonth: item.startMonth ?? "",
    endMonth: item.endMonth ?? "",
    month: item.month ?? "",
    notes: item.notes ?? "",
    source: item.source,
    sourceType: item.sourceType ?? "event",
    sourceId: item.sourceId,
  };
};

type MoneyFlowManagerProps = {
  items: MoneyItem[];
  baseCurrency: string;
  locale: string;
  members: ScenarioMember[];
  categoryLabels: Map<string, string>;
  categoryOptions: {
    incomeOptions: Array<{ value: string; label: string }>;
    expenseOptions: Array<{ value: string; label: string }>;
    budgetOptions: Array<{ value: string; label: string }>;
  };
  defaultFilters?: Partial<{ kind: MoneyItemKind; cadence: MoneyItemCadence }>;
  defaultNewItem?: { kind: MoneyItemKind; cadence: MoneyItemCadence };
  onUpsert: (item: MoneyItemUpsert) => void;
  onDelete: (item: MoneyItem) => void;
};

export default function MoneyFlowManager({
  items,
  baseCurrency,
  locale,
  members,
  categoryLabels,
  categoryOptions,
  defaultFilters,
  defaultNewItem,
  onUpsert,
  onDelete,
}: MoneyFlowManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  const [filterKind, setFilterKind] = useState<string>(
    defaultFilters?.kind ?? "all"
  );
  const [filterCadence, setFilterCadence] = useState<string>(
    defaultFilters?.cadence ?? "all"
  );
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMember, setFilterMember] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [editingItem, setEditingItem] = useState<MoneyItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const toUpsert = (currentDraft: MoneyItemDraft): MoneyItemUpsert => ({
    ...currentDraft,
    amount: Number(currentDraft.amount),
    memberId: currentDraft.memberId || undefined,
    startMonth: currentDraft.startMonth || undefined,
    endMonth: currentDraft.endMonth || undefined,
    month: currentDraft.month || undefined,
    notes: currentDraft.notes || undefined,
  });

  const { draft, setDraft, errors, validate, reset } = useEntityDraft(
    buildDraft(editingItem, {
      baseCurrency,
      defaultKind: defaultNewItem?.kind ?? "income",
      defaultCadence: defaultNewItem?.cadence ?? "recurring",
    }),
    (currentDraft) => {
      const nextErrors: Record<string, string> = {};
      const amountValue = Number(currentDraft.amount);

      if (!currentDraft.category) {
        nextErrors.category = t("flowFormCategoryRequired");
      }
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        nextErrors.amount = t("flowFormAmountRequired");
      }

      if (currentDraft.cadence === "recurring") {
        if (!isValidMonthKey(currentDraft.startMonth)) {
          nextErrors.startMonth = t("flowFormStartMonthRequired");
        }
        if (currentDraft.endMonth) {
          if (!isValidMonthKey(currentDraft.endMonth)) {
            nextErrors.endMonth = t("flowFormEndMonthInvalid");
          } else if (
            isValidMonthKey(currentDraft.startMonth) &&
            compareMonthKey(currentDraft.startMonth, currentDraft.endMonth) > 0
          ) {
            nextErrors.endMonth = t("flowFormEndMonthInvalid");
          }
        }
      }

      if (currentDraft.cadence === "oneOff") {
        if (!isValidMonthKey(currentDraft.month)) {
          nextErrors.month = t("flowFormMonthRequired");
        }
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
      if (filterKind !== "all" && item.kind !== filterKind) {
        return false;
      }
      if (filterCadence !== "all" && item.cadence !== filterCadence) {
        return false;
      }
      if (filterCategory !== "all" && item.category !== filterCategory) {
        return false;
      }
      if (filterMember !== "all" && item.memberId !== filterMember) {
        return false;
      }
      if (searchValue) {
        const label = resolveMoneyItemTitle(item, categoryLabels).toLowerCase();
        const categoryLabel = resolveMoneyItemCategoryLabel(item.category, categoryLabels).toLowerCase();
        return (
          label.includes(searchValue) ||
          categoryLabel.includes(searchValue) ||
          (item.notes ?? "").toLowerCase().includes(searchValue)
        );
      }
      return true;
    });
  }, [items, filterKind, filterCadence, filterCategory, filterMember, search, categoryLabels]);

  const recurringItems = filteredItems.filter((item) => item.cadence === "recurring");
  const oneOffItems = filteredItems.filter((item) => item.cadence === "oneOff");

  const categoryFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    items.forEach((item) => {
      options.set(item.category, resolveMoneyItemCategoryLabel(item.category, categoryLabels));
    });
    return [
      { value: "all", label: t("flowFilterAll") },
      ...Array.from(options.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [items, categoryLabels, t]);

  const memberOptions = useMemo(
    () => [
      { value: "all", label: t("flowFilterAll") },
      ...members.map((member) => ({ value: member.id, label: member.name })),
    ],
    [members, t]
  );

  const resolveCategoryOptions = (draftSourceType: string, draftKind: MoneyItemKind) => {
    if (draftSourceType === "budgetRule") {
      return categoryOptions.budgetOptions;
    }
    return draftKind === "income"
      ? categoryOptions.incomeOptions
      : categoryOptions.expenseOptions;
  };

  const openDrawer = (item: MoneyItem | null) => {
    setEditingItem(item);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingItem(null);
    reset();
  };
  const closeDeleteDrawer = () => {
    setIsDeleteOpen(false);
    if (!isDrawerOpen) {
      setEditingItem(null);
    }
  };

  const handleSave = () => {
    const result = validate();
    if (!result.isValid || !result.value) {
      return;
    }
    onUpsert(toUpsert(result.value));
    closeDrawer();
  };

  const handleDelete = () => {
    if (!editingItem) {
      return;
    }
    onDelete(editingItem);
    setIsDeleteOpen(false);
    closeDrawer();
  };

  const renderGroup = (groupTitle: string, entries: MoneyItem[]) => {
    if (entries.length === 0) {
      return null;
    }

    return (
      <Stack gap="sm">
        <Text fw={600}>{groupTitle}</Text>
        {entries.map((item) => {
          const label = resolveMoneyItemTitle(item, categoryLabels);
          const categoryLabel = resolveMoneyItemCategoryLabel(item.category, categoryLabels);
          const amountLabel = formatCurrency(item.amount ?? 0, item.currency ?? baseCurrency, locale);
          const memberLabel =
            members.find((member) => member.id === item.memberId)?.name ?? t("flowMemberHousehold");
          const dateLabel =
            item.cadence === "oneOff"
              ? item.month ?? "--"
              : item.endMonth && item.endMonth !== item.startMonth
                ? `${item.startMonth ?? "--"} → ${item.endMonth ?? "--"}`
                : item.startMonth ?? "--";

          return (
            <Card key={item.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={600}>{label}</Text>
                  <Text size="xs" c="dimmed">
                    {categoryLabel} · {memberLabel}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t("flowItemMeta", { amount: amountLabel, month: dateLabel })}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => openDrawer(item)}>
                    {common("actionEdit")}
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => {
                      setEditingItem(item);
                      setIsDeleteOpen(true);
                    }}
                  >
                    {common("actionDelete")}
                  </Button>
                </Group>
              </Group>
            </Card>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Text size="sm" c="dimmed">
          {t("flowManagerHint")}
        </Text>
        <Button size="xs" variant="light" onClick={() => openDrawer(null)}>
          {t("flowManagerAdd")}
        </Button>
      </Group>

      <Stack gap="xs">
        <Group wrap="wrap">
          <Select
            value={filterKind}
            onChange={(value) => setFilterKind(value ?? "all")}
            data={[
              { value: "all", label: t("flowFilterAll") },
              { value: "income", label: t("flowFilterIncome") },
              { value: "expense", label: t("flowFilterExpense") },
            ]}
            placeholder={t("flowFilterKind")}
          />
          <Select
            value={filterCadence}
            onChange={(value) => setFilterCadence(value ?? "all")}
            data={[
              { value: "all", label: t("flowFilterAll") },
              { value: "recurring", label: t("flowFilterRecurring") },
              { value: "oneOff", label: t("flowFilterOneOff") },
            ]}
            placeholder={t("flowFilterCadence")}
          />
          <Select
            value={filterCategory}
            onChange={(value) => setFilterCategory(value ?? "all")}
            data={categoryFilterOptions}
            placeholder={t("flowFilterCategory")}
          />
          <Select
            value={filterMember}
            onChange={(value) => setFilterMember(value ?? "all")}
            data={memberOptions}
            placeholder={t("flowFilterMember")}
          />
        </Group>
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={t("flowFilterSearch")}
        />
      </Stack>

      {filteredItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("flowManagerEmpty")}
        </Text>
      ) : (
        <Stack gap="md">
          {renderGroup(t("flowGroupRecurring"), recurringItems)}
          {renderGroup(t("flowGroupOneOff"), oneOffItems)}
        </Stack>
      )}

      <Drawer
        opened={isDrawerOpen}
        onClose={closeDrawer}
        position="right"
        size="md"
        title={editingItem ? t("flowFormEditTitle") : t("flowFormCreateTitle")}
      >
        <Stack gap="sm">
          <Group grow align="flex-start">
          <Select
            label={t("flowFormKindLabel")}
            value={draft.kind}
            onChange={(value) =>
              value &&
              setDraft((current) => ({
                ...current,
                kind: value as MoneyItemKind,
                sourceType: current.sourceId
                  ? current.sourceType
                  : value === "expense" && current.cadence === "recurring"
                    ? "budgetRule"
                    : "event",
                category: "",
              }))
            }
            data={[
              { value: "income", label: t("flowFilterIncome") },
              { value: "expense", label: t("flowFilterExpense") },
            ]}
            disabled={draft.sourceType === "budgetRule"}
            />
            <Select
              label={t("flowFormCadenceLabel")}
              value={draft.cadence}
              onChange={(value) =>
                value &&
                setDraft((current) => ({
                  ...current,
                  cadence: value as MoneyItemCadence,
                  month:
                    value === "oneOff"
                      ? current.month || current.startMonth
                      : current.month,
                  startMonth:
                    value === "recurring"
                      ? current.startMonth || current.month
                      : current.startMonth,
                  sourceType:
                    current.sourceId
                      ? current.sourceType
                      : current.kind === "expense" && value === "recurring"
                        ? "budgetRule"
                        : "event",
                  category: "",
                }))
              }
              data={[
                { value: "recurring", label: t("flowFilterRecurring") },
                { value: "oneOff", label: t("flowFilterOneOff") },
              ]}
              disabled={draft.sourceType === "budgetRule"}
            />
          </Group>

          <Select
            label={t("flowFormCategoryLabel")}
            value={draft.category}
            onChange={(value) => setDraft((current) => ({ ...current, category: value ?? "" }))}
            data={resolveCategoryOptions(draft.sourceType, draft.kind)}
            error={errors.category}
          />

          <NumberInput
            label={t("flowFormAmountLabel")}
            value={draft.amount}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                amount: value === "" || value === null ? "" : String(value),
              }))
            }
            min={0}
            error={errors.amount}
          />

          <Select
            label={t("flowFormMemberLabel")}
            value={draft.memberId}
            onChange={(value) => setDraft((current) => ({ ...current, memberId: value ?? "" }))}
            data={[
              { value: "", label: t("flowMemberHousehold") },
              ...members.map((member) => ({ value: member.id, label: member.name })),
            ]}
          />

          {draft.cadence === "recurring" ? (
            <Group grow>
              <MonthField
                label={t("flowFormStartMonthLabel")}
                value={draft.startMonth}
                onChange={(value) => setDraft((current) => ({ ...current, startMonth: value }))}
                error={errors.startMonth}
              />
              <MonthField
                label={t("flowFormEndMonthLabel")}
                value={draft.endMonth}
                onChange={(value) => setDraft((current) => ({ ...current, endMonth: value }))}
                error={errors.endMonth}
              />
            </Group>
          ) : (
            <MonthField
              label={t("flowFormMonthLabel")}
              value={draft.month}
              onChange={(value) => setDraft((current) => ({ ...current, month: value }))}
              error={errors.month}
            />
          )}

          <TextInput
            label={t("flowFormNotesLabel")}
            value={draft.notes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, notes: event.currentTarget.value }))
            }
          />

          <Divider />

          <Group justify="space-between">
            {editingItem && (
              <Button color="red" variant="subtle" onClick={() => setIsDeleteOpen(true)}>
                {common("actionDelete")}
              </Button>
            )}
            <Group>
              <Button variant="default" onClick={closeDrawer}>
                {common("actionCancel")}
              </Button>
              <Button onClick={handleSave}>{common("actionSave")}</Button>
            </Group>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={isDeleteOpen}
        onClose={closeDeleteDrawer}
        position="right"
        size="sm"
        title={t("flowDeleteTitle")}
      >
        <Stack gap="md">
          <Text size="sm">{t("flowDeleteBody")}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDeleteDrawer}>
              {common("actionCancel")}
            </Button>
            <Button color="red" onClick={handleDelete}>
              {common("actionDelete")}
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
