import React from "react";
import { Badge, List, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";

type ChecklistItem = {
  label: string;
  completed: boolean;
  warning?: string;
};

type Props = {
  items: ChecklistItem[];
};

export default function ReviewStep({ items }: Props) {
  const t = useTranslations("onboardingV3.steps");

  return (
    <Stack>
      <Text fw={600}>{t("review.title")}</Text>
      <List>
        {items.map((item) => (
          <List.Item key={item.label}>
            <Badge color={item.completed ? "green" : "yellow"} mr="xs">
              {item.completed ? t("review.badge.ok") : t("review.badge.todo")}
            </Badge>
            {item.label}
            {!item.completed && item.warning ? ` · ${item.warning}` : ""}
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
