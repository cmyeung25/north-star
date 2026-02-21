import { NumberInput, Stack, TextInput } from "@mantine/core";
import type { ScenarioDraftV3State } from "../types";

type Props = {
  profile: ScenarioDraftV3State["profile"];
  onChange: (profile: ScenarioDraftV3State["profile"]) => void;
};

export default function ScenarioSetupStep({ profile, onChange }: Props) {
  return (
    <Stack>
      <TextInput
        label="Base currency"
        value={profile.baseCurrency ?? ""}
        onChange={(event) => onChange({ ...profile, baseCurrency: event.currentTarget.value.toUpperCase() })}
      />
      <TextInput
        label="Start month (YYYY-MM)"
        value={profile.startMonth ?? ""}
        onChange={(event) => onChange({ ...profile, startMonth: event.currentTarget.value })}
      />
      <NumberInput
        label="Horizon months"
        min={1}
        value={profile.horizonMonths ?? 0}
        onChange={(value) => onChange({ ...profile, horizonMonths: typeof value === "number" ? value : 360 })}
      />
    </Stack>
  );
}
