import { redirect } from "next/navigation";
import PeopleWorkspace from "../../../components/people/PeopleWorkspace";
import { scenarioPeoplePath } from "../../../lib/routes/canonicalRoutes";
import { type Locale } from "../../../src/i18n/routing";

type PageProps = {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: PageProps) {
  const caseId = typeof searchParams?.caseId === "string" ? searchParams.caseId : undefined;
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : undefined;
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;
  const add = typeof searchParams?.add === "string" ? searchParams.add : undefined;
  const ruleId = typeof searchParams?.ruleId === "string" ? searchParams.ruleId : undefined;

  if (caseId && scenarioId) {
    const query = new URLSearchParams();
    if (tab) {
      query.set("tab", tab);
    }
    if (add) {
      query.set("add", add);
    }
    if (ruleId) {
      query.set("ruleId", ruleId);
    }

    const pathname = scenarioPeoplePath(caseId, scenarioId, params.locale);
    redirect(`${pathname}${query.size > 0 ? `?${query.toString()}` : ""}`);
  }

  return (
    <PeopleWorkspace
      scenarioId={scenarioId}
      initialTab={tab}
      initialAdd={add}
      initialRuleId={ruleId}
    />
  );
}
