export type CashflowItem = {
  month: string;
  amount: number;
  source: "event" | "budget";
  sourceId: string;
  label?: string;
  category?: string;
  memberId?: string;
};
