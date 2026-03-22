import type { PlanLabDecisionTemplateId } from "./types";

const PLAN_LAB_DECISION_TEMPLATE_IDS: PlanLabDecisionTemplateId[] = [
  "marriage",
  "childbirth",
  "parenting",
  "home_purchase",
  "rental_plan",
  "mortgage_rate_hike",
  "move_home",
  "retirement",
  "income_shock",
];

const isPlanLabDecisionTemplateId = (
  value: string | null | undefined
): value is PlanLabDecisionTemplateId =>
  typeof value === "string" &&
  PLAN_LAB_DECISION_TEMPLATE_IDS.includes(value as PlanLabDecisionTemplateId);

export const parsePlanLabRouteEntry = (params: {
  openDecisionTemplates?: string | null;
  decisionTemplate?: string | null;
}) => {
  const decisionTemplateId = isPlanLabDecisionTemplateId(params.decisionTemplate)
    ? params.decisionTemplate
    : null;

  return {
    openDecisionTemplates:
      params.openDecisionTemplates === "1" || decisionTemplateId !== null,
    decisionTemplateId,
  };
};
