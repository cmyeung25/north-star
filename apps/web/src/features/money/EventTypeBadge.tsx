"use client";

import React from "react";
import { Badge, Group } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";

type Props = {
  event: ScenarioEvent;
  growthLabel?: string | null;
};

const resolveEventTypeLabel = (
  event: ScenarioEvent,
  t: ReturnType<typeof useTranslations>
) => {
  if (event.type === "housing") {
    return event.kind === "rent" ? t("eventTypeRent") : t("eventTypeMortgage");
  }
  if (event.type === "loan") {
    if (event.loanKind === "car") return t("eventTypeCarLoan");
    if (event.loanKind === "credit") return t("eventTypeCreditCard");
    return t("eventTypeLoan");
  }
  if (event.type === "insurance") {
    return t("eventTypeInsurance");
  }
  if (event.type === "adjustment") {
    return t("eventTypeAdjustment");
  }
  if (event.type === "cashflow") {
    if (event.kind === "income") {
      return t("eventTypeIncome");
    }
    const tag = event.tags?.[0]?.toLowerCase();
    if (tag === "rent" || tag === "housing") return t("eventTypeRent");
    if (tag === "insurance") return t("eventTypeInsurance");
    if (tag === "childcare") return t("eventTypeChildcare");
    return t("eventTypeExpense");
  }
  return t("eventTypeExpense");
};

export default function EventTypeBadge({ event, growthLabel }: Props) {
  const t = useTranslations("money");
  return (
    <Group gap={6} wrap="wrap">
      <Badge variant="light" color="gray" size="sm">
        {resolveEventTypeLabel(event, t)}
      </Badge>
      {growthLabel ? (
        <Badge variant="light" color="blue" size="sm">
          {growthLabel}
        </Badge>
      ) : null}
    </Group>
  );
}
