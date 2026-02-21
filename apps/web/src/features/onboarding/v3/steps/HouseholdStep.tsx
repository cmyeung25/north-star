import { Button, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import MonthField from "../../../../../components/MonthField";
import { YEAR_MONTH_PLACEHOLDER } from "./monthFieldConstants";
import { nanoid } from "nanoid";
import type { ScenarioMember } from "../../../../store/scenarioStore";

type Props = {
  members: ScenarioMember[];
  onChange: (members: ScenarioMember[]) => void;
};

export default function HouseholdStep({ members, onChange }: Props) {
  const t = useTranslations("onboardingV3.steps");

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("household.title")}</Text>
            <Text size="sm" c="dimmed">{t("household.description")}</Text>
          </Stack>

          <Stack gap="md">
            {members.map((member) => (
              <Card key={member.id} withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>{t("household.memberCard.title")}</Text>
                      <Text size="xs" c="dimmed">{t("household.memberCard.description")}</Text>
                    </Stack>
                    {members.length > 1 ? (
                      <Button
                        color="red"
                        variant="subtle"
                        aria-label={t("household.actions.removeAria")}
                        onClick={() => onChange(members.filter((entry) => entry.id !== member.id))}
                      >{t("household.actions.remove")}</Button>
                    ) : null}
                  </Group>

                  <Stack gap="md">
                    <Group grow>
                      <TextInput
                        label={t("household.fields.memberName")}
                        value={member.name ?? ""}
                        onChange={(event) =>
                          onChange(members.map((entry) => (entry.id === member.id ? { ...entry, name: event.currentTarget.value } : entry)))
                        }
                      />
                      <MonthField
                        label={t("household.fields.birthMonth")}
                        placeholder={YEAR_MONTH_PLACEHOLDER}
                        value={member.birthMonth ?? ""}
                        onChange={(value) =>
                          onChange(
                            members.map((entry) =>
                              entry.id === member.id ? { ...entry, birthMonth: value } : entry
                            )
                          )
                        }
                      />
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Stack>

          <Button
            variant="light"
            onClick={() => onChange([...members, { id: `member-${nanoid(6)}`, kind: "person", name: "" }])}
          >
            {t("household.actions.add")}
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
