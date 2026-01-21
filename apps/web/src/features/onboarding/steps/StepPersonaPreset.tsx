"use client";

import { Button, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { OnboardingPersona } from "../../../store/scenarioStore";
import type { PersonaPreset } from "../../../domain/onboarding/personas";

type StepPersonaPresetProps = {
  presets: PersonaPreset[];
  selectedId: OnboardingPersona | null;
  onSelect: (id: OnboardingPersona) => void;
  onSkip: () => void;
  t: (key: string) => string;
};

export default function StepPersonaPreset({
  presets,
  selectedId,
  onSelect,
  onSkip,
  t,
}: StepPersonaPresetProps) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={4}>{t("personaTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("personaDescription")}
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedId;
          return (
            <Card key={preset.id} withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Text fw={600}>{t(preset.titleKey)}</Text>
                <Text size="sm" c="dimmed">
                  {t(preset.descriptionKey)}
                </Text>
                <Button
                  size="xs"
                  variant={isSelected ? "filled" : "light"}
                  onClick={() => onSelect(preset.id)}
                >
                  {isSelected ? t("personaSelected") : t("personaSelect")}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
      <Button variant="subtle" onClick={onSkip}>
        {t("personaSkip")}
      </Button>
    </Stack>
  );
}
