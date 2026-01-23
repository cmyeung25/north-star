import { useRef } from "react";

type DownPaymentLastEdited = "amount" | "pct";

type UseDownPaymentSyncOptions = {
  purchasePrice?: number | null;
  downPayment?: number | null;
  onChange: (patch: { purchasePrice?: number; downPayment?: number }) => void;
};

type DownPaymentSyncResult = {
  downPaymentPct: number;
  handlePurchasePriceChange: (value: number | string | null | undefined) => void;
  handleDownPaymentAmountChange: (value: number | string | null | undefined) => void;
  handleDownPaymentPctChange: (value: number | string | null | undefined) => void;
};

const toPositiveNumber = (value: number | string | null | undefined) =>
  Math.max(0, Number(value ?? 0));

export const useDownPaymentSync = ({
  purchasePrice,
  downPayment,
  onChange,
}: UseDownPaymentSyncOptions): DownPaymentSyncResult => {
  const lastEditedRef = useRef<DownPaymentLastEdited>("amount");
  const pctRef = useRef<number | null>(null);

  const resolvedPurchasePrice = toPositiveNumber(purchasePrice);
  const resolvedDownPayment = toPositiveNumber(downPayment);

  const downPaymentPct =
    resolvedPurchasePrice > 0
      ? (resolvedDownPayment / resolvedPurchasePrice) * 100
      : 0;

  const handlePurchasePriceChange = (value: number | string | null | undefined) => {
    const nextPurchasePrice = toPositiveNumber(value);
    if (lastEditedRef.current === "pct") {
      const pctValue =
        pctRef.current ??
        (resolvedPurchasePrice > 0
          ? (resolvedDownPayment / resolvedPurchasePrice) * 100
          : 0);
      pctRef.current = pctValue;
      onChange({
        purchasePrice: nextPurchasePrice,
        downPayment: (nextPurchasePrice * pctValue) / 100,
      });
      return;
    }
    onChange({ purchasePrice: nextPurchasePrice });
  };

  const handleDownPaymentAmountChange = (value: number | string | null | undefined) => {
    lastEditedRef.current = "amount";
    pctRef.current = null;
    onChange({ downPayment: toPositiveNumber(value) });
  };

  const handleDownPaymentPctChange = (value: number | string | null | undefined) => {
    lastEditedRef.current = "pct";
    const pctValue = Math.max(0, Number(value ?? 0));
    pctRef.current = pctValue;
    onChange({
      downPayment: (resolvedPurchasePrice * pctValue) / 100,
    });
  };

  return {
    downPaymentPct,
    handlePurchasePriceChange,
    handleDownPaymentAmountChange,
    handleDownPaymentPctChange,
  };
};
