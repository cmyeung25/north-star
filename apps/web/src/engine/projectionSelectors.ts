import type { ProjectionResult } from "@north-star/engine";
import type { EventDefinition } from "../domain/events/types";
import type { Scenario, ScenarioMember } from "../store/scenarioStore";

export type ProjectionMonthlyRow = {
  month: string;
  cash: number;
  netWorth: number;
  assetsTotal?: number;
  liabilitiesTotal?: number;
};

export type MonthSnapshot = {
  month: string;
  cashEom: number;
  netWorth: number;
  netCashflow: number;
  inflow: number;
  outflow: number;
  assetsTotal: number;
  liabilitiesTotal: number;
};

type MonthSnapshotParams = {
  projection: ProjectionResult | null;
  monthKey: string | null;
  ledgerByMonth?: Record<string, Array<{ amount: number }>>;
  positionCashflowsByMonth?: Record<string, Array<{ amount: number }>>;
};

export const selectMonthSnapshot = ({
  projection,
  monthKey,
  ledgerByMonth,
  positionCashflowsByMonth,
}: MonthSnapshotParams): MonthSnapshot | null => {
  if (!projection || !monthKey) {
    return null;
  }

  const monthIndex = projection.months.indexOf(monthKey);
  if (monthIndex < 0) {
    return null;
  }

  const cashEom = projection.cashBalance[monthIndex] ?? 0;
  const netWorth = projection.netWorth[monthIndex] ?? 0;
  const assetsTotal = projection.assets?.total?.[monthIndex] ?? cashEom + netWorth;
  const liabilitiesTotal = projection.liabilities?.total?.[monthIndex] ?? assetsTotal - netWorth;
  const items = [
    ...(ledgerByMonth?.[monthKey] ?? []),
    ...(positionCashflowsByMonth?.[monthKey] ?? []),
  ];
  const inflow = items.reduce(
    (total, item) => total + (item.amount > 0 ? item.amount : 0),
    0
  );
  const outflow = Math.abs(
    items.reduce((total, item) => total + (item.amount < 0 ? item.amount : 0), 0)
  );

  return {
    month: monthKey,
    cashEom,
    netWorth,
    netCashflow: items.reduce((total, item) => total + item.amount, 0),
    inflow,
    outflow,
    assetsTotal,
    liabilitiesTotal,
  };
};

export const getMonthlyRows = (projection: ProjectionResult): ProjectionMonthlyRow[] =>
  projection.months.map((month, index) => ({
    month,
    cash: projection.cashBalance[index] ?? 0,
    netWorth: projection.netWorth[index] ?? 0,
    assetsTotal: projection.assets?.total?.[index],
    liabilitiesTotal: projection.liabilities?.total?.[index],
  }));

export type BreakdownItemRow = {
  key: string;
  label: string;
  value: number;
};

export type CashflowBreakdownRow = {
  month: string;
  net: number;
  inflow: number;
  outflow: number;
  items: BreakdownItemRow[];
};

export type AssetBreakdownRow = {
  month: string;
  cash: number;
  assets: BreakdownItemRow[];
  liabilities: BreakdownItemRow[];
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
};

type BreakdownLabelTokens = {
  cashLabel: string;
  homeLabel: (index: number, name?: string) => string;
  investmentLabel: (index: number) => string;
  insuranceLabel: (index: number) => string;
  suffixLabels: Record<string, string>;
};

const buildEventLookup = (eventLibrary: EventDefinition[]) =>
  new Map(eventLibrary.map((definition) => [definition.id, definition]));

const buildMemberLookup = (members: ScenarioMember[]) =>
  new Map(members.map((member) => [member.id, member]));

type HomeLookupEntry = {
  home: NonNullable<Scenario["positions"]>["homes"] extends Array<infer Item>
    ? Item | NonNullable<Scenario["positions"]>["home"]
    : NonNullable<Scenario["positions"]>["home"];
  index: number;
};

const buildHomeLookup = (scenario: Scenario) => {
  const homes = scenario.positions?.homes ?? [];
  const lookup = new Map<string, HomeLookupEntry>(
    homes.map((home, index) => [home.id, { home, index }])
  );

  if (homes.length === 0 && scenario.positions?.home) {
    lookup.set("home-1", { home: scenario.positions.home, index: 0 });
  }

  return lookup;
};

export const createBreakdownLabelResolver = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  labels: BreakdownLabelTokens
) => {
  const eventLookup = buildEventLookup(eventLibrary);
  const memberLookup = buildMemberLookup(members);
  const homeLookup = buildHomeLookup(scenario);

  return (key: string) => {
    if (key === "cash") {
      return labels.cashLabel;
    }

    if (key.startsWith("event:")) {
      const [, eventId] = key.split(":");
      const event = eventLookup.get(eventId);
      const baseLabel = event?.title ?? event?.type ?? key;
      const memberName = event?.memberId
        ? memberLookup.get(event.memberId)?.name
        : undefined;
      return memberName ? `${baseLabel} · ${memberName}` : baseLabel;
    }

    if (key.startsWith("home:")) {
      const [, homeId, suffix] = key.split(":");
      const homeRecord = homeLookup.get(homeId);
      const homeName =
        "name" in (homeRecord?.home ?? {})
          ? (homeRecord?.home as { name?: string }).name
          : undefined;
      const baseLabel = labels.homeLabel(
        (homeRecord?.index ?? 0) + 1,
        homeName
      );
      if (!suffix) {
        return baseLabel;
      }
      const suffixLabel = labels.suffixLabels[suffix] ?? suffix;
      return `${baseLabel} · ${suffixLabel}`;
    }

    if (key.startsWith("investment:")) {
      const [, investmentId, suffix] = key.split(":");
      const index = Number(investmentId?.split("-").pop()) || 1;
      const baseLabel = labels.investmentLabel(index);
      if (!suffix) {
        return baseLabel;
      }
      const suffixLabel = labels.suffixLabels[suffix] ?? suffix;
      return `${baseLabel} · ${suffixLabel}`;
    }

    if (key.startsWith("insurance:")) {
      const [, insuranceId, suffix] = key.split(":");
      const index = Number(insuranceId?.split("-").pop()) || 1;
      const baseLabel = labels.insuranceLabel(index);
      if (!suffix) {
        return baseLabel;
      }
      const suffixLabel = labels.suffixLabels[suffix] ?? suffix;
      return `${baseLabel} · ${suffixLabel}`;
    }

    return key;
  };
};

const buildBreakdownItems = (
  entries: Record<string, number[]>,
  index: number,
  resolveLabel: (key: string) => string,
  options: { excludeKeys?: string[] } = {}
) =>
  Object.entries(entries)
    .filter(([key]) => !options.excludeKeys?.includes(key))
    .map(([key, series]) => ({
      key,
      label: resolveLabel(key),
      value: series[index] ?? 0,
    }))
    .filter((item) => item.value !== 0);

export const getCashflowBreakdownRows = (
  projection: ProjectionResult,
  resolveLabel: (key: string) => string
): CashflowBreakdownRow[] => {
  const breakdown = projection.breakdown?.cashflow;
  if (!breakdown) {
    return [];
  }

  return breakdown.months.map((month, index) => {
    const items = buildBreakdownItems(breakdown.byKey, index, resolveLabel);
    const inflow = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
    const outflow = items.reduce((sum, item) => sum + Math.min(item.value, 0), 0);
    const net = breakdown.totals[index] ?? inflow + outflow;

    return {
      month,
      net,
      inflow,
      outflow,
      items,
    };
  });
};

export const getAssetBreakdownRows = (
  projection: ProjectionResult,
  resolveLabel: (key: string) => string
): AssetBreakdownRow[] => {
  const breakdown = projection.breakdown?.assets;
  if (!breakdown) {
    return [];
  }

  return breakdown.months.map((month, index) => {
    const cash = breakdown.assetsByKey.cash?.[index] ?? projection.cashBalance[index] ?? 0;
    const assets = buildBreakdownItems(breakdown.assetsByKey, index, resolveLabel, {
      excludeKeys: ["cash"],
    });
    const liabilities = buildBreakdownItems(
      breakdown.liabilitiesByKey,
      index,
      resolveLabel
    );
    const assetsTotal =
      assets.reduce((sum, item) => sum + item.value, 0) + cash;
    const liabilitiesTotal = liabilities.reduce((sum, item) => sum + item.value, 0);

    return {
      month,
      cash,
      assets,
      liabilities,
      assetsTotal,
      liabilitiesTotal,
      netWorth: assetsTotal - liabilitiesTotal,
    };
  });
};
