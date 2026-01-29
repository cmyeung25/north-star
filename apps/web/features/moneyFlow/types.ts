export type MoneyItemKind = "income" | "expense";
export type MoneyItemCadence = "recurring" | "oneOff";
export type MoneyItemSource = "manual" | "eventGenerated" | "derived";
export type MoneyItemSourceType = "event" | "budgetRule";

export type MoneyItemGeneratedBy =
  | {
      type: "assetCost";
      assetId: string;
      subType: "purchaseFee" | "ongoing";
      key: string;
    }
  | {
      type: "assetRental";
      assetId: string;
    }
  | {
      type: "loanPayment";
      liabilityId: string;
    };

export type MoneyItem = {
  id: string;
  kind: MoneyItemKind;
  cadence: MoneyItemCadence;
  amount: number;
  currency: string;
  category: string;
  memberId?: string;
  startMonth?: string | null;
  endMonth?: string | null;
  month?: string | null;
  notes?: string;
  source: MoneyItemSource;
  sourceId?: string;
  sourceType?: MoneyItemSourceType;
  generatedByEventId?: string;
  generatedBy?: MoneyItemGeneratedBy;
  linkedAssetId?: string;
  linkedLiabilityId?: string;
  categoryOverride?: string;
};

export type MoneyItemUpsert = Omit<MoneyItem, "id"> & {
  id?: string;
};
