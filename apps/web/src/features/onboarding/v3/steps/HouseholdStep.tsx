import { Card, Group, NumberInput, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import MonthField from "../../../../../components/MonthField";
import { YEAR_MONTH_PLACEHOLDER } from "./monthFieldConstants";
import type { ScenarioMember } from "../../../../store/scenarioStore";

type Props = {
  members: ScenarioMember[];
  onChange: (members: ScenarioMember[]) => void;
};

const clampCount = (value: number | null | undefined) => Math.max(0, Math.floor(value ?? 0));

const buildMember = (
  id: string,
  kind: ScenarioMember["kind"],
  existing?: ScenarioMember
): ScenarioMember => ({
  id,
  kind,
  name: existing?.name ?? "",
  birthMonth: existing?.birthMonth,
});

const normalizeHouseholdCounts = (
  current: ScenarioMember[],
  patch: { includePartner?: boolean; childrenCount?: number; petsCount?: number }
): ScenarioMember[] => {
  const existingById = new Map(current.map((member) => [member.id, member]));
  const includePartner =
    patch.includePartner ??
    current.some((member) => member.kind === "person" && member.id === "partner");
  const childrenCount =
    patch.childrenCount !== undefined
      ? clampCount(patch.childrenCount)
      : current.filter((member) => member.kind === "person" && member.id.startsWith("child-")).length;
  const petsCount =
    patch.petsCount !== undefined
      ? clampCount(patch.petsCount)
      : current.filter((member) => member.kind === "pet" && member.id.startsWith("pet-")).length;

  const normalized: ScenarioMember[] = [buildMember("self", "person", existingById.get("self"))];

  if (includePartner) {
    normalized.push(buildMember("partner", "person", existingById.get("partner")));
  }

  for (let index = 1; index <= childrenCount; index += 1) {
    const id = `child-${index}`;
    normalized.push(buildMember(id, "person", existingById.get(id)));
  }

  for (let index = 1; index <= petsCount; index += 1) {
    const id = `pet-${index}`;
    normalized.push(buildMember(id, "pet", existingById.get(id)));
  }

  return normalized;
};

const getMemberTitle = (t: ReturnType<typeof useTranslations>, member: ScenarioMember) => {
  if (member.id === "self") {
    return t("household.memberRole.self");
  }
  if (member.id === "partner") {
    return t("household.memberRole.partner");
  }
  if (member.id.startsWith("child-")) {
    return t("household.memberRole.child", { index: Number(member.id.split("-")[1] ?? 1) });
  }
  if (member.id.startsWith("pet-")) {
    return t("household.memberRole.pet", { index: Number(member.id.split("-")[1] ?? 1) });
  }
  return t("household.memberRole.member");
};

export default function HouseholdStep({ members, onChange }: Props) {
  const t = useTranslations("onboardingV3.steps");
  const includePartner = members.some((member) => member.id === "partner" && member.kind === "person");
  const childrenCount = members.filter((member) => member.kind === "person" && member.id.startsWith("child-")).length;
  const petsCount = members.filter((member) => member.kind === "pet" && member.id.startsWith("pet-")).length;

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("household.title")}</Text>
            <Text size="sm" c="dimmed">{t("household.description")}</Text>
          </Stack>

          <Group grow align="flex-end">
            <Switch
              label={t("household.controls.includePartner")}
              checked={includePartner}
              onChange={(event) =>
                onChange(
                  normalizeHouseholdCounts(members, {
                    includePartner: event.currentTarget.checked,
                  })
                )
              }
            />
            <NumberInput
              label={t("household.controls.childrenCount")}
              min={0}
              step={1}
              allowDecimal={false}
              value={childrenCount}
              onChange={(value) =>
                onChange(
                  normalizeHouseholdCounts(members, {
                    childrenCount: typeof value === "number" ? value : Number(value),
                  })
                )
              }
            />
            <NumberInput
              label={t("household.controls.petsCount")}
              min={0}
              step={1}
              allowDecimal={false}
              value={petsCount}
              onChange={(value) =>
                onChange(
                  normalizeHouseholdCounts(members, {
                    petsCount: typeof value === "number" ? value : Number(value),
                  })
                )
              }
            />
          </Group>

          <Stack gap="md">
            {members.map((member) => (
              <Card key={member.id} withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>{getMemberTitle(t, member)}</Text>
                      <Text size="xs" c="dimmed">{t("household.memberCard.description")}</Text>
                    </Stack>
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
        </Stack>
      </Card>
    </Stack>
  );
}
