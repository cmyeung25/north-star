import PlanLabClient from "../../../../../../../../[locale]/plan-lab/PlanLabClient";
import { resolveWorkspaceMode } from "../../../../../../../../../lib/scenario/lifecycle";

const cardStyle = {
  // border: "1px solid #152741",
  // borderRadius: "0.9rem",
  // background: "#0F1D33",
  // color: "#E6F0FF",
  // padding: "1rem",
};

export default function ScenarioPlanLabPage() {
  const workspaceMode = resolveWorkspaceMode("/app/case/[caseId]/scenario/[scenarioId]/planlab");

  return (
    <section data-workspace-mode={workspaceMode} style={cardStyle}>
      <PlanLabClient />
    </section>
  );
}
