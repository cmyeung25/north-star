import { Button, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import MonthField from "../../../../../components/MonthField";
import { YEAR_MONTH_PLACEHOLDER } from "./monthFieldConstants";
import { nanoid } from "nanoid";
import type { ScenarioMember } from "../../../../store/scenarioStore";

type Props = {
  members: ScenarioMember[];
  onChange: (members: ScenarioMember[]) => void;
};

export default function HouseholdStep({ members, onChange }: Props) {
  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>Household members</Text>
            <Text size="sm" c="dimmed">Add everyone included in this scenario.</Text>
          </Stack>

          <Stack gap="md">
            {members.map((member) => (
              <Card key={member.id} withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>Member details</Text>
                      <Text size="xs" c="dimmed">Name and birth month are used for timeline planning.</Text>
                    </Stack>
                    {members.length > 1 ? (
                      <Button
                        color="red"
                        variant="subtle"
                        aria-label="Remove member"
                        onClick={() => onChange(members.filter((entry) => entry.id !== member.id))}
                      >Remove</Button>
                    ) : null}
                  </Group>

                  <Stack gap="md">
                    <Group grow>
                      <TextInput
                        label="Member name"
                        value={member.name ?? ""}
                        onChange={(event) =>
                          onChange(members.map((entry) => (entry.id === member.id ? { ...entry, name: event.currentTarget.value } : entry)))
                        }
                      />
                      <MonthField
                        label="Birth month"
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
            Add member
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
