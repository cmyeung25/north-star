import type {
  ScenarioAssumptions,
  ScenarioAsset,
  ScenarioClientComputed,
  ScenarioLiability,
  ScenarioMember,
  ScenarioMeta,
} from "../../store/scenarioStore";
import type { ScenarioEvent, ScenarioEventDraft } from "../scenarioV2/events";
import { compileScenarioCreatePayload } from "./compile";
import type { CompileScenarioContext } from "./compile";
import type { ScenarioDraft, ValidationIssue } from "./types";
import { recordScenarioMigrationEvent } from "../../lib/telemetry/scenarioMigrationTelemetry";
import { isMigrationProtectionEnabled } from "../../lib/featureFlags";
import { detectDuplicateScenarioEventWarnings } from "../warnings/duplicateCashflowGuardrails";
import { WarningCode } from "../warnings/types";

export type ScenarioDraftSource = "onboarding" | "seed" | "plan-lab";

export type SubmitScenarioDraftInput = {
  source: ScenarioDraftSource;
  target: {
    scenarioId: string;
  };
  draft: {
    assumptions?: Partial<ScenarioAssumptions>;
    members?: ScenarioMember[];
    assets?: ScenarioAsset[];
    liabilities?: ScenarioLiability[];
    events?: Array<ScenarioEvent | ScenarioEventDraft>;
    meta?: Partial<ScenarioMeta>;
    clientComputed?: Partial<ScenarioClientComputed>;
    baseCurrency?: string;
  };
  context?: CompileScenarioContext;
  persistence?: {
    applyStore?: (payload: SubmitScenarioDraftPayload) => void;
  };
};

export type SubmitScenarioDraftPayload = {
  assumptions: ScenarioAssumptions;
  members: ScenarioMember[];
  assets: ScenarioAsset[];
  liabilities: ScenarioLiability[];
  events: ScenarioEvent[];
  meta: ScenarioMeta;
  clientComputed: ScenarioClientComputed;
  baseCurrency: string;
};

export type SubmitScenarioDraftIssue = ValidationIssue;

export type SubmitScenarioDraftResult = {
  source: ScenarioDraftSource;
  scenarioId: string;
  ok: boolean;
  payload: SubmitScenarioDraftPayload;
  errors: SubmitScenarioDraftIssue[];
  warnings: SubmitScenarioDraftIssue[];
};

const toCompilerDraft = (draft: SubmitScenarioDraftInput["draft"]): ScenarioDraft => ({
  assumptions: draft.assumptions,
  members: draft.members,
  assets: draft.assets,
  liabilities: draft.liabilities,
  events: draft.events,
  meta: draft.meta,
  clientComputed: draft.clientComputed,
  baseCurrency: draft.baseCurrency,
});

export const submitScenarioDraft = (
  input: SubmitScenarioDraftInput
): SubmitScenarioDraftResult => {
  const migrationProtectionEnabled = isMigrationProtectionEnabled(input.source);

  if (migrationProtectionEnabled) {
    recordScenarioMigrationEvent({
      name: "scenario_submission_source",
      ts: new Date().toISOString(),
      scenarioId: input.target.scenarioId,
      source: input.source,
    });
  }

  const compiled = compileScenarioCreatePayload(
    toCompilerDraft(input.draft),
    {
      ...(input.context ?? {}),
      lifecycleSource: input.source,
    }
  );

  const payload: SubmitScenarioDraftPayload = {
    assumptions: compiled.assumptions,
    members: compiled.members,
    assets: compiled.assets,
    liabilities: compiled.liabilities,
    events: compiled.events,
    meta: compiled.meta,
    clientComputed: compiled.clientComputed,
    baseCurrency: compiled.baseCurrency,
  };

  const errors = [...compiled.validationIssues];
  const warnings: SubmitScenarioDraftIssue[] = detectDuplicateScenarioEventWarnings(
    compiled.events
  ).flatMap((warning) => {
    if (
      warning.code !== WarningCode.DuplicateMortgageCashflow &&
      warning.code !== WarningCode.RentalIncomeDuplicated
    ) {
      return [];
    }
    return [
      {
        code: warning.code,
        field: warning.refs?.eventId ? `events.${warning.refs.eventId}` : "events",
        message: warning.defaultMessage,
      },
    ];
  });

  if (migrationProtectionEnabled && errors.length > 0) {
    recordScenarioMigrationEvent({
      name: "scenario_draft_compile_failed",
      ts: new Date().toISOString(),
      scenarioId: input.target.scenarioId,
      source: input.source,
      details: {
        errorCount: errors.length,
      },
    });
  }

  if (errors.length === 0) {
    input.persistence?.applyStore?.(payload);
  }

  return {
    source: input.source,
    scenarioId: input.target.scenarioId,
    ok: errors.length === 0,
    payload,
    errors,
    warnings,
  };
};
