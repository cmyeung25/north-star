import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLANNING_HORIZON_YEARS,
  PLANNING_HORIZON_YEARS,
  resolvePlanningHorizonMonths,
} from "../planningHorizon";

describe("planning horizon", () => {
  it("includes 30-year option while keeping 5 years as default", () => {
    expect(PLANNING_HORIZON_YEARS).toEqual([3, 5, 10, 30]);
    expect(DEFAULT_PLANNING_HORIZON_YEARS).toBe(5);
  });

  it("maps supported years to expected months", () => {
    expect(resolvePlanningHorizonMonths(3)).toBe(36);
    expect(resolvePlanningHorizonMonths(5)).toBe(60);
    expect(resolvePlanningHorizonMonths(10)).toBe(120);
    expect(resolvePlanningHorizonMonths(30)).toBe(360);
  });
});
