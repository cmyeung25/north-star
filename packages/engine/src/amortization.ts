export const calcFixedMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number
): number => {
  if (principal <= 0 || termMonths <= 0) {
    return 0;
  }
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
};

export const applyAmortizationMonth = (
  outstanding: number,
  monthlyRate: number,
  payment: number
): { interest: number; principalPaid: number; nextOutstanding: number } => {
  if (outstanding <= 0) {
    return { interest: 0, principalPaid: 0, nextOutstanding: 0 };
  }
  const interest = outstanding * monthlyRate;
  const rawPrincipal = payment - interest;
  const principalPaid = Math.max(0, Math.min(outstanding, rawPrincipal));
  const nextOutstanding = Math.max(0, outstanding + interest - payment);
  return { interest, principalPaid, nextOutstanding };
};
