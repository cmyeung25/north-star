import type { TravelMonthMode, WeddingStyle } from "./bundles";

export type BudgetPreset = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  kind: "weddingStyle" | "destinationWedding" | "honeymoon";
  currency: "HKD";
  defaults: {
    weddingStyle?: WeddingStyle;
    totalWeddingBudget?: number;
    travel?: {
      mode: "perPerson" | "total";
      travellersCount?: number;
      perPersonBudget?: number;
      total?: number;
      nights?: number;
      monthMode?: TravelMonthMode;
    };
  };
  meta?: { rangeMin?: number; rangeMax?: number; notesKey?: string };
};

export const WEDDING_STYLE_PRESETS: BudgetPreset[] = [
  {
    id: "simple_register",
    labelKey: "bundleMarriagePresetWeddingSimple",
    descriptionKey: "bundleMarriagePresetWeddingSimpleDesc",
    kind: "weddingStyle",
    currency: "HKD",
    defaults: { weddingStyle: "simple_register", totalWeddingBudget: 30000 },
    meta: { rangeMin: 20000, rangeMax: 60000 },
  },
  {
    id: "small_banquet",
    labelKey: "bundleMarriagePresetWeddingSmall",
    descriptionKey: "bundleMarriagePresetWeddingSmallDesc",
    kind: "weddingStyle",
    currency: "HKD",
    defaults: { weddingStyle: "small_banquet", totalWeddingBudget: 120000 },
    meta: { rangeMin: 80000, rangeMax: 200000 },
  },
  {
    id: "hotel_banquet",
    labelKey: "bundleMarriagePresetWeddingHotel",
    descriptionKey: "bundleMarriagePresetWeddingHotelDesc",
    kind: "weddingStyle",
    currency: "HKD",
    defaults: { weddingStyle: "hotel_banquet", totalWeddingBudget: 300000 },
    meta: { rangeMin: 200000, rangeMax: 450000 },
  },
  {
    id: "luxury_wedding",
    labelKey: "bundleMarriagePresetWeddingLuxury",
    descriptionKey: "bundleMarriagePresetWeddingLuxuryDesc",
    kind: "weddingStyle",
    currency: "HKD",
    defaults: { weddingStyle: "luxury_wedding", totalWeddingBudget: 600000 },
    meta: { rangeMin: 450000, rangeMax: 1000000 },
  },
];

export const DESTINATION_WEDDING_PRESETS: BudgetPreset[] = [
  ["japan", 25000, 5, 120000],
  ["korea", 18000, 5, 100000],
  ["taiwan", 12000, 5, 90000],
  ["bali", 22000, 6, 120000],
  ["thailand", 15000, 5, 100000],
  ["australia", 40000, 8, 180000],
  ["europe", 70000, 12, 220000],
  ["luxury", 100000, 12, 280000],
].map(([id, perPersonBudget, nights, totalWeddingBudget]) => ({
  id: String(id),
  labelKey: `bundleMarriagePresetDestination${String(id).charAt(0).toUpperCase()}${String(id).slice(1)}`,
  descriptionKey: "bundleMarriagePresetDestinationDesc",
  kind: "destinationWedding" as const,
  currency: "HKD" as const,
  defaults: {
    weddingStyle: "destination_wedding" as const,
    totalWeddingBudget: Number(totalWeddingBudget),
    travel: {
      mode: "perPerson" as const,
      travellersCount: 2,
      perPersonBudget: Number(perPersonBudget),
      nights: Number(nights),
      monthMode: "same" as const,
    },
  },
}));

export const HONEYMOON_PRESETS: BudgetPreset[] = [
  ["short", 12000, 4],
  ["japan", 20000, 6],
  ["europeAustralia", 45000, 10],
  ["luxury", 80000, 12],
].map(([id, perPersonBudget, nights]) => ({
  id: String(id),
  labelKey: `bundleMarriagePresetHoneymoon${String(id).charAt(0).toUpperCase()}${String(id).slice(1)}`,
  descriptionKey: "bundleMarriagePresetHoneymoonDesc",
  kind: "honeymoon" as const,
  currency: "HKD" as const,
  defaults: {
    travel: {
      mode: "perPerson" as const,
      travellersCount: 2,
      perPersonBudget: Number(perPersonBudget),
      nights: Number(nights),
      monthMode: "plus1" as const,
    },
  },
}));
