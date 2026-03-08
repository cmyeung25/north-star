import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import enMessages from "../../../../messages/en.json";
import zhHkMessages from "../../../../messages/zh-HK.json";
import { writePresetDraftToStorage } from "./presetDraftStorage";
import { getDraftStorageKey } from "../../../../src/features/onboarding/draftStorage";
import { MEMBER_CASE_PRESET_SEED_IDS } from "../../../../src/features/onboarding/seedPrefill";
import { createScenarioSeedTranslatorFromMessages, getScenarioSeeds } from "../../../../src/scenarios/scenarioSeeds";

const dialogSourcePath = path.resolve(
  process.cwd(),
  "app/(member)/member/components/CaseDialogs.tsx"
);

const requiredCaseDialogKeys = [
  "createModeLabel",
  "createModeBlank",
  "createModePreset",
  "createModeHintBlank",
  "createModeHintPreset",
  "presetTitle",
  "presetHint",
  "presetApply",
  "presetSelected",
] as const;

type MemberMessages = {
  member: {
    caseDialogs: Record<string, string>;
  };
};

const seedTranslator = Object.assign((key: string) => key, {
  raw: () => [],
});

const rawKeyPattern = /^([a-z][\w-]*\.)+[a-z][\w-]*$/i;
const suspiciousLocalizedValuePattern = /\?{2,}|\uFFFD|\u00C3.|\u00E2.|\u00E4\u00BD|\u00E5./;
const placeholderTokenPattern = /\{([a-zA-Z0-9_]+)\}/g;

function flattenStringValues(
  value: unknown,
  path = "",
  result: Record<string, string> = {}
): Record<string, string> {
  if (typeof value === "string") {
    result[path] = value;
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      flattenStringValues(entry, `${path}[${index}]`, result);
    });
    return result;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      flattenStringValues(entry, path ? `${path}.${key}` : key, result);
    });
  }

  return result;
}

function getPlaceholderTokens(value: string): string[] {
  return Array.from(value.matchAll(placeholderTokenPattern), ([, token]) => token).sort();
}

const localizedSeedExpectations = [
  {
    locale: "en",
    messages: enMessages,
    singleRenterTitle: "Single professional | Rent & save",
    singleRenterLabels: ["Monthly income", "Monthly expense", "Cash"],
    homeLabels: ["Monthly income", "Property value", "Mortgage balance"],
  },
  {
    locale: "zh-HK",
    messages: zhHkMessages,
    singleRenterTitle: zhHkMessages.scenarios.seeds.profiles.singleRenter.title,
    singleRenterLabels: [
      zhHkMessages.scenarios.seeds.keyNumbers.monthlyIncome,
      zhHkMessages.scenarios.seeds.keyNumbers.monthlyExpense,
      zhHkMessages.scenarios.seeds.keyNumbers.cash,
    ],
    homeLabels: [
      zhHkMessages.scenarios.seeds.keyNumbers.monthlyIncome,
      zhHkMessages.scenarios.seeds.keyNumbers.propertyValue,
      zhHkMessages.scenarios.seeds.keyNumbers.mortgageBalance,
    ],
  },
] as const;

describe("member create-case preset flow", () => {
  it("defines localized create-mode copy for every key referenced by CaseDialogs", () => {
    const source = fs.readFileSync(dialogSourcePath, "utf8");
    const en = enMessages as MemberMessages;
    const zh = zhHkMessages as MemberMessages;

    for (const key of requiredCaseDialogKeys) {
      expect(source.includes(`t("${key}")`)).toBe(true);
      expect(typeof en.member.caseDialogs[key] === "string").toBe(true);
      expect(typeof zh.member.caseDialogs[key] === "string").toBe(true);
      expect(en.member.caseDialogs[key] === key).toBe(false);
      expect(zh.member.caseDialogs[key] === key).toBe(false);
    }
  });

  it("localizes preset cards for en and zh-HK", () => {
    for (const expectation of localizedSeedExpectations) {
      const translator = createScenarioSeedTranslatorFromMessages(
        expectation.messages as Record<string, unknown>
      );
      const seeds = getScenarioSeeds(translator);

      seeds.forEach((seed) => {
        expect(rawKeyPattern.test(seed.title)).toBe(false);
        expect(rawKeyPattern.test(seed.description)).toBe(false);
        seed.tags.forEach((tag) => expect(rawKeyPattern.test(tag)).toBe(false));
        seed.keyNumbers.forEach((item) => expect(rawKeyPattern.test(item.label)).toBe(false));
      });

      const singleRenter = seeds.find((seed) => seed.id === "single-renter");
      const dualIncomeHome = seeds.find((seed) => seed.id === "dual-income-home");

      expect(singleRenter?.title).toBe(expectation.singleRenterTitle);
      expect(singleRenter?.keyNumbers.map((item) => item.label)).toEqual(
        expectation.singleRenterLabels
      );
      expect(dualIncomeHome?.keyNumbers.map((item) => item.label)).toEqual(
        expectation.homeLabels
      );
    }
  });

  it("keeps zh-HK copy free from mojibake markers and preserves placeholders", () => {
    const zhFlat = flattenStringValues(zhHkMessages);
    const enFlat = flattenStringValues(enMessages);

    for (const [key, value] of Object.entries(zhFlat)) {
      expect(
        suspiciousLocalizedValuePattern.test(value),
        `unexpected zh-HK mojibake marker in ${key}`
      ).toBe(false);
    }

    for (const [key, enValue] of Object.entries(enFlat)) {
      const zhValue = zhFlat[key];
      if (zhValue === undefined) {
        continue;
      }

      expect(getPlaceholderTokens(zhValue), `placeholder mismatch for ${key}`).toEqual(
        getPlaceholderTokens(enValue)
      );
    }
  });

  it("keeps new-baby presets in the member allowlist", () => {
    const productizedSeedIds = getScenarioSeeds(seedTranslator)
      .filter((seed) => MEMBER_CASE_PRESET_SEED_IDS.includes(seed.id as (typeof MEMBER_CASE_PRESET_SEED_IDS)[number]))
      .map((seed) => seed.id);

    expect(productizedSeedIds).toContain("new-baby");
    expect(productizedSeedIds).toContain("new-baby-helper");
  });

  it("writes preset onboarding drafts into scenario-scoped storage", () => {
    const seed = getScenarioSeeds(seedTranslator).find((entry) => entry.id === "new-baby");
    expect(seed !== undefined).toBe(true);

    const calls: { key: string; value: string }[] = [];
    const storage = {
      setItem: (key: string, value: string) => {
        calls.push({ key, value });
      },
    };

    const draft = writePresetDraftToStorage("scenario-new-baby", seed!.payload, storage);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      key: getDraftStorageKey("scenario-new-baby"),
    });

    const savedDraft = JSON.parse(calls[0]!.value) as typeof draft;
    expect(savedDraft.household.childCount).toBe(1);
    expect(savedDraft.incomes.length > 0).toBe(true);
    expect(savedDraft.assets.cash.amount).toBe(150000);
    expect(savedDraft.housing.mode).toBe("rent");
    expect(draft.household.childCount).toBe(1);
  });
});
