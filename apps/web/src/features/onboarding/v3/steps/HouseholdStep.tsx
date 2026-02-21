import { Button, Group, Stack, TextInput } from "@mantine/core";
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
    <Stack>
      {members.map((member) => (
        <Group key={member.id} grow>
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
      ))}
      <Button
        variant="light"
        onClick={() => onChange([...members, { id: `member-${nanoid(6)}`, kind: "person", name: "" }])}
      >
        Add member
      </Button>
    </Stack>
  );
}
