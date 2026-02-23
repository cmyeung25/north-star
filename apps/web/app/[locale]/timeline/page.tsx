// TODO(2026-06-30): Remove this legacy flat-route bridge after clients migrate to canonical /app/case/:caseId/scenario/:scenarioId paths.
import { redirect } from "next/navigation";

type PageProps = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: PageProps) {
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : "";
  const query = new URLSearchParams();
  if (scenarioId) {
    query.set("scenarioId", scenarioId);
  }
  query.set("tab", "timeline");

  const queryString = query.toString();
  redirect(`/${params.locale}/money${queryString ? `?${queryString}` : ""}`);
}
