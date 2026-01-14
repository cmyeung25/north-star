export type MortgageScheduleParams = {
  principal: number;
  annualRate: number;
  termMonths: number;
  startIndex: number;
  horizonMonths: number;
};

export type MortgageSchedule = {
  paymentMonthly: number;
  interestSeries: number[];
  principalSeries: number[];
  balanceSeries: number[];
};

export function computeMortgageSchedule(
  params: MortgageScheduleParams
): MortgageSchedule {
  const { principal, annualRate, termMonths, startIndex, horizonMonths } = params;
  const interestSeries = Array.from({ length: horizonMonths }, () => 0);
  const principalSeries = Array.from({ length: horizonMonths }, () => 0);
  const balanceSeries = Array.from({ length: horizonMonths }, () => 0);

  if (principal <= 0 || termMonths <= 0 || horizonMonths <= 0) {
    return {
      paymentMonthly: 0,
      interestSeries,
      principalSeries,
      balanceSeries,
    };
  }

  const monthlyRate = annualRate / 12;
  const paymentMonthly =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  let balance = principal;
  const scheduleStart = Math.max(0, startIndex);
  const scheduleEnd = Math.min(horizonMonths, scheduleStart + termMonths);

  for (let i = scheduleStart; i < scheduleEnd; i += 1) {
    const interest = balance * monthlyRate;
    const principalPayment = Math.min(balance, paymentMonthly - interest);
    const nextBalance = Math.max(0, balance - principalPayment);

    interestSeries[i] = interest;
    principalSeries[i] = principalPayment;
    balanceSeries[i] = nextBalance;

    balance = nextBalance;
  }

  return {
    paymentMonthly,
    interestSeries,
    principalSeries,
    balanceSeries,
  };
}
