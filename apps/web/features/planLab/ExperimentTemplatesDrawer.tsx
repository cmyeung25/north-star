"use client";

import { Button, Card, Drawer, Group, SimpleGrid, Stack, Text } from "@mantine/core";

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

type ExperimentTemplatesDrawerProps = {
  opened: boolean;
  title: string;
  groups: PlanLabExperimentTemplateGroup[];
  onClose: () => void;
  onSelect: (templateId: string) => void;
};

export default function ExperimentTemplatesDrawer({
  opened,
  title,
  groups,
  onClose,
  onSelect,
}: ExperimentTemplatesDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={title}
      position="right"
      size="md"
    >
      <Stack gap="md">
        {groups.map((group) => (
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
      </Stack>
    </Drawer>
  );
}
