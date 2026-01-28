export type AssetType = "property" | "investment" | "insurance" | "car";
export type AssetItemSource = "manual" | "derived" | "eventGenerated";

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
  source: AssetItemSource;
};

export type AssetItemUpsert = Omit<AssetItem, "id"> & { id?: string };
