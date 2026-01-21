"use client";

import SettingsClient from "../settings/SettingsClient";

type PeopleClientProps = {
  scenarioId?: string;
};

export default function PeopleClient({ scenarioId }: PeopleClientProps) {
  return (
    <SettingsClient
      scenarioId={scenarioId}
      titleKey="peopleTitle"
      subtitleKey="peopleSubtitle"
      defaultTab="members"
      tabOrder={["members", "global", "budget", "other", "data"]}
    />
  );
}
