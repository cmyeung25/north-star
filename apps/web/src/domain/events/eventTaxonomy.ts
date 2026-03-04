import { z } from "zod";
import { eventTypes, type EventType as EngineEventType } from "@north-star/engine";

/** Structural event type for Scenario V2 events. */
export const structuralEventTypes = [
  "cashflow",
  "housing",
  "loan",
  "insurance",
  "adjustment",
] as const;

/** Structural sub-kinds inside each structural event type. */
export const cashflowEventKinds = ["income", "expense"] as const;
export const housingEventKinds = ["rent", "mortgage"] as const;
export const adjustmentEventKinds = ["asset", "liability", "cash"] as const;
export const sharedViewBelongsToValues = ["member", "household"] as const;
export const sharedViewLinkStateValues = ["linked", "orphaned"] as const;
export const sharedViewSourceValues = [
  "baseline-only",
  "experiment-only",
  "applied-to-scenario",
] as const;

const eventTypeValues = eventTypes as [EngineEventType, ...EngineEventType[]];

export const incomeSubtypes = [
  "salary",
  "bonus",
  "freelance",
  "rental",
  "dividend",
  "interest",
  "other",
] as const;

export const expenseCategories = [
  "daily_living",
  "transport",
  "property_ownership",
  "vehicle_ownership",
  "insurance",
  "healthcare",
  "education",
  "family_support",
  "entertainment",
  "travel",
  "tax",
  "debt_repayment",
  "other",
] as const;

export type StructuralEventType = (typeof structuralEventTypes)[number];
export type CashflowEventKind = (typeof cashflowEventKinds)[number];
export type HousingEventKind = (typeof housingEventKinds)[number];
export type AdjustmentEventKind = (typeof adjustmentEventKinds)[number];
export type LegacyEventType = EngineEventType;
export type IncomeSubtype = (typeof incomeSubtypes)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];
export type SharedViewBelongsTo = (typeof sharedViewBelongsToValues)[number];
export type SharedViewLinkState = (typeof sharedViewLinkStateValues)[number];
export type SharedViewSource = (typeof sharedViewSourceValues)[number];

export type SharedEventViewContract = {
  domain: "income" | "expense" | "asset" | "liability";
  type: string;
  kind: string;
  belongsTo: SharedViewBelongsTo;
  linkState: SharedViewLinkState;
  source: SharedViewSource;
};

export const StructuralEventTypeSchema = z.enum(structuralEventTypes);
export const CashflowEventKindSchema = z.enum(cashflowEventKinds);
export const HousingEventKindSchema = z.enum(housingEventKinds);
export const AdjustmentEventKindSchema = z.enum(adjustmentEventKinds);
export const LegacyEventTypeSchema = z.enum(eventTypeValues);
export const IncomeSubtypeSchema = z.enum(incomeSubtypes);
export const ExpenseCategorySchema = z.enum(expenseCategories);
export const SharedViewBelongsToSchema = z.enum(sharedViewBelongsToValues);
export const SharedViewLinkStateSchema = z.enum(sharedViewLinkStateValues);
export const SharedViewSourceSchema = z.enum(sharedViewSourceValues);
