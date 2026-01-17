import {
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

interface StepFamilyProps {
  partnerEnabled: boolean;
  partnerName: string;
  childEnabled: boolean;
  childBirthMonth: string;
  childcareStartAge?: number;
  educationStartAge?: number;
  childcareLevel: "low" | "mid" | "high";
  educationLevel: "low" | "mid" | "high";
  parentEnabled: boolean;
  parentMonthlyCost: number;
  petEnabled: boolean;
  petMonthlyCost: number;
  errors: Record<string, string | undefined>;
  onPartnerToggle: (value: boolean) => void;
  onPartnerNameChange: (value: string) => void;
  onChildToggle: (value: boolean) => void;
  onChildChange: (patch: {
    childBirthMonth?: string;
    childcareStartAge?: number;
    educationStartAge?: number;
    childcareLevel?: "low" | "mid" | "high";
    educationLevel?: "low" | "mid" | "high";
  }) => void;
  onParentToggle: (value: boolean) => void;
  onParentMonthlyCostChange: (value: number) => void;
  onPetToggle: (value: boolean) => void;
  onPetMonthlyCostChange: (value: number) => void;
}

const levelOptions = [
  { label: "低", value: "low" },
  { label: "中", value: "mid" },
  { label: "高", value: "high" },
];

export default function StepFamily({
  partnerEnabled,
  partnerName,
  childEnabled,
  childBirthMonth,
  childcareStartAge,
  educationStartAge,
  childcareLevel,
  educationLevel,
  parentEnabled,
  parentMonthlyCost,
  petEnabled,
  petMonthlyCost,
  errors,
  onPartnerToggle,
  onPartnerNameChange,
  onChildToggle,
  onChildChange,
  onParentToggle,
  onParentMonthlyCostChange,
  onPetToggle,
  onPetMonthlyCostChange,
}: StepFamilyProps) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>家庭成員 / 責任</Title>
        <Text size="sm" c="dimmed">
          這裡會建立 member 與 budget rules（托兒、教育、照顧父母或寵物）。
        </Text>
      </Stack>

      <Stack gap="md">
        <Switch
          label="有伴侶"
          checked={partnerEnabled}
          onChange={(event) => onPartnerToggle(event.currentTarget.checked)}
        />
        {partnerEnabled && (
          <TextInput
            label="伴侶名稱"
            value={partnerName}
            onChange={(event) => onPartnerNameChange(event.currentTarget.value)}
          />
        )}
      </Stack>

      <Stack gap="md">
        <Switch
          label="有／計劃小朋友"
          checked={childEnabled}
          onChange={(event) => onChildToggle(event.currentTarget.checked)}
        />
        {childEnabled && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput
                label="出生月份"
                type="month"
                value={childBirthMonth}
                onChange={(event) =>
                  onChildChange({ childBirthMonth: event.currentTarget.value })
                }
                error={errors.childBirthMonth}
              />
              <NumberInput
                label="托兒開始歲數"
                value={childcareStartAge ?? ""}
                onChange={(value) =>
                  onChildChange({
                    childcareStartAge:
                      typeof value === "number" && !Number.isNaN(value) ? value : 0,
                  })
                }
                min={0}
                error={errors.childcareStartAge}
              />
              <NumberInput
                label="教育開始歲數"
                value={educationStartAge ?? ""}
                onChange={(value) =>
                  onChildChange({
                    educationStartAge:
                      typeof value === "number" && !Number.isNaN(value) ? value : 0,
                  })
                }
                min={0}
                error={errors.educationStartAge}
              />
            </SimpleGrid>
            <Group align="center">
              <Text size="sm" fw={500}>
                托兒成本
              </Text>
              <SegmentedControl
                data={levelOptions}
                value={childcareLevel}
                onChange={(value) =>
                  onChildChange({ childcareLevel: value as "low" | "mid" | "high" })
                }
              />
            </Group>
            <Group align="center">
              <Text size="sm" fw={500}>
                教育成本
              </Text>
              <SegmentedControl
                data={levelOptions}
                value={educationLevel}
                onChange={(value) =>
                  onChildChange({ educationLevel: value as "low" | "mid" | "high" })
                }
              />
            </Group>
          </Stack>
        )}
      </Stack>

      <Stack gap="md">
        <Switch
          label="需要照顧父母"
          checked={parentEnabled}
          onChange={(event) => onParentToggle(event.currentTarget.checked)}
        />
        {parentEnabled && (
          <NumberInput
            label="每月支援金"
            value={Number.isFinite(parentMonthlyCost) ? parentMonthlyCost : 0}
            onChange={(value) => onParentMonthlyCostChange(Number(value ?? 0))}
            min={0}
            thousandSeparator=","
            error={errors.parentMonthlyCost}
          />
        )}
      </Stack>

      <Stack gap="md">
        <Switch
          label="有寵物"
          checked={petEnabled}
          onChange={(event) => onPetToggle(event.currentTarget.checked)}
        />
        {petEnabled && (
          <NumberInput
            label="每月寵物開支"
            value={Number.isFinite(petMonthlyCost) ? petMonthlyCost : 0}
            onChange={(value) => onPetMonthlyCostChange(Number(value ?? 0))}
            min={0}
            thousandSeparator=","
            error={errors.petMonthlyCost}
          />
        )}
      </Stack>
    </Stack>
  );
}
