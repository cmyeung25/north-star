export type AssetType = "property" | "investment" | "insurance" | "car";
export type AssetItemSource = "manual" | "derived" | "eventGenerated";

export type AssetPurchaseFee = {
  id: string;
  label: string;
  amount: number;
  month: string;
};

export type AssetOngoingCost = {
  key: string;
  enabled: boolean;
  amount: number;
  startMonth: string;
};

export type AssetRentalSettings = {
  isRented: boolean;
  rentAmountMonthly: number;
  rentStartMonth: string;
  rentEndMonth?: string | null;
};

export type AssetItem = {
  id: string;
  assetType: AssetType;
  name: string;
  currentValue: number;
  currency: string;
  ownerMemberId?: string;
  startMonth?: string;
  growthRuleId?: string;
  notes?: string;
  purchaseFees?: AssetPurchaseFee[];
  ongoingCosts?: AssetOngoingCost[];
  rental?: AssetRentalSettings;
  source: AssetItemSource;
  generatedByEventId?: string;
};

export type AssetItemUpsert = Omit<AssetItem, "id"> & { id?: string };
