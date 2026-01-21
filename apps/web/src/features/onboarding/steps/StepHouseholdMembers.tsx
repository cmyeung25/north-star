import {
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
import type { OnboardingMemberDraft } from "../../../domain/onboarding/applyDraft";
import type { OnboardingMemberTemplate } from "../types";

interface StepHouseholdMembersProps {
  members: OnboardingMemberDraft[];
  templates: OnboardingMemberTemplate[];
  errors: Record<string, string>;
  onAddMember: () => void;
  onAddTemplate: (template: OnboardingMemberTemplate) => void;
  onUpdateMember: (id: string, patch: Partial<OnboardingMemberDraft>) => void;
  onRemoveMember: (id: string) => void;
  t: (key: string) => string;
}

const kindOptions = [
  { value: "person", label: "Person" },
  { value: "pet", label: "Pet" },
];

export default function StepHouseholdMembers({
  members,
  templates,
  errors,
  onAddMember,
  onAddTemplate,
  onUpdateMember,
  onRemoveMember,
  t,
}: StepHouseholdMembersProps) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("membersTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("membersDescription")}
        </Text>
      </Stack>

      <Group gap="sm">
        {templates.map((template) => (
          <Button
            key={template.label}
            variant="light"
            onClick={() => onAddTemplate(template)}
          >
            {template.label}
          </Button>
        ))}
        <Button variant="outline" onClick={onAddMember}>
          {t("addMember")}
        </Button>
      </Group>
      {errors.members && (
        <Text size="sm" c="red">
          {errors.members}
        </Text>
      )}

      <Stack gap="md">
        {members.map((member, index) => (
          <Card key={member.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>
                  {t("memberCardTitle")} {index + 1}
                </Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveMember(member.id)}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("memberName")}
                  value={member.name}
                  onChange={(event) =>
                    onUpdateMember(member.id, { name: event.currentTarget.value })
                  }
                  error={errors[`member.${member.id}.name`]}
                />
                <Select
                  label={t("memberKind")}
                  data={kindOptions.map((option) => ({
                    ...option,
                    label: t(option.value === "person" ? "kindPerson" : "kindPet"),
                  }))}
                  value={member.kind}
                  onChange={(value) =>
                    onUpdateMember(member.id, { kind: (value ?? "person") as "person" | "pet" })
                  }
                />
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("birthMonth")}
                  placeholder="YYYY-MM"
                  value={member.birthMonth ?? ""}
                  onChange={(event) =>
                    onUpdateMember(member.id, { birthMonth: event.currentTarget.value })
                  }
                  error={errors[`member.${member.id}.birthMonth`]}
                />
                <NumberInput
                  label={t("ageAtBaseMonth")}
                  min={0}
                  value={member.ageAtBaseMonth ?? ""}
                  onChange={(value) =>
                    onUpdateMember(member.id, { ageAtBaseMonth: Number(value) })
                  }
                  error={errors[`member.${member.id}.ageAtBaseMonth`]}
                />
              </Group>
              <Text size="xs" c="dimmed">
                {t("birthMonthHint")}
              </Text>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
