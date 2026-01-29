import {
  createCarPositionId,
  createHomePositionId,
  createInsurancePositionId,
  createInvestmentPositionId,
  type CarPositionDraft,
  type HomePositionDraft,
  type InsurancePositionDraft,
  type InvestmentPositionDraft,
  type Scenario,
  type ScenarioPositions,
} from "../../src/store/scenarioStore";
import {
  createCarPositionFromTemplate,
  createHomePositionFromTemplate,
  createInsurancePositionFromTemplate,
  createInvestmentPositionFromTemplate,
} from "../../components/timeline/utils";
import type { AssetItem, AssetItemUpsert, AssetType } from "./types";

export type AssetItemChange =
  | { type: "upsert"; item: AssetItemUpsert }
  | { type: "remove"; item: AssetItem };

const ensureHomeDraft = (home: HomePositionDraft): HomePositionDraft => ({
  ...home,
  id: home.id ?? createHomePositionId(),
});

const ensureInvestmentDraft = (
  investment: InvestmentPositionDraft
): InvestmentPositionDraft => ({
  ...investment,
  id: investment.id ?? createInvestmentPositionId(),
});

const ensureInsuranceDraft = (
  insurance: InsurancePositionDraft
): InsurancePositionDraft => ({
  ...insurance,
  id: insurance.id ?? createInsurancePositionId(),
});

const ensureCarDraft = (car: CarPositionDraft): CarPositionDraft => ({
  ...car,
  id: car.id ?? createCarPositionId(),
});

const normalizeHomes = (positions?: ScenarioPositions): HomePositionDraft[] => {
  if (positions?.homes && positions.homes.length > 0) {
    return positions.homes.map((home) => ensureHomeDraft(home));
  }
  if (positions?.home) {
    return [ensureHomeDraft({ ...positions.home, id: createHomePositionId() })];
  }
  return [];
};

const resolveAssetValue = (
  asset: HomePositionDraft | InvestmentPositionDraft | InsurancePositionDraft | CarPositionDraft
) => {
  if ("purchasePrice" in asset) {
    return asset.purchasePrice ?? 0;
  }
  if ("initialValue" in asset) {
    return asset.initialValue ?? 0;
  }
  if ("initialCashValue" in asset) {
    return asset.initialCashValue ?? 0;
  }
  return 0;
};

const resolveAssetStartMonth = (
  asset: HomePositionDraft | InvestmentPositionDraft | InsurancePositionDraft | CarPositionDraft
) => {
  if ("purchaseMonth" in asset) {
    return asset.purchaseMonth;
  }
  if ("startMonth" in asset) {
    return asset.startMonth;
  }
  return undefined;
};

const resolveAssetName = (
  asset: HomePositionDraft | InvestmentPositionDraft | InsurancePositionDraft | CarPositionDraft,
  fallback: string
) => asset.name ?? fallback;

const resolveAssetNotes = (
  asset: HomePositionDraft | InvestmentPositionDraft | InsurancePositionDraft | CarPositionDraft
) => asset.notes;

export const createAssetItemId = (assetType: AssetType) => {
  switch (assetType) {
    case "property":
      return createHomePositionId();
    case "investment":
      return createInvestmentPositionId();
    case "insurance":
      return createInsurancePositionId();
    case "car":
      return createCarPositionId();
    default:
      return createHomePositionId();
  }
};

export const toAssetItems = (scenario: Scenario): AssetItem[] => {
  const baseCurrency = scenario.baseCurrency;
  const positions = scenario.positions;
  const homes = normalizeHomes(positions);
  const investments = positions?.investments ?? [];
  const insurances = positions?.insurances ?? [];
  const cars = positions?.cars ?? [];

  return [
    ...homes.map((home) => ({
      id: home.id,
      assetType: "property" as const,
      name: resolveAssetName(home, "Property"),
      currentValue: resolveAssetValue(home),
      currency: baseCurrency,
      ownerMemberId: home.ownerMemberId,
      startMonth: resolveAssetStartMonth(home) ?? "",
      notes: resolveAssetNotes(home),
      purchaseFees: home.purchaseFees,
      ongoingCosts: home.ongoingCosts,
      rental: home.rental
        ? {
            isRented: home.rental.isRented ?? true,
            rentAmountMonthly: home.rental.rentMonthly,
            rentStartMonth: home.rental.rentStartMonth,
            rentEndMonth: home.rental.rentEndMonth ?? undefined,
          }
        : undefined,
      source: home.source ?? ("manual" as const),
      generatedByEventId: home.generatedByEventId,
    })),
    ...investments.map((investment) => ({
      id: investment.id ?? createInvestmentPositionId(),
      assetType: "investment" as const,
      name: resolveAssetName(investment, "Investment"),
      currentValue: resolveAssetValue(investment),
      currency: baseCurrency,
      ownerMemberId: investment.ownerMemberId,
      startMonth: resolveAssetStartMonth(investment) ?? "",
      notes: resolveAssetNotes(investment),
      source: investment.source ?? ("manual" as const),
      generatedByEventId: investment.generatedByEventId,
    })),
    ...insurances.map((insurance) => ({
      id: insurance.id ?? createInsurancePositionId(),
      assetType: "insurance" as const,
      name: resolveAssetName(insurance, "Insurance"),
      currentValue: resolveAssetValue(insurance),
      currency: baseCurrency,
      ownerMemberId: insurance.ownerMemberId,
      startMonth: resolveAssetStartMonth(insurance) ?? "",
      notes: resolveAssetNotes(insurance),
      source: insurance.source ?? ("manual" as const),
      generatedByEventId: insurance.generatedByEventId,
    })),
    ...cars.map((car) => ({
      id: car.id ?? createCarPositionId(),
      assetType: "car" as const,
      name: resolveAssetName(car, "Car"),
      currentValue: resolveAssetValue(car),
      currency: baseCurrency,
      ownerMemberId: car.ownerMemberId,
      startMonth: resolveAssetStartMonth(car) ?? "",
      notes: resolveAssetNotes(car),
      purchaseFees: car.purchaseFees,
      ongoingCosts: car.ongoingCosts,
      source: car.source ?? ("manual" as const),
      generatedByEventId: car.generatedByEventId,
    })),
  ];
};

export const applyAssetItemChange = (
  scenario: Scenario,
  change: AssetItemChange
): ScenarioPositions => {
  const baseMonth = scenario.assumptions.baseMonth ?? null;
  const { home: legacyHome, ...positions } = scenario.positions ?? {};
  void legacyHome;
  const homes = normalizeHomes(positions);
  const investments = positions.investments ?? [];
  const insurances = positions.insurances ?? [];
  const cars = positions.cars ?? [];

  const applyHomeUpsert = (item: AssetItemUpsert) => {
    const existing = homes.find((home) => home.id === item.id);
    const base = existing ?? createHomePositionFromTemplate({ baseMonth });
    const next: HomePositionDraft = {
      ...base,
      id: item.id ?? base.id,
      name: item.name ?? base.name,
      ownerMemberId: item.ownerMemberId ?? base.ownerMemberId,
      purchasePrice: item.currentValue ?? base.purchasePrice,
      purchaseMonth: item.startMonth ?? base.purchaseMonth,
      notes: item.notes ?? base.notes,
      purchaseFees: item.purchaseFees ?? base.purchaseFees,
      ongoingCosts: item.ongoingCosts ?? base.ongoingCosts,
      rental: item.rental
        ? {
            isRented: item.rental.isRented,
            rentMonthly: item.rental.rentAmountMonthly,
            rentStartMonth: item.rental.rentStartMonth,
            rentEndMonth: item.rental.rentEndMonth ?? null,
          }
        : base.rental,
      source: item.source ?? base.source,
      generatedByEventId: item.generatedByEventId ?? base.generatedByEventId,
    };
    const nextHomes = existing
      ? homes.map((home) => (home.id === next.id ? next : home))
      : [...homes, next];
    return { ...positions, homes: nextHomes };
  };

  const applyInvestmentUpsert = (item: AssetItemUpsert) => {
    const existing = investments.find((investment) => investment.id === item.id);
    const base = existing ?? createInvestmentPositionFromTemplate({ baseMonth });
    const next: InvestmentPositionDraft = {
      ...base,
      id: item.id ?? base.id,
      name: item.name ?? base.name,
      ownerMemberId: item.ownerMemberId ?? base.ownerMemberId,
      initialValue: item.currentValue ?? base.initialValue,
      startMonth: item.startMonth ?? base.startMonth,
      notes: item.notes ?? base.notes,
      source: item.source ?? base.source,
      generatedByEventId: item.generatedByEventId ?? base.generatedByEventId,
    };
    const nextInvestments = existing
      ? investments.map((entry) => (entry.id === next.id ? next : entry))
      : [...investments, next];
    return { ...positions, homes, investments: nextInvestments };
  };

  const applyInsuranceUpsert = (item: AssetItemUpsert) => {
    const existing = insurances.find((insurance) => insurance.id === item.id);
    const base = existing ?? createInsurancePositionFromTemplate({ baseMonth });
    const next: InsurancePositionDraft = {
      ...base,
      id: item.id ?? base.id,
      name: item.name ?? base.name ?? "",
      ownerMemberId: item.ownerMemberId ?? base.ownerMemberId,
      initialCashValue: item.currentValue ?? base.initialCashValue,
      startMonth: item.startMonth ?? base.startMonth,
      notes: item.notes ?? base.notes,
      source: item.source ?? base.source,
      generatedByEventId: item.generatedByEventId ?? base.generatedByEventId,
    };
    const nextInsurances = existing
      ? insurances.map((entry) => (entry.id === next.id ? next : entry))
      : [...insurances, next];
    return { ...positions, homes, insurances: nextInsurances };
  };

  const applyCarUpsert = (item: AssetItemUpsert) => {
    const existing = cars.find((car) => car.id === item.id);
    const base = existing ?? createCarPositionFromTemplate({ baseMonth });
    const next: CarPositionDraft = {
      ...base,
      id: item.id ?? base.id,
      name: item.name ?? base.name,
      ownerMemberId: item.ownerMemberId ?? base.ownerMemberId,
      purchasePrice: item.currentValue ?? base.purchasePrice,
      purchaseMonth: item.startMonth ?? base.purchaseMonth,
      notes: item.notes ?? base.notes,
      purchaseFees: item.purchaseFees ?? base.purchaseFees,
      ongoingCosts: item.ongoingCosts ?? base.ongoingCosts,
      source: item.source ?? base.source,
      generatedByEventId: item.generatedByEventId ?? base.generatedByEventId,
    };
    const nextCars = existing
      ? cars.map((entry) => (entry.id === next.id ? next : entry))
      : [...cars, next];
    return { ...positions, homes, cars: nextCars };
  };

  if (change.type === "remove") {
    const { item } = change;
    switch (item.assetType) {
      case "property":
        return { ...positions, homes: homes.filter((home) => home.id !== item.id) };
      case "investment":
        return {
          ...positions,
          homes,
          investments: investments.filter((entry) => entry.id !== item.id),
        };
      case "insurance":
        return {
          ...positions,
          homes,
          insurances: insurances.filter((entry) => entry.id !== item.id),
        };
      case "car":
        return {
          ...positions,
          homes,
          cars: cars.filter((entry) => entry.id !== item.id),
        };
      default:
        return positions;
    }
  }

  const { item } = change;
  switch (item.assetType) {
    case "property":
      return applyHomeUpsert(item);
    case "investment":
      return applyInvestmentUpsert(item);
    case "insurance":
      return applyInsuranceUpsert(item);
    case "car":
      return applyCarUpsert(item);
    default:
      return positions;
  }
};
