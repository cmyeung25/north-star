import type { ApplyScope } from "../applyScope";
import { appliesToScenario } from "../applyScope";
import { monthAtAge } from "./age";
import type { ScenarioMember, MemberMilestone } from "../../store/scenarioStore";
import type { ScenarioEventView } from "../events/types";
import { normalizeMonthStrict } from "../../utils/month";

export type SalaryStepMilestoneSource = {
  type: "salaryStep";
  eventId: string;
  stepId: string;
};

export type DerivedSalaryStepMilestone = {
  id: string;
  memberId: string;
  month: string;
  locked: true;
  source: SalaryStepMilestoneSource;
};

const isSalaryEvent = (event: ScenarioEventView) =>
  event.definition.type === "salary" &&
  (event.definition.incomeSubtype ?? "salary") === "salary";

const resolveStepMonth = ({
  step,
  member,
  baseMonth,
}: {
  step: NonNullable<ScenarioEventView["rule"]["salarySteps"]>[number];
  member: ScenarioMember;
  baseMonth: string | null;
}): string | null => {
  if (step.basis === "month") {
    const normalized = normalizeMonthStrict(step.startMonth ?? "");
    return normalized.ok ? normalized.month : null;
  }

  if (member.kind !== "person") {
    return null;
  }

  const startAgeYears = typeof step.startAgeYears === "number" ? step.startAgeYears : null;
  if (startAgeYears === null) {
    return null;
  }

  const normalizedBase = baseMonth ? normalizeMonthStrict(baseMonth) : null;
  if (!normalizedBase?.ok) {
    return null;
  }

  const resolved = monthAtAge(member, Math.max(startAgeYears, 0), normalizedBase.month);
  if (!resolved) {
    return null;
  }

  const normalized = normalizeMonthStrict(resolved);
  return normalized.ok ? normalized.month : null;
};

const resolveEventApplyScope = (event: ScenarioEventView): ApplyScope | undefined =>
  (event.definition as { applyScope?: ApplyScope }).applyScope;

export const deriveSalaryStepMilestones = ({
  events,
  members,
  baseMonth,
  scenarioId,
}: {
  events: ScenarioEventView[];
  members: ScenarioMember[];
  baseMonth: string | null | undefined;
  scenarioId?: string;
}): DerivedSalaryStepMilestone[] => {
  const memberLookup = new Map(members.map((member) => [member.id, member]));

  return events.flatMap((event) => {
    if (!event.ref.enabled || !isSalaryEvent(event)) {
      return [];
    }

    const memberId = event.definition.memberId;
    if (!memberId) {
      return [];
    }

    const member = memberLookup.get(memberId);
    if (!member) {
      return [];
    }

    if (scenarioId && !appliesToScenario(member.applyScope, scenarioId)) {
      return [];
    }

    const eventApplyScope = resolveEventApplyScope(event);
    if (scenarioId && eventApplyScope && !appliesToScenario(eventApplyScope, scenarioId)) {
      return [];
    }

    const steps = event.rule.salarySteps ?? [];
    if (steps.length === 0) {
      return [];
    }

    return steps.flatMap((step) => {
      const month = resolveStepMonth({
        step,
        member,
        baseMonth: baseMonth ?? null,
      });
      if (!month) {
        return [];
      }

      return [
        {
          id: `derived:salaryStep:${event.definition.id}:${step.id}`,
          memberId: member.id,
          month,
          locked: true as const,
          source: {
            type: "salaryStep",
            eventId: event.definition.id,
            stepId: step.id,
          },
        },
      ];
    });
  });
};

const isSalaryStepMilestoneForEvent = (milestone: MemberMilestone, eventId?: string) => {
  const metadata = milestone.metadata ?? {};
  const sourceType = metadata.type ?? metadata.source;
  const sourceEventId =
    metadata.eventId ?? metadata.sourceEventId ?? milestone.sourceEventId ?? null;
  const legacyPrefix = eventId ? `salary-step-${eventId}-` : "salary-step-";
  const derivedPrefix = eventId ? `derived:salaryStep:${eventId}:` : "derived:salaryStep:";

  const matchesEvent =
    !eventId ||
    sourceEventId === eventId ||
    milestone.id.startsWith(`salary-step-${eventId}-`) ||
    milestone.id.startsWith(`derived:salaryStep:${eventId}:`);

  if (!matchesEvent) {
    return false;
  }

  return (
    sourceType === "salaryStep" ||
    milestone.id.startsWith(legacyPrefix) ||
    milestone.id.startsWith(derivedPrefix)
  );
};

export const purgeSalaryStepMilestones = (
  milestones: MemberMilestone[] | undefined,
  eventId?: string
): MemberMilestone[] =>
  (milestones ?? []).filter(
    (milestone) => !isSalaryStepMilestoneForEvent(milestone, eventId)
  );

export const isPersistedSalaryStepMilestone = (milestone: MemberMilestone): boolean =>
  isSalaryStepMilestoneForEvent(milestone);
