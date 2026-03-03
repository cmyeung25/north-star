import { describe, expect, it } from "vitest";
import { buildPlanLabGroups } from "../planLabGrouping";

type Row = {
  id: string;
  title: string;
  category: string;
  memberName?: string;
  startMonth?: string;
  amount?: number;
};

const rows: Row[] = [
  { id: "a", title: "A", category: "income", memberName: "Alex", startMonth: "2026-03", amount: 100 },
  { id: "b", title: "B", category: "income", memberName: "Alex", startMonth: "2026-01", amount: 300 },
  { id: "c", title: "C", category: "expense", memberName: "Bo", startMonth: "2026-02", amount: 200 },
];

describe("buildPlanLabGroups", () => {
  it("buckets by start month for groupBy=timeBucket", () => {
    const grouped = buildPlanLabGroups(rows, "edit", "timeBucket", {
      resolveGroupLabel: ({ item }) => item.startMonth ?? "未設定月份",
      resolveStartMonth: (item) => item.startMonth,
      resolveTitle: (item) => item.title,
    });

    expect(grouped.map(([key]) => key)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("sorts compare mode rows by impact magnitude descending", () => {
    const grouped = buildPlanLabGroups(rows, "compare", "domain", {
      resolveGroupLabel: ({ item }) => item.category,
      resolveImpact: (item) => Math.abs(item.amount ?? 0),
      resolveTitle: (item) => item.title,
    });

    const incomeGroup = grouped.find(([key]) => key === "income");
    expect(incomeGroup?.[1].map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("supports member grouping labels", () => {
    const grouped = buildPlanLabGroups(rows, "edit", "member", {
      resolveGroupLabel: ({ item }) => item.memberName ?? "未指定",
      resolveTitle: (item) => item.title,
    });

    expect(grouped.map(([key]) => key)).toEqual(["Alex", "Bo"]);
  });
});
