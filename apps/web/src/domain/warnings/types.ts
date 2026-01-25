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
  ApplyScopeMismatch = "APPLY_SCOPE_MISMATCH",
  SalaryLadderInvalid = "SALARY_LADDER_INVALID",
  SmartInvestReserveShortfall = "SMART_INVEST_RESERVE_SHORTFALL",
}

export type CompilerWarning = {
  code: WarningCode;
  severity: WarningSeverity;
  messageKey: string;
  defaultMessage: string;
  refs?: WarningRef;
  debug?: Record<string, unknown>;
};
