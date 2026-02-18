import PlanLabClient from "../../../../../../../../[locale]/plan-lab/PlanLabClient";

const cardStyle = {
  // border: "1px solid #152741",
  // borderRadius: "0.9rem",
  // background: "#0F1D33",
  // color: "#E6F0FF",
  // padding: "1rem",
};

export default function ScenarioPlanLabPage() {
  return (
    <section style={cardStyle}>
      <PlanLabClient />
    </section>
  );
}
