"use client";

import { Accordion, Badge, Modal, Stack, Text } from "@mantine/core";

type KpiMetricDetailModalProps = {
  opened: boolean;
  onClose: () => void;
  title: string;
  value: string;
  statusLabel?: string;
  statusColor?: string;
  summary: string;
  actionItems: string[];
  ratingScale: string;
  learnMore: string;
  sectionActionItemsLabel: string;
  sectionRatingScaleLabel: string;
  sectionLearnMoreLabel: string;
};

export default function KpiMetricDetailModal({
  opened,
  onClose,
  title,
  value,
  statusLabel,
  statusColor,
  summary,
  actionItems,
  ratingScale,
  learnMore,
  sectionActionItemsLabel,
  sectionRatingScaleLabel,
  sectionLearnMoreLabel,
}: KpiMetricDetailModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={700} size="xl">
            {value}
          </Text>
          {statusLabel ? (
            <Badge color={statusColor ?? "gray"} variant="light" w="fit-content">
              {statusLabel}
            </Badge>
          ) : null}
          <Text size="sm" c="dimmed">
            {summary}
          </Text>
        </Stack>

        <Accordion variant="contained" radius="md" defaultValue="action-items">
          <Accordion.Item value="action-items">
            <Accordion.Control>{sectionActionItemsLabel}</Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                {actionItems.map((item) => (
                  <Text key={item} size="sm" c="dimmed">
                    • {item}
                  </Text>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="rating-scale">
            <Accordion.Control>{sectionRatingScaleLabel}</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed">
                {ratingScale}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="learn-more">
            <Accordion.Control>{sectionLearnMoreLabel}</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed">
                {learnMore}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Modal>
  );
}
