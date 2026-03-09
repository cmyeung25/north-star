"use client";

import { Badge, Button, Card, Drawer, Group, SegmentedControl, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { PlanLabDecisionTemplateOption } from "./decisionTemplates";

export type PlanLabExperimentTemplate = {
  id: string;
  title: string;
  description?: string;
  disabled?: boolean;
};

export type PlanLabExperimentTemplateGroup = {
  id: string;
  title: string;
  templates: PlanLabExperimentTemplate[];
};

export type ExperimentTemplatesDrawerLabels = {
  addEventTitle: string;
  addEventDescription: string;
  modifyBaselineTitle: string;
  modifyBaselineDescription: string;
  modifyEnvironmentTitle: string;
  modifyEnvironmentDescription: string;
  decisionTemplateTitle: string;
  decisionTemplateDescription: string;
  chooseActionLabel: string;
  applyLabel: string;
  backLabel: string;
  emptyDecisionTemplatesLabel: string;
  costRangeTitle: string;
  estimateGuideLabel: string;
  conservativeTierLabel: string;
  medianTierLabel: string;
  aggressiveTierLabel: string;
};

type TemplateMode =
  | "add_event"
  | "modify_baseline_event"
  | "modify_env"
  | "decision_template";

type ExperimentTemplatesDrawerProps = {
  opened: boolean;
  title: string;
  labels: ExperimentTemplatesDrawerLabels;
  groups: PlanLabExperimentTemplateGroup[];
  baselineEventOptions?: PlanLabExperimentTemplate[];
  envOptions?: PlanLabExperimentTemplate[];
  decisionTemplates?: PlanLabDecisionTemplateOption[];
  onClose: () => void;
  onSelect: (templateId: string) => void;
  onSelectDecisionTemplate?: (templateId: PlanLabDecisionTemplateOption["id"]) => void;
  onSelectDecisionTemplateCostProfile?: (
    templateId: PlanLabDecisionTemplateOption["id"],
    tier: PlanLabDecisionTemplateOption["selectedCostProfile"]
  ) => void;
  onSelectAddEvent?: () => void;
  onSelectBaselineEvent?: (eventId: string) => void;
  onSelectEnvKey?: (envKey: string) => void;
  withinPortal?: boolean;
};

export default function ExperimentTemplatesDrawer({
  opened,
  title,
  labels,
  groups,
  baselineEventOptions,
  envOptions,
  decisionTemplates,
  onClose,
  onSelect,
  onSelectDecisionTemplate,
  onSelectDecisionTemplateCostProfile,
  onSelectAddEvent,
  onSelectBaselineEvent,
  onSelectEnvKey,
  withinPortal = true,
}: ExperimentTemplatesDrawerProps) {
  const [mode, setMode] = useState<TemplateMode | null>(null);

  useEffect(() => {
    if (!opened) {
      setMode(null);
    }
  }, [opened]);

  const modeCards: Array<{ id: TemplateMode; title: string; description: string }> = useMemo(
    () => [
      {
        id: "decision_template",
        title: labels.decisionTemplateTitle,
        description: labels.decisionTemplateDescription,
      },
      {
        id: "add_event",
        title: labels.addEventTitle,
        description: labels.addEventDescription,
      },
      {
        id: "modify_baseline_event",
        title: labels.modifyBaselineTitle,
        description: labels.modifyBaselineDescription,
      },
      {
        id: "modify_env",
        title: labels.modifyEnvironmentTitle,
        description: labels.modifyEnvironmentDescription,
      },
    ],
    [labels]
  );

  const currentTitle = useMemo(() => {
    if (!mode) return title;
    return modeCards.find((card) => card.id === mode)?.title ?? title;
  }, [mode, modeCards, title]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={currentTitle}
      position="right"
      size="md"
      withinPortal={withinPortal}
      styles={{
        body: {
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        },
      }}
    >
      <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
        {!mode && (
          <SimpleGrid cols={{ base: 1, sm: 1 }} spacing="sm">
            {modeCards.map((card) => (
              <Card key={card.id} withBorder radius="md" p="sm">
                <Stack gap={6}>
                  <Text fw={600} size="sm">
                    {card.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {card.description}
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => {
                      if (card.id === "add_event") {
                        onClose();
                        onSelectAddEvent?.();
                        return;
                      }
                      setMode(card.id);
                    }}
                  >
                    {labels.chooseActionLabel}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {mode === "decision_template" && (
          <Stack gap="sm">
            {(decisionTemplates ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">
                {labels.emptyDecisionTemplatesLabel}
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {(decisionTemplates ?? []).map((template) => (
                  <Card key={template.id} withBorder radius="md" p="sm">
                    <Stack gap={6}>
                      <Text fw={600} size="sm">
                        {template.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {template.description}
                      </Text>
                      {template.costRangeItems.length > 0 ? (
                        <Stack gap={6}>
                          <Group justify="space-between" align="center" wrap="nowrap">
                            <Text size="xs" fw={600}>
                              {labels.costRangeTitle}
                            </Text>
                            <Tooltip label={template.estimateGuide} multiline w={220}>
                              <Badge variant="light">{labels.estimateGuideLabel}</Badge>
                            </Tooltip>
                          </Group>
                          <SegmentedControl
                            size="xs"
                            value={template.selectedCostProfile}
                            data={[
                              { label: labels.conservativeTierLabel, value: "conservative" },
                              { label: labels.medianTierLabel, value: "median" },
                              { label: labels.aggressiveTierLabel, value: "aggressive" },
                            ]}
                            onChange={(value) =>
                              onSelectDecisionTemplateCostProfile?.(
                                template.id,
                                value as PlanLabDecisionTemplateOption["selectedCostProfile"]
                              )
                            }
                          />
                          {template.costRangeItems.map((item) => (
                            <Stack key={item.id} gap={2}>
                              <Text size="xs" fw={500}>
                                {item.label}: {item.values[template.selectedCostProfile]}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {item.factorHint}
                              </Text>
                            </Stack>
                          ))}
                        </Stack>
                      ) : null}
                      {template.availability.enabled === false && template.availability.reasonFallback ? (
                        <Text size="xs" c="orange">
                          {template.availability.reasonFallback}
                        </Text>
                      ) : null}
                      <Button
                        size="xs"
                        variant="light"
                        disabled={template.availability.enabled === false}
                        onClick={() => onSelectDecisionTemplate?.(template.id)}
                      >
                        {labels.applyLabel}
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        )}

        {mode === "add_event" &&
          groups.map((group) => (
            <Stack key={group.id} gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{group.title}</Text>
                <Text size="xs" c="dimmed">
                  {group.templates.length}
                </Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {group.templates.map((template) => (
                  <Card key={template.id} withBorder radius="md" p="sm">
                    <Stack gap={6}>
                      <Text fw={600} size="sm">
                        {template.title}
                      </Text>
                      {template.description && (
                        <Text size="xs" c="dimmed">
                          {template.description}
                        </Text>
                      )}
                      <Button
                        size="xs"
                        variant="light"
                        disabled={template.disabled}
                        onClick={() => onSelect(template.id)}
                      >
                        {labels.applyLabel}
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            </Stack>
          ))}

        {mode === "modify_baseline_event" && (
          <Stack gap="sm">
            {(baselineEventOptions ?? []).map((event) => (
              <Card key={event.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Stack gap={4}>
                    <Text fw={600} size="sm">
                      {event.title}
                    </Text>
                    {event.description ? (
                      <Text size="xs" c="dimmed">
                        {event.description}
                      </Text>
                    ) : null}
                  </Stack>
                  <Button
                    size="xs"
                    variant="light"
                    disabled={event.disabled}
                    onClick={() => onSelectBaselineEvent?.(event.id)}
                  >
                    {labels.applyLabel}
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {mode === "modify_env" && (
          <Stack gap="sm">
            {(envOptions ?? []).map((env) => (
              <Card key={env.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Stack gap={4}>
                    <Text fw={600} size="sm">
                      {env.title}
                    </Text>
                    {env.description ? (
                      <Text size="xs" c="dimmed">
                        {env.description}
                      </Text>
                    ) : null}
                  </Stack>
                  <Button size="xs" variant="light" onClick={() => onSelectEnvKey?.(env.id)}>
                    {labels.applyLabel}
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {mode && (
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setMode(null)}>
              {labels.backLabel}
            </Button>
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}
