import { describe, expect, it } from "vitest";
import { listTemplates } from "../registry";
import { buildTemplateDrawerDraftOverrides, getTemplatePreset } from "../presets";
import { templateIds } from "../types";

describe("event templates registry", () => {
  it("returns 19 templates with matching ids", () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(19);
    expect(templates.map((template) => template.id)).toEqual(templateIds);
  });

  it("maps every template to a drawer type", () => {
    templateIds.forEach((id) => {
      const preset = getTemplatePreset(id);
      expect(preset.drawerType).not.toBeUndefined();
    });
  });

  it("builds salary template cashflow defaults with month keys", () => {
    const draft = buildTemplateDrawerDraftOverrides("monthly_salary", {
      baseMonth: "2024-01",
      label: "Monthly salary",
    });
    expect(draft.drawerType).toBe("cashflow");
    expect(draft.cashflow?.kind).toBe("income");
    expect(draft.cashflow?.cadence).toBe("monthly");
    expect(draft.cashflow?.startMonth).toBe("2024-01");
  });
});
