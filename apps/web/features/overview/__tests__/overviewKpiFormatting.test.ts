import { describe, expect, it } from "vitest";

import {
  formatNullableCurrencyKpiValue,
  resolveNullableMetricScoreStatus,
} from "../overviewKpiFormatting";

describe("overviewKpiFormatting", () => {
  describe("formatNullableCurrencyKpiValue", () => {
    it("returns empty label for null values", () => {
      expect(
        formatNullableCurrencyKpiValue({
          value: null,
          currency: "HKD",
          locale: "zh-HK",
          emptyValueLabel: "--",
          monthLabel: "month",
        })
      ).toBe("--");
    });

    it("formats zero values as currency", () => {
      expect(
        formatNullableCurrencyKpiValue({
          value: 0,
          currency: "HKD",
          locale: "zh-HK",
          emptyValueLabel: "--",
          monthLabel: "month",
        })
      ).toContain("0");
    });

    it("formats negative values as currency", () => {
      const value = formatNullableCurrencyKpiValue({
        value: -1200,
        currency: "HKD",
        locale: "zh-HK",
        emptyValueLabel: "--",
      });

      expect(value).toContain("1,200");
      expect(value).toContain("-");
    });
  });

  describe("resolveNullableMetricScoreStatus", () => {
    it("forces no-data when nullable KPI value is null", () => {
      expect(
        resolveNullableMetricScoreStatus(
          "avgNetCashflow",
          "excellent",
          { avgNetCashflow: null }
        )
      ).toBe("no-data");
    });

    it("keeps original status for zero and negative values", () => {
      expect(
        resolveNullableMetricScoreStatus(
          "avgNonSalaryIncome",
          "progressing",
          { avgNonSalaryIncome: 0 }
        )
      ).toBe("progressing");

      expect(
        resolveNullableMetricScoreStatus(
          "avgFunBudget",
          "vulnerable",
          { avgFunBudget: -1 }
        )
      ).toBe("vulnerable");
    });
  });
});
