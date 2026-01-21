import PeopleClient from "./PeopleClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ searchParams }: PageProps) {
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : undefined;
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;

  return <PeopleClient scenarioId={scenarioId} initialTab={tab} />;
}
