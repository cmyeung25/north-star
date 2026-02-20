import ScenarioAppShellV2 from "./ScenarioAppShellV2";
import { AppSkeleton } from "../../../../../../../src/features/app-shell/app-skeleton";

export default function ScenarioLoading() {
  return (
    <ScenarioAppShellV2 scenarioTitle="" loading>
      <AppSkeleton />
    </ScenarioAppShellV2>
  );
}
