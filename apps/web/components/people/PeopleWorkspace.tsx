"use client";

import { Stack } from "@mantine/core";
import ScenarioSettingsWorkspace from "../settings/ScenarioSettingsWorkspace";

type PeopleWorkspaceProps = {
  scenarioId?: string;
  initialTab?: string;
  initialAdd?: string;
  initialRuleId?: string;
};

const tabMap = {
  assumptions: "assumptions",
  members: "members",
  budget: "persistence",
  settings: "persistence",
} as const;

export default function PeopleWorkspace({
  scenarioId,
  initialTab,
  initialAdd,
  initialRuleId,
}: PeopleWorkspaceProps) {
  const defaultTab =
    initialTab && initialTab in tabMap
      ? tabMap[initialTab as keyof typeof tabMap]
      : "assumptions";

  return (
    <Stack gap="xl">
      <ScenarioSettingsWorkspace
        scenarioId={scenarioId}
        titleKey="settingsTitle"
        subtitleKey="settingsSubtitle"
        defaultTab={defaultTab}
        tabOrder={["assumptions", "members", "persistence"]}
        initialAction={initialAdd}
        initialRuleId={initialRuleId}
      />
    </Stack>
  );
}
