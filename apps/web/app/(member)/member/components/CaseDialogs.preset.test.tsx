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
    singleRenterTitle: "????? | ????",
    singleRenterLabels: ["????", "????", "??"],
    homeLabels: ["????", "????", "????"],
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
