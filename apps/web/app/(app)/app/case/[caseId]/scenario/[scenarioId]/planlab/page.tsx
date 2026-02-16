import PlanLabClient from "../../../../../../../[locale]/plan-lab/PlanLabClient";

const cardStyle = {
  border: "1px solid #152741",
  borderRadius: "0.9rem",
  background: "#0F1D33",
  color: "#E6F0FF",
  padding: "1rem",
};

export default function ScenarioPlanLabPage() {
  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>情景實驗室</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#95A8C6", fontSize: 13 }}>AURIN card layout · baseline / experiments / KPI / charts</p>
          </div>
          <span style={{ border: "1px solid #2f476d", borderRadius: 999, padding: "0.2rem 0.6rem", fontSize: 12, color: "#95A8C6" }}>草稿</span>
        </div>
      </section>

      <section style={{ ...cardStyle, paddingBottom: "0.6rem" }}>
        <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {[
            "Baseline 檢視器",
            "實驗庫",
            "Impact KPIs",
            "Top Drivers",
            "Chart container",
          ].map((title) => (
            <div key={title} style={{ border: "1px solid #1D3356", borderRadius: "0.7rem", padding: "0.6rem 0.75rem", background: "#152741" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <PlanLabClient />
      </section>
    </div>
  );
}
