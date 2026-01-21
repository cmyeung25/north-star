"use client";

import SettingsClient from "../settings/SettingsClient";

type PeopleClientProps = {
  scenarioId?: string;
  initialTab?: string;
  initialAdd?: string;
};

const tabMap = {
  assumptions: "global",
  members: "members",
  budget: "budget",
  settings: "data",
} as const;

export default function PeopleClient({
  scenarioId,
  initialTab,
  initialAdd,
}: PeopleClientProps) {
  const defaultTab =
    initialTab && initialTab in tabMap
      ? tabMap[initialTab as keyof typeof tabMap]
      : "members";

  return (
    <SettingsClient
      scenarioId={scenarioId}
      titleKey="peopleTitle"
      subtitleKey="peopleSubtitle"
      defaultTab={defaultTab}
      tabOrder={["global", "members", "budget", "data", "other"]}
      initialAction={initialAdd}
    />
  );
}
