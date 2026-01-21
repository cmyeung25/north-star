import { redirect } from "next/navigation";

type PageProps = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: PageProps) {
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : "";
  const query = scenarioId ? `?scenarioId=${scenarioId}` : "";

  redirect(`/${params.locale}/dashboard${query}`);
}
