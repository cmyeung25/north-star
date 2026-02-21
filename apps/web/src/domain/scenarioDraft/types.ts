import type {
  ScenarioAssumptions,
  ScenarioAsset,
  ScenarioClientComputed,
  ScenarioLiability,
  ScenarioMember,
  ScenarioMeta,
} from "../../store/scenarioStore";
import type { ScenarioEvent, ScenarioEventDraft } from "../scenarioV2/events";

export type ValidationIssue = {
  code: "required" | "invalid-month" | "invalid-id" | "invalid-currency";
  field: string;
  message: string;
};

export type ScenarioDraft = {
  assumptions?: Partial<ScenarioAssumptions>;
  members?: ScenarioMember[];
  assets?: ScenarioAsset[];
  liabilities?: ScenarioLiability[];
  events?: Array<ScenarioEvent | ScenarioEventDraft>;
  meta?: Partial<ScenarioMeta>;
  clientComputed?: Partial<ScenarioClientComputed>;
  baseCurrency?: string;
};

export type ScenarioCreatePayload = {
  assumptions: ScenarioAssumptions;
  members: ScenarioMember[];
  assets: ScenarioAsset[];
  liabilities: ScenarioLiability[];
  events: ScenarioEvent[];
  meta: ScenarioMeta;
  clientComputed: ScenarioClientComputed;
  baseCurrency: string;
  validationIssues: ValidationIssue[];
};
