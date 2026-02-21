import { Button, Card, Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { nanoid } from "nanoid";
import type { PropertyAsset } from "../types";

type Props = {
  assets: PropertyAsset[];
  startMonth: string;
  onChange: (assets: PropertyAsset[]) => void;
};

export default function AssetsStep({ assets, startMonth, onChange }: Props) {
  // NOTE: If month inputs are added in this step, use MonthField + YEAR_MONTH_PLACEHOLDER from ./monthFieldConstants.
  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>Property assets</Text>
            <Text size="sm" c="dimmed">Capture each property and its ongoing cashflow assumptions.</Text>
          </Stack>

          <Stack gap="md">
            {assets.map((asset) => (
              <Card key={asset.id} withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>Property setup</Text>
                      <Text size="xs" c="dimmed">Usage, rent, costs, and mortgage terms.</Text>
                    </Stack>
                    <Button color="red" variant="subtle" onClick={() => onChange(assets.filter((entry) => entry.id !== asset.id))}>
                      Remove
                    </Button>
                  </Group>

                  <Stack gap="md">
                    <TextInput
                      label="Property label"
                      value={asset.label ?? ""}
                      onChange={(event) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, label: event.currentTarget.value } : entry)))}
                    />
                    <Select
                      label="Usage"
                      data={[{ value: "self", label: "Self-use" }, { value: "rent", label: "Rental" }]}
                      value={asset.usage ?? "self"}
                      onChange={(value) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, usage: value as "self" | "rent" } : entry)))}
                    />
                    <Group grow>
                      <NumberInput label="Rent monthly" value={asset.rentMonthly ?? 0} onChange={(v) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, rentMonthly: typeof v === "number" ? v : 0 } : entry)))} />
                      <NumberInput label="Holding cost monthly" value={asset.holdingCostMonthly ?? 0} onChange={(v) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, holdingCostMonthly: typeof v === "number" ? v : 0 } : entry)))} />
                    </Group>
                    <Group grow>
                      <NumberInput label="Mortgage principal" value={asset.mortgagePrincipalOutstanding ?? 0} onChange={(v) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, mortgagePrincipalOutstanding: typeof v === "number" ? v : 0 } : entry)))} />
                      <NumberInput label="Rate %" value={asset.mortgageAnnualInterestRatePct ?? 0} onChange={(v) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, mortgageAnnualInterestRatePct: typeof v === "number" ? v : 0 } : entry)))} />
                      <NumberInput label="Term years" value={asset.mortgageTermYears ?? 0} onChange={(v) => onChange(assets.map((entry) => (entry.id === asset.id ? { ...entry, mortgageTermYears: typeof v === "number" ? v : 0 } : entry)))} />
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Stack>

          <Button
            variant="light"
            onClick={() =>
              onChange([
                ...assets,
                { id: `asset-${nanoid(6)}`, kind: "home", source: "manual", currency: "HKD", startMonth },
              ])
            }
          >
            Add property
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
