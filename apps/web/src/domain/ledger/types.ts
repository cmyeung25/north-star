export type CashflowItem = {
  month: string;
  amount: number;
  source: "event" | "budget" | "home" | "other" | "position";
  sourceId: string;
  label?: string;
  category?: string;
  memberId?: string;
};
