import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { EventType } from "@north-star/engine";
import { useEffect, useMemo, useState } from "react";
import type {
  OnboardingTimelineEventDraft,
  OnboardingMemberDraft,
} from "../../../domain/onboarding/applyDraft";
import type { OverlapWarning } from "../../../domain/onboarding/overlapDetector";
import {
  ONBOARDING_EVENT_TYPES,
  getEventTypeLabel,
} from "../../../domain/events/eventTypeLabels";

interface StepTimelineEventsProps {
  events: OnboardingTimelineEventDraft[];
  members: OnboardingMemberDraft[];
  warnings: OverlapWarning[];
  errors: Record<string, string>;
  onAddEvent: () => void;
  onUpdateEvent: (id: string, patch: Partial<OnboardingTimelineEventDraft>) => void;
  onRemoveEvent: (id: string) => void;
  t: (key: string) => string;
}

export default function StepTimelineEvents({
  events,
  members,
  warnings,
  errors,
  onAddEvent,
  onUpdateEvent,
  onRemoveEvent,
  t,
}: StepTimelineEventsProps) {
  const memberOptions = [
    { value: "household", label: t("householdShared") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ];
  const [amountBasisByEventId, setAmountBasisByEventId] = useState<
    Record<string, "monthly" | "yearly">
  >({});

  useEffect(() => {
    setAmountBasisByEventId((current) => {
      const next = { ...current };
      events.forEach((event) => {
        if (!next[event.id]) {
          next[event.id] = "monthly";
        }
      });
      Object.keys(next).forEach((eventId) => {
        if (!events.some((event) => event.id === eventId)) {
          delete next[eventId];
        }
      });
      return next;
    });
  }, [events]);

  const eventOptions = useMemo(() => {
    const extraTypes = events
      .map((event) => event.type)
      .filter((type) => !ONBOARDING_EVENT_TYPES.includes(type));
    const uniqueTypes = Array.from(new Set([...ONBOARDING_EVENT_TYPES, ...extraTypes]));
    return uniqueTypes.map((type) => ({
      value: type,
      label: getEventTypeLabel(type, t),
    }));
  }, [events, t]);

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("timelineTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("timelineDescription")}
        </Text>
      </Stack>

      <Button variant="outline" onClick={onAddEvent}>
        {t("addEvent")}
      </Button>

      <Stack gap="md">
        {events.map((event) => {
          const eventWarnings = warnings.filter((warning) => warning.eventId === event.id);
          return (
            <Card key={event.id} withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{event.title || t("timelineItem")}</Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => onRemoveEvent(event.id)}
                  >
                    {t("remove")}
                  </Button>
                </Group>
                {eventWarnings.length > 0 && (
                  <Group gap="xs">
                    {eventWarnings.map((warning) => (
                      <Badge key={warning.id} color="orange" variant="light">
                        {t(warning.messageKey)}
                      </Badge>
                    ))}
                  </Group>
                )}
                <Group grow align="flex-start">
                  <TextInput
                    label={t("eventName")}
                    value={event.title}
                    onChange={(e) =>
                      onUpdateEvent(event.id, { title: e.currentTarget.value })
                    }
                    error={errors[`event.${event.id}.title`]}
                  />
                  <Select
                    label={t("eventType")}
                    data={eventOptions}
                    value={event.type}
                    onChange={(value) =>
                      onUpdateEvent(event.id, {
                        type: (value ?? "custom") as EventType,
                      })
                    }
                  />
                </Group>
                {!ONBOARDING_EVENT_TYPES.includes(event.type) && (
                  <Text size="xs" c="orange">
                    {t("eventTypeUnsupported")}
                  </Text>
                )}
                <Group grow align="flex-start">
                  <Select
                    label={t("belongsTo")}
                    data={memberOptions}
                    value={event.memberId ?? ""}
                    onChange={(value) => onUpdateEvent(event.id, { memberId: value })}
                    error={errors[`event.${event.id}.memberId`]}
                  />
                  <TextInput
                    label={t("startMonth")}
                    placeholder="YYYY-MM"
                    value={event.startMonth ?? ""}
                    onChange={(e) =>
                      onUpdateEvent(event.id, { startMonth: e.currentTarget.value })
                    }
                    error={errors[`event.${event.id}.startMonth`]}
                  />
                  <TextInput
                    label={t("endMonth")}
                    placeholder="YYYY-MM"
                    value={event.endMonth ?? ""}
                    onChange={(e) =>
                      onUpdateEvent(event.id, { endMonth: e.currentTarget.value })
                    }
                    error={errors[`event.${event.id}.endMonth`]}
                  />
                </Group>
                <Group grow align="flex-start">
                  <Stack gap="xs">
                    <Text size="sm">{t("eventAmountBasis")}</Text>
                    <SegmentedControl
                      data={[
                        { value: "monthly", label: t("amountBasisMonthly") },
                        { value: "yearly", label: t("amountBasisYearly") },
                      ]}
                      value={amountBasisByEventId[event.id] ?? "monthly"}
                      onChange={(value) =>
                        setAmountBasisByEventId((current) => ({
                          ...current,
                          [event.id]: value as "monthly" | "yearly",
                        }))
                      }
                    />
                  </Stack>
                  <NumberInput
                    label={t("monthlyAmount")}
                    min={0}
                    value={
                      (amountBasisByEventId[event.id] ?? "monthly") === "yearly"
                        ? (event.monthlyAmount ?? 0) * 12
                        : event.monthlyAmount ?? 0
                    }
                    onChange={(value) => {
                      const nextValue = typeof value === "number" ? value : 0;
                      const basis = amountBasisByEventId[event.id] ?? "monthly";
                      onUpdateEvent(event.id, {
                        monthlyAmount: basis === "yearly" ? nextValue / 12 : nextValue,
                      });
                    }}
                    error={errors[`event.${event.id}.monthlyAmount`]}
                  />
                  <NumberInput
                    label={t("oneTimeAmount")}
                    min={0}
                    value={event.oneTimeAmount ?? 0}
                    onChange={(value) =>
                      onUpdateEvent(event.id, { oneTimeAmount: Number(value) })
                    }
                    error={errors[`event.${event.id}.oneTimeAmount`]}
                  />
                </Group>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
