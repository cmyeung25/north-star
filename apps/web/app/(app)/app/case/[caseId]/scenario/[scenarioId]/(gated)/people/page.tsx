import { redirect } from "next/navigation";

type PageProps = {
  params: { caseId: string; scenarioId: string };
};

export default function LegacyScenarioPeoplePage({ params }: PageProps) {
  redirect(`/app/case/${params.caseId}/scenario/${params.scenarioId}/setting`);
}
