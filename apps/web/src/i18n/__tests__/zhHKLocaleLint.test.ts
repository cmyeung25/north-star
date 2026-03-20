import { describe, expect, it } from "vitest";
import enMessages from "../../../messages/en.json";
import zhHkMessages from "../../../messages/zh-HK.json";

type JsonRecord = Record<string, unknown>;

function flattenMessages(input: JsonRecord, prefix = ""): Map<string, string> {
  const output = new Map<string, string>();

  for (const [key, value] of Object.entries(input)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      output.set(nextKey, value);
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of flattenMessages(value as JsonRecord, nextKey)) {
        output.set(nestedKey, nestedValue);
      }
    }
  }

  return output;
}

function collectTokens(message: string): string[] {
  return Array.from(message.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]).sort();
}

describe("zh-HK locale lint", () => {
  it("keeps placeholder tokens aligned with en for onboarding guardrail copy", () => {
    const enMap = flattenMessages(enMessages as JsonRecord);
    const zhMap = flattenMessages(zhHkMessages as JsonRecord);
    const guardrailPrefix = "onboardingV3.guardrails.rules.";
    const mismatches: string[] = [];

    for (const [key, enValue] of enMap.entries()) {
      if (!key.startsWith(guardrailPrefix)) {
        continue;
      }

      const zhValue = zhMap.get(key);
      if (!zhValue) {
        mismatches.push(`${key}: missing zh-HK value`);
        continue;
      }

      const enTokens = collectTokens(enValue).join("|");
      const zhTokens = collectTokens(zhValue).join("|");
      if (enTokens !== zhTokens) {
        mismatches.push(`${key}: en={${enTokens}} zh={${zhTokens}}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps placeholder tokens aligned with en for overview keys", () => {
    const enMap = flattenMessages(enMessages as JsonRecord);
    const zhMap = flattenMessages(zhHkMessages as JsonRecord);

    const mismatches: string[] = [];

    for (const [key, enValue] of enMap.entries()) {
      if (!key.startsWith("overview.")) {
        continue;
      }

      const zhValue = zhMap.get(key);
      if (!zhValue) {
        continue;
      }

      const enTokens = collectTokens(enValue).join("|");
      const zhTokens = collectTokens(zhValue).join("|");
      if (enTokens !== zhTokens) {
        mismatches.push(`${key}: en={${enTokens}} zh={${zhTokens}}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("flags suspicious untranslated terms in overview and plan-lab health summary copy", () => {
    const zhMap = flattenMessages(zhHkMessages as JsonRecord);
    const suspiciousTerms = [/\bBaseline\b/i, /\bScorecard\b/i, /\bproxy\b/i];
    const violations: string[] = [];

    for (const [key, value] of zhMap.entries()) {
      if (!key.startsWith("overview.")) {
        continue;
      }

      if (!key.includes("planLab") && !key.includes("health") && !key.includes("scorecard") && !key.includes("Scorecard")) {
        continue;
      }

      if (value.includes("Plan Lab")) {
        continue;
      }

      if (suspiciousTerms.some((pattern) => pattern.test(value))) {
        violations.push(`${key}: ${value}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps onboarding guardrail copy free from mojibake markers", () => {
    const zhMap = flattenMessages(zhHkMessages as JsonRecord);
    const violations: string[] = [];

    for (const [key, value] of zhMap.entries()) {
      if (!key.startsWith("onboardingV3.guardrails.rules.")) {
        continue;
      }

      if (/�|\?{3,}/.test(value)) {
        violations.push(`${key}: ${value}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
