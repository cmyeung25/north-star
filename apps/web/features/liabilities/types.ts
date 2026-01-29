export type LiabilityType = "mortgage" | "loan" | "carLoan" | "other";
export type LiabilityItemSource = "manual" | "derived" | "eventGenerated";

export type LiabilityItem = {
  id: string;
  liabilityType: LiabilityType;
  name: string;
  principalOutstanding: number;
  currency: string;
  interestRate?: number;
  rateRuleId?: string;
  startMonth?: string;
  maturityMonth?: string;
  termMonths?: number;
  notes?: string;
  purchasePrice?: number;
  downPaymentPercent?: number;
  generatePaymentExpense?: boolean;
  linkedAssetId?: string;
  source: LiabilityItemSource;
  generatedByEventId?: string;
};

export type LiabilityItemUpsert = Omit<LiabilityItem, "id"> & { id?: string };
