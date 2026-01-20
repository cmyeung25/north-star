export type CashflowItem = {
  month: string;
  amount: number;
  source: "event" | "budget" | "home" | "other" | "position" | "smartInvest";
  sourceId: string;
  label?: string;
  category?: string;
  memberId?: string;
  bucketId?: string;
  bucketName?: string;
};
