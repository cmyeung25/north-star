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
  query.set("tab", "settings");

  const queryString = query.toString();
  redirect(`/${params.locale}/people${queryString ? `?${queryString}` : ""}`);
}
