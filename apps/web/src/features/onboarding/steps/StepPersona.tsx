import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { OnboardingPersona } from "../types";
import { personaLabels } from "../types";

interface StepPersonaProps {
  value?: OnboardingPersona;
  onSelect: (persona: OnboardingPersona) => void;
  error?: string;
}

export default function StepPersona({ value, onSelect, error }: StepPersonaProps) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={4}>你而家係邊種人生階段？</Title>
        <Text size="sm" c="dimmed">
          選一個最接近你目前狀態的描述。
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {(Object.keys(personaLabels) as OnboardingPersona[]).map((persona) => (
          <Card
            key={persona}
            withBorder
            radius="md"
            padding="md"
            onClick={() => onSelect(persona)}
            style={{
              cursor: "pointer",
              borderColor: value === persona ? "#12b886" : undefined,
              backgroundColor: value === persona ? "#e6fcf5" : undefined,
            }}
          >
            <Text fw={600}>{personaLabels[persona]}</Text>
          </Card>
        ))}
      </SimpleGrid>
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
