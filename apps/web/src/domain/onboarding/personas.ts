import { nanoid } from "nanoid";
import type { OnboardingPersona } from "../../store/scenarioStore";
import type {
  OnboardingBudgetRuleDraft,
  OnboardingDraft,
  OnboardingIncomeDraft,
  OnboardingMemberDraft,
  OnboardingPositionsDraft,
  OnboardingSettingsDraft,
  OnboardingTimelineEventDraft,
} from "./applyDraft";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../constants";

export type PersonaPreset = {
  id: OnboardingPersona;
  titleKey: string;
  descriptionKey: string;
};

export type PersonaPresetDraft = {
  members: OnboardingMemberDraft[];
  settings: Partial<OnboardingSettingsDraft>;
  budgetRules: OnboardingBudgetRuleDraft[];
  positions: OnboardingPositionsDraft;
  incomes: OnboardingIncomeDraft[];
  timelineEvents: OnboardingTimelineEventDraft[];
};

export const personaPresets: PersonaPreset[] = [
  {
    id: "forumKid",
    titleKey: "personaForumKidTitle",
    descriptionKey: "personaForumKidDescription",
  },
  {
    id: "middleClassFamily",
    titleKey: "personaMiddleClassTitle",
    descriptionKey: "personaMiddleClassDescription",
  },
  {
    id: "richSingle",
    titleKey: "personaRichSingleTitle",
    descriptionKey: "personaRichSingleDescription",
  },
];

const createMember = (
  name: string,
  options?: { kind?: "person" | "pet"; ageAtBaseMonth?: number }
): OnboardingMemberDraft => ({
  id: nanoid(),
  name,
  kind: options?.kind ?? "person",
  ageAtBaseMonth: options?.ageAtBaseMonth,
  birthMonth: "",
});

const createBudgetRule = (
  baseMonth: string,
  options: {
    name: string;
    memberId: string | "household";
    category: OnboardingBudgetRuleDraft["category"];
    monthlyAmount: number;
    ageBand?: { fromYears: number; toYears: number };
  }
): OnboardingBudgetRuleDraft => ({
  id: nanoid(),
  name: options.name,
  enabled: true,
  memberId: options.memberId,
  category: options.category,
  ageBand: options.ageBand ?? { fromYears: 0, toYears: 99 },
  monthlyAmount: options.monthlyAmount,
  annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  startMonth: baseMonth,
  endMonth: "",
});

const createIncome = (
  baseMonth: string,
  options: {
    title: string;
    memberId: string;
    monthlyAmount: number;
    subtype?: OnboardingIncomeDraft["subtype"];
  }
): OnboardingIncomeDraft => ({
  id: nanoid(),
  title: options.title,
  memberId: options.memberId,
  subtype: options.subtype ?? "salary",
  monthlyAmount: options.monthlyAmount,
  startMonth: baseMonth,
  endMonth: "",
  endAtAgeYears: undefined,
  annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
});

const emptyPositions: OnboardingPositionsDraft = {
  homes: [],
  cars: [],
  investments: [],
  loans: [],
};

export const applyPersonaPreset = (
  personaId: OnboardingPersona,
  baseMonth: string
): PersonaPresetDraft => {
  const settingsDefaults: Partial<OnboardingSettingsDraft> = {
    baseMonth,
    horizonMonths: 360,
    annualInflationPct: 2,
    viewMode: "nominal",
  };

  if (personaId === "forumKid") {
    const main = createMember("連登仔", { ageAtBaseMonth: 25 });
    return {
      members: [main],
      settings: settingsDefaults,
      budgetRules: [
        createBudgetRule(baseMonth, {
          name: "基本生活開支",
          memberId: main.id,
          category: "baseline",
          monthlyAmount: 8000,
        }),
      ],
      positions: emptyPositions,
      incomes: [
        createIncome(baseMonth, {
          title: "月薪",
          memberId: main.id,
          monthlyAmount: 20000,
        }),
      ],
      timelineEvents: [],
    };
  }

  if (personaId === "middleClassFamily") {
    const dad = createMember("爸爸", { ageAtBaseMonth: 35 });
    const mom = createMember("媽媽", { ageAtBaseMonth: 33 });
    const child = createMember("小朋友", { ageAtBaseMonth: 5 });
    return {
      members: [dad, mom, child],
      settings: settingsDefaults,
      budgetRules: [
        createBudgetRule(baseMonth, {
          name: "家庭基本開支",
          memberId: "household",
          category: "baseline",
          monthlyAmount: 28000,
        }),
        createBudgetRule(baseMonth, {
          name: "托兒與教育",
          memberId: child.id,
          category: "childcare",
          monthlyAmount: 6000,
          ageBand: { fromYears: 0, toYears: 12 },
        }),
      ],
      positions: emptyPositions,
      incomes: [
        createIncome(baseMonth, {
          title: "爸爸薪金",
          memberId: dad.id,
          monthlyAmount: 32000,
        }),
        createIncome(baseMonth, {
          title: "媽媽薪金",
          memberId: mom.id,
          monthlyAmount: 26000,
        }),
      ],
      timelineEvents: [],
    };
  }

  const single = createMember("王老五", { ageAtBaseMonth: 30 });
  return {
    members: [single],
    settings: settingsDefaults,
    budgetRules: [
      createBudgetRule(baseMonth, {
        name: "日常開支",
        memberId: single.id,
        category: "baseline",
        monthlyAmount: 18000,
      }),
    ],
    positions: {
      ...emptyPositions,
      investments: [
        {
          id: nanoid(),
          assetClass: "fund",
          startMonth: baseMonth,
          initialValue: 5000000,
          expectedAnnualReturnPct: DEFAULT_ANNUAL_GROWTH_PCT,
          monthlyContribution: 0,
        },
      ],
    },
    incomes: [
      createIncome(baseMonth, {
        title: "被動收入",
        memberId: single.id,
        monthlyAmount: 5000,
        subtype: "dividend",
      }),
    ],
    timelineEvents: [],
  };
};

export const mergePersonaDraft = (
  baseDraft: OnboardingDraft,
  personaDraft: PersonaPresetDraft
): OnboardingDraft => ({
  ...baseDraft,
  members: personaDraft.members,
  settings: {
    ...baseDraft.settings,
    ...personaDraft.settings,
  },
  budgetRules: personaDraft.budgetRules,
  positions: personaDraft.positions,
  incomes: personaDraft.incomes,
  timelineEvents: personaDraft.timelineEvents,
});
