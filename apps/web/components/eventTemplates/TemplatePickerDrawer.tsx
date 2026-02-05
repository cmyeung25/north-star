"use client";

import { Button, Card, Drawer, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { TemplateCategory, TemplateDef } from "../../src/domain/eventTemplates/types";
import TemplatePicker from "./TemplatePicker";

type CreationIntent = "plan" | "item";
type ItemCategory = "income" | "expenses" | "assets" | "liabilities";

type TemplatePickerDrawerProps = {
  opened: boolean;
  defaultCategory?: TemplateCategory;
  onClose: () => void;
  onSelect: (template: TemplateDef) => void;
  filterTemplates?: (template: TemplateDef) => boolean;
  showIntentScreen?: boolean;
  defaultIntent?: CreationIntent | null;
  defaultItemCategory?: ItemCategory | null;
};

export default function TemplatePickerDrawer({
  opened,
  defaultCategory,
  onClose,
  onSelect,
  filterTemplates,
  showIntentScreen = false,
  defaultIntent = null,
  defaultItemCategory = null,
}: TemplatePickerDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [intent, setIntent] = useState<CreationIntent | null>(defaultIntent);
  const [itemCategory, setItemCategory] = useState<ItemCategory>(
    defaultItemCategory ?? "income"
  );

  useEffect(() => {
    if (!opened || !showIntentScreen) {
      return;
    }
    setIntent(defaultIntent);
    setItemCategory(defaultItemCategory ?? "income");
  }, [defaultIntent, defaultItemCategory, opened, showIntentScreen]);

  const resolvedItemCategory = itemCategory ?? "income";

  const intentFilter = useMemo(() => {
    if (!showIntentScreen || !intent) {
      return filterTemplates ?? null;
    }
    const itemMatches = (template: TemplateDef) => {
      switch (resolvedItemCategory) {
        case "income":
          return template.categories.includes("income");
        case "expenses":
          return template.categories.includes("expenses");
        case "assets":
          return template.categories.includes("assets");
        case "liabilities":
          return template.drawerType === "loan" || template.id === "mortgage_home_purchase";
        default:
          return false;
      }
    };
    return (template: TemplateDef) => {
      if (filterTemplates && !filterTemplates(template)) {
        return false;
      }
      if (intent === "plan") {
        return Boolean(template.isBundle);
      }
      return !template.isBundle && itemMatches(template);
    };
  }, [filterTemplates, intent, resolvedItemCategory, showIntentScreen]);

  const showBackButton = showIntentScreen && intent !== null;
  const drawerTitle = t("templatePickerTitle");
  const isMobile = useMediaQuery("(max-width: 48em)");

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position={isMobile ? "bottom" : "right"}
      size={isMobile ? "88dvh" : "lg"}
      radius={isMobile ? "lg" : undefined}
      title={drawerTitle}
    >
      <Stack gap="sm">
        {!showIntentScreen ? (
          <>
            <Text size="sm" c="dimmed">
              {t("templatePickerHint")}
            </Text>
            <TemplatePicker
              opened={opened}
              defaultCategory={defaultCategory}
              filterTemplates={filterTemplates}
              onSelect={(template) => {
                onSelect(template);
                onClose();
              }}
            />
          </>
        ) : intent === null ? (
          <>
            <Text size="sm" c="dimmed">
              {t("createIntentHint")}
            </Text>
            <Stack gap="sm">
              <Card
                withBorder
                radius="md"
                padding="md"
                component="button"
                type="button"
                onClick={() => setIntent("plan")}
                style={{ textAlign: "left" }}
              >
                <Stack gap={4}>
                  <Text fw={600}>{t("createIntentPlanTitle")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("createIntentPlanDesc")}
                  </Text>
                </Stack>
              </Card>
              <Card
                withBorder
                radius="md"
                padding="md"
                component="button"
                type="button"
                onClick={() => setIntent("item")}
                style={{ textAlign: "left" }}
              >
                <Stack gap={4}>
                  <Text fw={600}>{t("createIntentItemTitle")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("createIntentItemDesc")}
                  </Text>
                </Stack>
              </Card>
            </Stack>
          </>
        ) : (
          <>
            {showBackButton && (
              <Group justify="space-between">
                <Button variant="subtle" size="xs" onClick={() => setIntent(null)}>
                  {common("actionBack")}
                </Button>
              </Group>
            )}
            <Text size="sm" c="dimmed">
              {intent === "plan" ? t("createIntentPlanHint") : t("createIntentItemHint")}
            </Text>
            {intent === "item" && (
              <SegmentedControl
                value={resolvedItemCategory}
                onChange={(value) =>
                  setItemCategory((value as ItemCategory) ?? "income")
                }
                data={[
                  { value: "income", label: t("incomeTitle") },
                  { value: "expenses", label: t("expensesTitle") },
                  { value: "assets", label: t("assetsTitle") },
                  { value: "liabilities", label: t("liabilitiesTitle") },
                ]}
              />
            )}
            <TemplatePicker
              opened={opened}
              defaultCategory={defaultCategory}
              categoryFilter={intent === "plan" ? "life_events" : "all"}
              showCategoryTabs={false}
              filterTemplates={intentFilter ?? filterTemplates}
              onSelect={(template) => {
                onSelect(template);
                onClose();
              }}
            />
          </>
        )}
      </Stack>
    </Drawer>
  );
}
