"use client";

import { Button, Card, Drawer, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

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

type TemplateMode = "add_event" | "modify_baseline_event" | "modify_env";

type ExperimentTemplatesDrawerProps = {
  opened: boolean;
  title: string;
  groups: PlanLabExperimentTemplateGroup[];
  baselineEventOptions?: PlanLabExperimentTemplate[];
  envOptions?: PlanLabExperimentTemplate[];
  onClose: () => void;
  onSelect: (templateId: string) => void;
  onSelectBaselineEvent?: (eventId: string) => void;
  onSelectEnvKey?: (envKey: string) => void;
};

const modeCards: Array<{ id: TemplateMode; title: string; description: string }> = [
  { id: "add_event", title: "新增事件", description: "人生組合與獨立事件模板" },
  { id: "modify_baseline_event", title: "修改基準事件", description: "先選基準事件，再建立實驗" },
  { id: "modify_env", title: "修改環境假設", description: "建立環境假設覆寫實驗" },
];

export default function ExperimentTemplatesDrawer({
  opened,
  title,
  groups,
  baselineEventOptions,
  envOptions,
  onClose,
  onSelect,
  onSelectBaselineEvent,
  onSelectEnvKey,
}: ExperimentTemplatesDrawerProps) {
  const [mode, setMode] = useState<TemplateMode | null>(null);

  useEffect(() => {
    if (!opened) {
      setMode(null);
    }
  }, [opened]);

  const currentTitle = useMemo(() => {
    if (!mode) return title;
    return modeCards.find((card) => card.id === mode)?.title ?? title;
  }, [mode, title]);

  return (
    <Drawer opened={opened} onClose={onClose} title={currentTitle} position="right" size="md">
      <Stack gap="md">
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
                  <Button size="xs" variant="light" onClick={() => setMode(card.id)}>
                    選擇
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
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
                        建立實驗
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
                    建立
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
                    建立
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {mode && (
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setMode(null)}>
              返回類型
            </Button>
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}
