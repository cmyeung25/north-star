import { describe, expect, it } from "vitest";
import {
  buildMemberCasesEntryHref,
  consumeMemberCasesAuthReturnIntent,
  MEMBER_JOURNEY_POLICY,
  persistMemberCasesAuthReturnIntent,
  resolveMemberCasesEntryIntent,
} from "./createCaseEntry";

function createStorageStub(initialValue?: string) {
  const store = new Map<string, string>();
  if (initialValue !== undefined) {
    store.set("north-star.member-cases-entry-intent", initialValue);
  }

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    readStoredIntent: () => store.get("north-star.member-cases-entry-intent") ?? null,
  };
}

describe("resolveMemberCasesEntryIntent", () => {
  it("keeps the canonical journey allowlist and primary preset policy explicit", () => {
    expect(MEMBER_JOURNEY_POLICY).toEqual({
      officeSaver: {
        primaryPresetId: "single-renter",
        fallbackToBlank: true,
      },
      coupleHome: {
        primaryPresetId: "dual-income-home",
        fallbackToBlank: true,
      },
      newParents: {
        primaryPresetId: "new-baby",
        fallbackToBlank: true,
      },
      mortgageOwner: {
        primaryPresetId: "high-asset",
        fallbackToBlank: true,
      },
    });
  });

  it("uses allowlisted preset from query", () => {
    const intent = resolveMemberCasesEntryIntent({
      journey: "officeSaver",
      preset: "dual-income-rental",
    });

    expect(intent).toEqual({
      journey: "officeSaver",
      presetId: "dual-income-rental",
    });
  });

  it("falls back to mapped preset when preset query is missing", () => {
    const intent = resolveMemberCasesEntryIntent({
      journey: "coupleHome",
    });

    expect(intent).toEqual({
      journey: "coupleHome",
      presetId: "dual-income-home",
    });
  });

  it("supports preset-only mapping when the preset is allowlisted", () => {
    const intent = resolveMemberCasesEntryIntent({
      preset: "new-baby-helper",
    });

    expect(intent).toEqual({
      journey: null,
      presetId: "new-baby-helper",
    });
  });

  it("ignores unknown journeys and non-allowlisted presets", () => {
    const intent = resolveMemberCasesEntryIntent({
      journey: "unknown",
      preset: "evil-preset",
    });

    expect(intent).toEqual({
      journey: null,
      presetId: null,
    });
  });

  it("only reads journey and preset query parameters", () => {
    const intent = resolveMemberCasesEntryIntent(
      new URLSearchParams({
        auth: "login",
        journey: "coupleHome",
        preset: "evil-preset",
        experimentSlotKey: "landing.persona.cta_summary",
        experimentVariant: "decision_first_v1",
        redirectTo: "/en/app/case-123",
      }),
    );

    expect(intent).toEqual({
      journey: "coupleHome",
      presetId: "dual-income-home",
    });
  });

  it("ignores experiment metadata when resolving the canonical member handoff", () => {
    const intent = resolveMemberCasesEntryIntent(
      new URLSearchParams({
        journey: "newParents",
        preset: "new-baby",
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "decision_first_v1",
      }),
    );

    expect(intent).toEqual({
      journey: "newParents",
      presetId: "new-baby",
    });
  });

  it("keeps blank create flow when no journey/preset query is provided", () => {
    const intent = resolveMemberCasesEntryIntent({});

    expect(intent).toEqual({
      journey: null,
      presetId: null,
    });
  });

  it("round-trips signed-in journey intent through the canonical /member/cases handoff", () => {
    const href = buildMemberCasesEntryHref("en", {
      journey: "officeSaver",
      presetId: "single-renter",
    });

    expect(href).toBe("/en/member/cases?journey=officeSaver&preset=single-renter");
    expect(resolveMemberCasesEntryIntent(new URL(href, "https://example.com").searchParams)).toEqual({
      journey: "officeSaver",
      presetId: "single-renter",
    });
  });

  it("falls back to blank /member/cases when signed-in href input is invalid", () => {
    expect(
      buildMemberCasesEntryHref("en", {
        journey: null,
        presetId: null,
      }),
    ).toBe("/en/member/cases");
  });

  it("persists signed-out auth return intent and rehydrates the same member create intent after auth", () => {
    const storage = createStorageStub();

    persistMemberCasesAuthReturnIntent(
      {
        journey: "newParents",
        presetId: "new-baby",
      },
      storage,
    );

    expect(storage.readStoredIntent()).toBe(
      JSON.stringify({
        journey: "newParents",
        presetId: "new-baby",
      }),
    );

    expect(consumeMemberCasesAuthReturnIntent(storage)).toEqual({
      journey: "newParents",
      presetId: "new-baby",
    });
    expect(storage.readStoredIntent()).toBeNull();
  });

  it("sanitizes signed-out auth return intent before it reaches /member/cases", () => {
    const storage = createStorageStub();

    persistMemberCasesAuthReturnIntent(
      {
        journey: "officeSaver",
        presetId: "evil-preset" as never,
      },
      storage,
    );

    expect(consumeMemberCasesAuthReturnIntent(storage)).toEqual({
      journey: "officeSaver",
      presetId: "single-renter",
    });
  });

  it("drops malformed stored auth return intent back to blank flow", () => {
    const storage = createStorageStub("{not-json");

    expect(consumeMemberCasesAuthReturnIntent(storage)).toEqual({
      journey: null,
      presetId: null,
    });
  });
});
