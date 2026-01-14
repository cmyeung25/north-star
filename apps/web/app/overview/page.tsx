import OverviewClient from "./OverviewClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ searchParams }: PageProps) {
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : undefined;

  return <OverviewClient scenarioId={scenarioId} />;
}
