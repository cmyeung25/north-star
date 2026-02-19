import { Stack } from "@mantine/core";
import OverviewClient from "../../../../../../../../[locale]/overview/OverviewClient";

export default function ScenarioDashboardPage() {
  return (
    <Stack component="section" gap="lg" px="sm" py="xs">
      <OverviewClient />
    </Stack>
  );
}
