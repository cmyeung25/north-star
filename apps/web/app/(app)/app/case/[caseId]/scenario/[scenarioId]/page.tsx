import { redirect } from "next/navigation";

type PageProps = {
  params: { caseId: string; scenarioId: string };
};

export default function AppCaseScenarioPage({ params }: PageProps) {
  redirect(`/app/case/${params.caseId}/scenario/${params.scenarioId}/dashboard`);
}
