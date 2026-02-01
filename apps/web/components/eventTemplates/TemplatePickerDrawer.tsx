"use client";

import { Drawer, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { TemplateCategory, TemplateDef } from "../../src/domain/eventTemplates/types";
import TemplatePicker from "./TemplatePicker";

type TemplatePickerDrawerProps = {
  opened: boolean;
  defaultCategory?: TemplateCategory;
  onClose: () => void;
  onSelect: (template: TemplateDef) => void;
};

export default function TemplatePickerDrawer({
  opened,
  defaultCategory,
  onClose,
  onSelect,
}: TemplatePickerDrawerProps) {
  const t = useTranslations("money");

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={t("templatePickerTitle")}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {t("templatePickerHint")}
        </Text>
        <TemplatePicker
          opened={opened}
          defaultCategory={defaultCategory}
          onSelect={(template) => {
            onSelect(template);
            onClose();
          }}
        />
      </Stack>
    </Drawer>
  );
}
