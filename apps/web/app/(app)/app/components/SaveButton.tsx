"use client";

import { Button } from "@mantine/core";
import { useTranslations } from "next-intl";

type Props = {
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  label?: string;
};

export default function SaveButton({ disabled, onClick, title, label }: Props) {
  const t = useTranslations("app.shell");

  return (
    <Button
      title={title}
      onClick={onClick}
      disabled={disabled}
      size="sm"
      variant="default"
      styles={{ root: { minHeight: 36, fontWeight: 600 } }}
    >
      {label ?? t("saveToCloud")}
    </Button>
  );
}
