"use client";

import type { TemplateCategory, TemplateDef } from "../../src/domain/eventTemplates/types";
import TemplatePickerDrawer from "../eventTemplates/TemplatePickerDrawer";

export type AddFlowMode = "money" | "planlab";
export type AddFlowIntent = "plan" | "item";
export type AddFlowItemCategory = "income" | "expenses" | "assets" | "liabilities";

type AddFlowDrawerProps = {
  opened: boolean;
  mode: AddFlowMode;
  onClose: () => void;
  onSelect: (template: TemplateDef) => void;
  defaultCategory?: TemplateCategory;
  defaultIntent?: AddFlowIntent | null;
  defaultItemCategory?: AddFlowItemCategory | null;
  filterTemplates?: (template: TemplateDef) => boolean;
};

export default function AddFlowDrawer({
  opened,
  mode,
  onClose,
  onSelect,
  defaultCategory,
  defaultIntent = null,
  defaultItemCategory = null,
  filterTemplates,
}: AddFlowDrawerProps) {
  return (
    <TemplatePickerDrawer
      opened={opened}
      defaultCategory={defaultCategory}
      showIntentScreen
      defaultIntent={defaultIntent}
      defaultItemCategory={defaultItemCategory}
      onClose={onClose}
      onSelect={onSelect}
      filterTemplates={filterTemplates}
      key={mode}
    />
  );
}
