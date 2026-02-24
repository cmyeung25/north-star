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
  assumptions: "global",
  members: "members",
  budget: "budget",
  settings: "data",
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
      : "members";

  return (
    <Stack gap="xl">
      <ScenarioSettingsWorkspace
        scenarioId={scenarioId}
        titleKey="settingsTitle"
        subtitleKey="settingsSubtitle"
        defaultTab={defaultTab}
        tabOrder={["members"]}
        initialAction={initialAdd}
        initialRuleId={initialRuleId}
      />
    </Stack>
  );
}
