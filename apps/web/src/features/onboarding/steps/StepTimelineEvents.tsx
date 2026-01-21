import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { EventType } from "@north-star/engine";
import { eventTypes } from "@north-star/engine";
import type {
  OnboardingTimelineEventDraft,
  OnboardingMemberDraft,
} from "../../../domain/onboarding/applyDraft";
import type { OverlapWarning } from "../../../domain/onboarding/overlapDetector";

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
  const eventOptions = eventTypes.map((type) => ({
    value: type,
    label: t(`eventType.${type}`),
  }));

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
                  <NumberInput
                    label={t("monthlyAmount")}
                    min={0}
                    value={event.monthlyAmount ?? 0}
                    onChange={(value) =>
                      onUpdateEvent(event.id, { monthlyAmount: Number(value) })
                    }
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
