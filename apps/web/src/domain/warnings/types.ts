export type WarningSeverity = "info" | "warning";

export type WarningRef = {
  scenarioId?: string;
  memberId?: string;
  eventId?: string;
  ruleId?: string;
  positionId?: string;
  month?: string;
};

export enum WarningCode {
  MonthInvalid = "MONTH_INVALID",
  DoubleCountingHomeEvent = "DOUBLE_COUNTING_HOME_EVENT",
  DoubleCountingPosition = "DOUBLE_COUNTING_POSITION",
  DoubleCountingPlanPatch = "DOUBLE_COUNTING_PLAN_PATCH",
  ApplyScopeMismatch = "APPLY_SCOPE_MISMATCH",
  SalaryLadderInvalid = "SALARY_LADDER_INVALID",
  SmartInvestReserveShortfall = "SMART_INVEST_RESERVE_SHORTFALL",
  InvalidPlanPatch = "INVALID_PLAN_PATCH",
}

export type CompilerWarning = {
  code: WarningCode;
  severity: WarningSeverity;
  messageKey: string;
  defaultMessage: string;
  refs?: WarningRef;
  debug?: Record<string, unknown>;
};
