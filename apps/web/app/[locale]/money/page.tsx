import MoneyClient from "./MoneyClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ searchParams }: PageProps) {
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : undefined;
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;
  const add = typeof searchParams?.add === "string" ? searchParams.add : undefined;
  const editEventId =
    typeof searchParams?.editEventId === "string" ? searchParams.editEventId : undefined;
  const editHomeId =
    typeof searchParams?.editHomeId === "string" ? searchParams.editHomeId : undefined;
  const editSmartInvest =
    typeof searchParams?.editSmartInvest === "string"
      ? searchParams.editSmartInvest
      : undefined;
  const showOnboardingBanner =
    typeof searchParams?.onboardingPlaceholders === "string"
      ? searchParams.onboardingPlaceholders === "1"
      : false;
  const showOnboardingSkipped =
    typeof searchParams?.onboardingSkipped === "string"
      ? searchParams.onboardingSkipped === "1"
      : false;

  return (
    <MoneyClient
      scenarioId={scenarioId}
      initialTab={tab}
      initialAdd={add}
      initialEditEventId={editEventId}
      initialEditHomeId={editHomeId}
      initialEditSmartInvest={editSmartInvest}
      initialShowOnboardingBanner={showOnboardingBanner}
      initialShowOnboardingSkipped={showOnboardingSkipped}
    />
  );
}
