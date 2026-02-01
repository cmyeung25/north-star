"use client";

import {
  Badge,
  Card,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { TemplateCategory, TemplateChip, TemplateDef } from "../../src/domain/eventTemplates/types";
import { listTemplates } from "../../src/domain/eventTemplates/registry";

type TemplatePickerProps = {
  opened?: boolean;
  defaultCategory?: TemplateCategory;
  onSelect: (template: TemplateDef) => void;
};

const categoryOrder: TemplateCategory[] = [
  "popular",
  "income",
  "expenses",
  "housing",
  "loans",
  "insurance",
  "assets",
  "adjustments",
];

const resolveChipLabel = (t: ReturnType<typeof useTranslations>, chip: TemplateChip) => {
  switch (chip) {
    case "affectsCashflow":
      return t("templateChipCashflow");
    case "affectsNetWorth":
      return t("templateChipNetWorth");
    case "requiresLiability":
      return t("templateChipRequiresLiability");
    default:
      return chip;
  }
};

const resolveCategoryLabel = (
  t: ReturnType<typeof useTranslations>,
  category: TemplateCategory
) => {
  switch (category) {
    case "popular":
      return t("templatePickerTabPopular");
    case "income":
      return t("templatePickerTabIncome");
    case "expenses":
      return t("templatePickerTabExpenses");
    case "housing":
      return t("templatePickerTabHousing");
    case "loans":
      return t("templatePickerTabLoans");
    case "insurance":
      return t("templatePickerTabInsurance");
    case "assets":
      return t("templatePickerTabAssets");
    case "adjustments":
      return t("templatePickerTabAdjustments");
    default:
      return category;
  }
};

export default function TemplatePicker({
  opened = true,
  defaultCategory = "popular",
  onSelect,
}: TemplatePickerProps) {
  const t = useTranslations("money");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<TemplateCategory>(defaultCategory);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setSearch("");
    setActiveCategory(defaultCategory);
  }, [defaultCategory, opened]);

  const templates = useMemo(() => listTemplates(), []);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (activeCategory === "popular") {
        if (!template.categories.includes("popular")) {
          return false;
        }
      } else if (!template.categories.includes(activeCategory)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const name = t(`templates.${template.id}.name`).toLowerCase();
      const desc = t(`templates.${template.id}.desc`).toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }, [activeCategory, search, t, templates]);

  return (
    <Stack gap="sm">
      <TextInput
        placeholder={t("templatePickerSearchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <Tabs
        value={activeCategory}
        onChange={(value) =>
          setActiveCategory((value as TemplateCategory) ?? "popular")
        }
      >
        <Tabs.List>
          {categoryOrder.map((category) => (
            <Tabs.Tab value={category} key={category}>
              {resolveCategoryLabel(t, category)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {filteredTemplates.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("templatePickerEmpty")}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              withBorder
              radius="md"
              padding="sm"
              onClick={() => onSelect(template)}
              style={{ cursor: "pointer" }}
            >
              <Stack gap={6}>
                <Text fw={600}>{t(`templates.${template.id}.name`)}</Text>
                <Text size="sm" c="dimmed">
                  {t(`templates.${template.id}.desc`)}
                </Text>
                <Stack gap={4}>
                  {template.chips.map((chip) => (
                    <Badge
                      key={`${template.id}-${chip}`}
                      variant="light"
                      color="gray"
                      size="sm"
                    >
                      {resolveChipLabel(t, chip)}
                    </Badge>
                  ))}
                </Stack>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
