import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const panelPath = path.resolve(process.cwd(), "features/planLab/PlanLabPanel.tsx");
const zhPath = path.resolve(process.cwd(), "messages/zh-HK.json");
const enPath = path.resolve(process.cwd(), "messages/en.json");

const requiredOverviewKeys = [
  "planLabExperimentLandingTitle",
  "planLabEventExperimentCreate",
  "planLabEventExperimentBundleHint",
  "planLabEventExperimentDrawerHint",
  "planLabCreateExperimentAction",
  "planLabBundleCreateExperiment",
  "planLabKpiDeltaCompareLabel",
  "planLabKpiDeltaLabel",
  "planLabDecisionTemplatesModeTitle",
  "planLabDecisionTemplateHomePurchaseTitle",
  "planLabDecisionTemplateRentalPlanTitle",
  "planLabDecisionTemplateMortgageRateHikeTitle",
  "planLabDecisionTemplateMoveHomeTitle",
  "planLabDecisionTemplateIncomeShockTitle",
  "planLabDecisionRiskTimingTitle",
  "planLabDecisionNextStepTitle",
  "planLabTemplateApplyAction",
] as const;

describe("PlanLabPanel i18n guardrails", () => {
  it("does not keep hidden sandbox/banner dead code blocks", () => {
    const source = fs.readFileSync(panelPath, "utf8");
    expect(source).not.toContain('display="none"');
  });

  it("does not reintroduce hardcoded visible experiment action copy", () => {
    const source = fs.readFileSync(panelPath, "utf8");
    expect(source).not.toContain("撱箇?撖阡?");
    expect(source).not.toContain("撱箇?蝯?撖阡?");
  });

  it("defines required overview i18n keys in zh-HK and en", () => {
    const zh = JSON.parse(fs.readFileSync(zhPath, "utf8")) as { overview?: Record<string, string> };
    const en = JSON.parse(fs.readFileSync(enPath, "utf8")) as { overview?: Record<string, string> };

    for (const key of requiredOverviewKeys) {
      expect(zh.overview?.[key], `missing zh-HK overview.${key}`).not.toBeUndefined();
      expect(en.overview?.[key], `missing en overview.${key}`).not.toBeUndefined();
    }
  });
});
