import PeopleWorkspace from '../../../../../../../../../components/people/PeopleWorkspace';

type PageProps = {
  params: { scenarioId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function ScenarioPeoplePage({ params, searchParams }: PageProps) {
  const tab = typeof searchParams?.tab === 'string' ? searchParams.tab : undefined;
  const add = typeof searchParams?.add === 'string' ? searchParams.add : undefined;
  const ruleId = typeof searchParams?.ruleId === 'string' ? searchParams.ruleId : undefined;

  return (
    <section>
      <PeopleWorkspace
        scenarioId={params.scenarioId}
        initialTab={tab}
        initialAdd={add}
        initialRuleId={ruleId}
      />
    </section>
  );
}
