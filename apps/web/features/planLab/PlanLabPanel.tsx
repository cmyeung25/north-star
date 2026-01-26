import {
  Accordion,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FamilyLaunchDraft, PlanLabDraft, PlanLabGoalType } from "../../src/domain/planLab/types";
import type { EventDefinition } from "../../src/domain/events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { useScenarioStore } from "../../src/store/scenarioStore";
import { applyPlanLabDraftToScenario } from "../../src/domain/planLab/applyPlanLabDraftToScenario";
import { normalizeMonthInput, normalizeMonthStrict } from "../../src/utils/month";
import { formatCurrency } from "../../lib/i18n";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { usePlanLabProjectionWithLedger } from "../../src/engine/usePlanLabProjectionWithLedger";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import type { TimeSeriesPoint } from "../overview/types";
import WarningsPanel from "../../components/WarningsPanel";
import { computeFamilyLaunchScorecard } from "../../src/domain/planLab/computeFamilyLaunchScorecard";
import { familyLaunchExperiments } from "../../src/domain/planLab/familyLaunchExperiments";
import { usePlanLabDeepLink } from "./usePlanLabDeepLink";
import { addMonths } from "../../src/domain/members/age";

type ChartType = "netWorth" | "cash" | "netCashflow";

const defaultPurchasePrice = 8_000_000;
const defaultDownPaymentPct = 30;

type PlanLabPanelProps = {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  displayMode: "nominal" | "real";
  deflateSeries: (series: TimeSeriesPoint[]) => TimeSeriesPoint[];
  baselineSeries: {
    cash: TimeSeriesPoint[];
    netWorth: TimeSeriesPoint[];
    netCashflow: TimeSeriesPoint[];
  };
};

const buildPlanLabScenarioName = (
  draft: PlanLabDraft,
  locale: string,
  currency: string,
  t: ReturnType<typeof useTranslations>
) => {
  if (draft.goalType === "family-launch") {
    return t.has("planLabScenarioNameFamily")
      ? t("planLabScenarioNameFamily")
      : "Plan Lab: Family Launch";
  }
  if (draft.housing?.kind === "buy" && draft.housing.purchaseMonth) {
    const price =
      typeof draft.housing.purchasePrice === "number"
        ? formatCurrency(draft.housing.purchasePrice, currency, locale)
        : "";
    return t("planLabScenarioNameBuy", {
      price,
      month: draft.housing.purchaseMonth,
    });
  }
  if (draft.housing?.kind === "rent" && draft.housing.startMonth) {
    const rent =
      typeof draft.housing.monthlyRent === "number"
        ? formatCurrency(draft.housing.monthlyRent, currency, locale)
        : "";
    return t("planLabScenarioNameRent", {
      rent,
      month: draft.housing.startMonth,
    });
  }
  if (draft.babyPlan?.targetMonth) {
    return t("planLabScenarioNameBaby", { month: draft.babyPlan.targetMonth });
  }
  return t("planLabScenarioNameOption");
};

const mergeSeries = (
  baseline: TimeSeriesPoint[],
  option: TimeSeriesPoint[]
) => {
  const monthSet = new Set<string>();
  baseline.forEach((entry) => monthSet.add(entry.month));
  option.forEach((entry) => monthSet.add(entry.month));
  const months = Array.from(monthSet).sort();
  const baselineLookup = baseline.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.month] = entry.value;
    return acc;
  }, {});
  const optionLookup = option.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.month] = entry.value;
    return acc;
  }, {});
  return months.map((month) => ({
    month,
    baseline: baselineLookup[month] ?? null,
    option: optionLookup[month] ?? null,
  }));
};

const getMonthError = (value: string, message: string) => {
  const status = normalizeMonthInput(value);
  if (status.status === "invalid") {
    return message;
  }
  return undefined;
};

export default function PlanLabPanel({
  scenario,
  eventLibrary,
  members,
  budgetRules,
  displayMode,
  deflateSeries,
  baselineSeries,
}: PlanLabPanelProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const router = useRouter();
  const duplicateScenario = useScenarioStore((state) => state.duplicateScenario);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const upsertEventDefinition = useScenarioStore((state) => state.upsertEventDefinition);
  const deepLink = usePlanLabDeepLink(scenario);
  const [goalType, setGoalType] = useState<PlanLabGoalType>(deepLink.goalType);
  const [chartType, setChartType] = useState<ChartType>("netWorth");
  const [housingMode, setHousingMode] = useState<"rent" | "rent-bigger" | "buy">(
    "rent"
  );
  const [rentStartMonth, setRentStartMonth] = useState(
    scenario.assumptions.baseMonth ?? ""
  );
  const [rentMonthly, setRentMonthly] = useState<number | "">(
    scenario.assumptions.rentMonthly ?? ""
  );
  const [purchaseMonth, setPurchaseMonth] = useState(
    scenario.assumptions.baseMonth ?? ""
  );
  const [purchasePrice, setPurchasePrice] = useState<number | "">(
    defaultPurchasePrice
  );
  const [downPaymentPct, setDownPaymentPct] = useState<number | "">(
    defaultDownPaymentPct
  );
  const [downPaymentAmount, setDownPaymentAmount] = useState<number | "">(() => {
    const price =
      typeof purchasePrice === "number" ? purchasePrice : defaultPurchasePrice;
    return Math.round((price * defaultDownPaymentPct) / 100);
  });
  const [mortgageRatePct, setMortgageRatePct] = useState<number | "">(
    scenario.assumptions.mortgageRatePct ?? 2.5
  );
  const [termYears, setTermYears] = useState<number | "">(
    scenario.assumptions.mortgageTermYears ?? 30
  );
  const [babyDueMonth, setBabyDueMonth] = useState("");
  const [babyMonthlyBudget, setBabyMonthlyBudget] = useState<number | "">("");
  const [babyOneOffCost, setBabyOneOffCost] = useState<number | "">("");
  const [buyPanelOpen, setBuyPanelOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [familyWeddingMonth, setFamilyWeddingMonth] = useState(
    deepLink.familyLaunchDraft.wedding?.weddingMonth ?? ""
  );
  const [familyWeddingBudget, setFamilyWeddingBudget] = useState<number | "">(
    deepLink.familyLaunchDraft.wedding?.weddingBudget ?? ""
  );
  const [familyHoneymoonBudget, setFamilyHoneymoonBudget] = useState<number | "">(
    deepLink.familyLaunchDraft.wedding?.honeymoonBudget ?? ""
  );
  const [familyBabyDueMonth, setFamilyBabyDueMonth] = useState(
    deepLink.familyLaunchDraft.baby?.dueMonth ?? ""
  );
  const [familyBabyMonthlyBudget, setFamilyBabyMonthlyBudget] = useState<number | "">(
    deepLink.familyLaunchDraft.baby?.babyMonthlyBudget ?? ""
  );
  const [familyBabyOneOffBudget, setFamilyBabyOneOffBudget] = useState<number | "">(
    deepLink.familyLaunchDraft.baby?.babyOneOffBudget ?? ""
  );
  const [familyBabyDurationMonths, setFamilyBabyDurationMonths] = useState<number | "">(
    deepLink.familyLaunchDraft.baby?.babyDurationMonths ?? 24
  );
  const [familyHousingMode, setFamilyHousingMode] = useState<
    "keep-rent" | "rent-upgrade" | "buy-home"
  >(deepLink.familyLaunchDraft.housing?.housingMode ?? "buy-home");
  const [familyRentStartMonth, setFamilyRentStartMonth] = useState(
    deepLink.familyLaunchDraft.housing?.rentStartMonth ??
      scenario.assumptions.baseMonth ??
      ""
  );
  const [familyCurrentRent, setFamilyCurrentRent] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.currentRent ??
      scenario.assumptions.rentMonthly ??
      ""
  );
  const [familyUpgradedRent, setFamilyUpgradedRent] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.upgradedRent ??
      (scenario.assumptions.rentMonthly
        ? Math.round(scenario.assumptions.rentMonthly * 1.3)
        : "")
  );
  const [familyPurchaseMonth, setFamilyPurchaseMonth] = useState(
    deepLink.familyLaunchDraft.housing?.purchaseMonth ??
      scenario.assumptions.baseMonth ??
      ""
  );
  const [familyHomePrice, setFamilyHomePrice] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.homePrice ?? defaultPurchasePrice
  );
  const [familyDownPaymentPct, setFamilyDownPaymentPct] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.downPaymentPct ?? defaultDownPaymentPct
  );
  const [familyDownPaymentAmount, setFamilyDownPaymentAmount] = useState<
    number | ""
  >(() => {
    if (typeof deepLink.familyLaunchDraft.housing?.downPaymentAmount === "number") {
      return deepLink.familyLaunchDraft.housing.downPaymentAmount;
    }
    const price =
      typeof deepLink.familyLaunchDraft.housing?.homePrice === "number"
        ? deepLink.familyLaunchDraft.housing.homePrice
        : defaultPurchasePrice;
    const pct =
      typeof deepLink.familyLaunchDraft.housing?.downPaymentPct === "number"
        ? deepLink.familyLaunchDraft.housing.downPaymentPct
        : defaultDownPaymentPct;
    return Math.round((price * pct) / 100);
  });
  const [familyMortgageRatePct, setFamilyMortgageRatePct] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.mortgageRatePct ??
      scenario.assumptions.mortgageRatePct ??
      2.5
  );
  const [familyMortgageTermYears, setFamilyMortgageTermYears] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.mortgageTermYears ??
      scenario.assumptions.mortgageTermYears ??
      30
  );
  const [familyOneOffFees, setFamilyOneOffFees] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.oneOffFees ?? ""
  );
  const [familyHoldingCost, setFamilyHoldingCost] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.monthlyHoldingCost ?? ""
  );
  const [familyAppreciationPct, setFamilyAppreciationPct] = useState<number | "">(
    deepLink.familyLaunchDraft.housing?.annualAppreciationPct ?? ""
  );

  const monthInvalidMessage = t("planLabMonthInvalid");
  const rentStartMonthError = getMonthError(rentStartMonth, monthInvalidMessage);
  const purchaseMonthError = getMonthError(purchaseMonth, monthInvalidMessage);
  const babyDueMonthError = getMonthError(babyDueMonth, monthInvalidMessage);
  const familyWeddingMonthError = getMonthError(
    familyWeddingMonth,
    monthInvalidMessage
  );
  const familyBabyDueMonthError = getMonthError(
    familyBabyDueMonth,
    monthInvalidMessage
  );
  const familyRentStartMonthError = getMonthError(
    familyRentStartMonth,
    monthInvalidMessage
  );
  const familyPurchaseMonthError = getMonthError(
    familyPurchaseMonth,
    monthInvalidMessage
  );
  const projectionWarningsTitle = t.has("planLabProjectionWarningsTitle")
    ? t("planLabProjectionWarningsTitle")
    : "Projection warnings";

  useEffect(() => {
    if (deepLink.openPanel) {
      setGoalType("family-launch");
    }
  }, [deepLink.openPanel, setGoalType]);

  const familyDraftSnapshot = useMemo<FamilyLaunchDraft>(() => {
    return {
      wedding: {
        weddingMonth: familyWeddingMonth || undefined,
        weddingBudget:
          typeof familyWeddingBudget === "number" ? familyWeddingBudget : undefined,
        honeymoonBudget:
          typeof familyHoneymoonBudget === "number" ? familyHoneymoonBudget : undefined,
      },
      baby: {
        dueMonth: familyBabyDueMonth || undefined,
        babyMonthlyBudget:
          typeof familyBabyMonthlyBudget === "number"
            ? familyBabyMonthlyBudget
            : undefined,
        babyOneOffBudget:
          typeof familyBabyOneOffBudget === "number"
            ? familyBabyOneOffBudget
            : undefined,
        babyDurationMonths:
          typeof familyBabyDurationMonths === "number"
            ? familyBabyDurationMonths
            : undefined,
      },
      housing: {
        housingMode: familyHousingMode,
        rentStartMonth: familyRentStartMonth || undefined,
        currentRent:
          typeof familyCurrentRent === "number" ? familyCurrentRent : undefined,
        upgradedRent:
          typeof familyUpgradedRent === "number" ? familyUpgradedRent : undefined,
        purchaseMonth: familyPurchaseMonth || undefined,
        homePrice: typeof familyHomePrice === "number" ? familyHomePrice : undefined,
        downPaymentAmount:
          typeof familyDownPaymentAmount === "number"
            ? familyDownPaymentAmount
            : undefined,
        downPaymentPct:
          typeof familyDownPaymentPct === "number" ? familyDownPaymentPct : undefined,
        mortgageRatePct:
          typeof familyMortgageRatePct === "number"
            ? familyMortgageRatePct
            : undefined,
        mortgageTermYears:
          typeof familyMortgageTermYears === "number"
            ? familyMortgageTermYears
            : undefined,
        oneOffFees: typeof familyOneOffFees === "number" ? familyOneOffFees : undefined,
        monthlyHoldingCost:
          typeof familyHoldingCost === "number" ? familyHoldingCost : undefined,
        annualAppreciationPct:
          typeof familyAppreciationPct === "number"
            ? familyAppreciationPct
            : undefined,
      },
    };
  }, [
    familyAppreciationPct,
    familyBabyDueMonth,
    familyBabyDurationMonths,
    familyBabyMonthlyBudget,
    familyBabyOneOffBudget,
    familyCurrentRent,
    familyDownPaymentAmount,
    familyDownPaymentPct,
    familyHoldingCost,
    familyHomePrice,
    familyHoneymoonBudget,
    familyHousingMode,
    familyMortgageRatePct,
    familyMortgageTermYears,
    familyOneOffFees,
    familyPurchaseMonth,
    familyRentStartMonth,
    familyUpgradedRent,
    familyWeddingBudget,
    familyWeddingMonth,
    familyHoneymoonBudget,
  ]);

  const { draft, hasInvalidMonths } = useMemo(() => {
    const invalid =
      (rentStartMonth &&
        !normalizeMonthStrict(rentStartMonth).ok) ||
      (purchaseMonth && !normalizeMonthStrict(purchaseMonth).ok) ||
      (babyDueMonth && !normalizeMonthStrict(babyDueMonth).ok);

    const familyInvalid =
      (familyWeddingMonth && !normalizeMonthStrict(familyWeddingMonth).ok) ||
      (familyBabyDueMonth && !normalizeMonthStrict(familyBabyDueMonth).ok) ||
      (familyRentStartMonth &&
        !normalizeMonthStrict(familyRentStartMonth).ok) ||
      (familyPurchaseMonth &&
        !normalizeMonthStrict(familyPurchaseMonth).ok);

    if ((goalType === "classic" && invalid) || (goalType === "family-launch" && familyInvalid)) {
      return { draft: null, hasInvalidMonths: true };
    }

    const planLabDraft: PlanLabDraft = { goalType };

    if (goalType === "classic") {
      if (housingMode === "rent" || housingMode === "rent-bigger") {
        const normalized = rentStartMonth
          ? normalizeMonthStrict(rentStartMonth)
          : null;
        planLabDraft.housing = {
          kind: "rent",
          startMonth: normalized?.ok ? normalized.month : undefined,
          monthlyRent:
            typeof rentMonthly === "number" ? rentMonthly : undefined,
          annualRentGrowthPct: scenario.assumptions.rentAnnualGrowthPct ?? undefined,
        };
      }

      if (housingMode === "buy") {
        const normalized = purchaseMonth
          ? normalizeMonthStrict(purchaseMonth)
          : null;
        planLabDraft.housing = {
          kind: "buy",
          purchaseMonth: normalized?.ok ? normalized.month : undefined,
          purchasePrice:
            typeof purchasePrice === "number" ? purchasePrice : undefined,
          downPaymentAmount:
            typeof downPaymentAmount === "number" ? downPaymentAmount : undefined,
          downPaymentPct:
            typeof downPaymentPct === "number" ? downPaymentPct : undefined,
          mortgageRatePct:
            typeof mortgageRatePct === "number" ? mortgageRatePct : undefined,
          termYears: typeof termYears === "number" ? termYears : undefined,
        };
      }

      if (
        babyDueMonth ||
        typeof babyMonthlyBudget === "number" ||
        typeof babyOneOffCost === "number"
      ) {
        const normalized = babyDueMonth
          ? normalizeMonthStrict(babyDueMonth)
          : null;
        planLabDraft.babyPlan = {
          targetMonth: normalized?.ok ? normalized.month : undefined,
          monthlyBabyBudget:
            typeof babyMonthlyBudget === "number" ? babyMonthlyBudget : undefined,
          oneOffBabyCost:
            typeof babyOneOffCost === "number" ? babyOneOffCost : undefined,
        };
      }
    }

    if (goalType === "family-launch") {
      const weddingMonth = familyWeddingMonth
        ? normalizeMonthStrict(familyWeddingMonth)
        : null;
      const dueMonth = familyBabyDueMonth
        ? normalizeMonthStrict(familyBabyDueMonth)
        : null;
      const rentStart = familyRentStartMonth
        ? normalizeMonthStrict(familyRentStartMonth)
        : null;
      const purchase = familyPurchaseMonth
        ? normalizeMonthStrict(familyPurchaseMonth)
        : null;

      const familyDraft: FamilyLaunchDraft = {
        wedding: {
          weddingMonth: weddingMonth?.ok ? weddingMonth.month : undefined,
          weddingBudget:
            typeof familyWeddingBudget === "number" ? familyWeddingBudget : undefined,
          honeymoonBudget:
            typeof familyHoneymoonBudget === "number"
              ? familyHoneymoonBudget
              : undefined,
        },
        baby: {
          dueMonth: dueMonth?.ok ? dueMonth.month : undefined,
          babyMonthlyBudget:
            typeof familyBabyMonthlyBudget === "number"
              ? familyBabyMonthlyBudget
              : undefined,
          babyOneOffBudget:
            typeof familyBabyOneOffBudget === "number"
              ? familyBabyOneOffBudget
              : undefined,
          babyDurationMonths:
            typeof familyBabyDurationMonths === "number"
              ? familyBabyDurationMonths
              : undefined,
        },
        housing: {
          housingMode: familyHousingMode,
          currentRent:
            typeof familyCurrentRent === "number" ? familyCurrentRent : undefined,
          upgradedRent:
            typeof familyUpgradedRent === "number" ? familyUpgradedRent : undefined,
          rentStartMonth: rentStart?.ok ? rentStart.month : undefined,
          purchaseMonth: purchase?.ok ? purchase.month : undefined,
          homePrice: typeof familyHomePrice === "number" ? familyHomePrice : undefined,
          downPaymentAmount:
            typeof familyDownPaymentAmount === "number"
              ? familyDownPaymentAmount
              : undefined,
          downPaymentPct:
            typeof familyDownPaymentPct === "number"
              ? familyDownPaymentPct
              : undefined,
          mortgageRatePct:
            typeof familyMortgageRatePct === "number"
              ? familyMortgageRatePct
              : undefined,
          mortgageTermYears:
            typeof familyMortgageTermYears === "number"
              ? familyMortgageTermYears
              : undefined,
          oneOffFees:
            typeof familyOneOffFees === "number" ? familyOneOffFees : undefined,
          monthlyHoldingCost:
            typeof familyHoldingCost === "number" ? familyHoldingCost : undefined,
          annualAppreciationPct:
            typeof familyAppreciationPct === "number"
              ? familyAppreciationPct
              : undefined,
        },
      };

      planLabDraft.familyLaunch = familyDraft;
    }

    return { draft: planLabDraft, hasInvalidMonths: false };
  }, [
    familyAppreciationPct,
    familyBabyDueMonth,
    familyBabyDurationMonths,
    familyBabyMonthlyBudget,
    familyBabyOneOffBudget,
    familyCurrentRent,
    familyDownPaymentAmount,
    familyDownPaymentPct,
    familyHoldingCost,
    familyHomePrice,
    familyHoneymoonBudget,
    familyHousingMode,
    familyMortgageRatePct,
    familyMortgageTermYears,
    familyOneOffFees,
    familyPurchaseMonth,
    familyRentStartMonth,
    familyUpgradedRent,
    familyWeddingBudget,
    familyWeddingMonth,
    babyDueMonth,
    babyMonthlyBudget,
    babyOneOffCost,
    downPaymentAmount,
    downPaymentPct,
    housingMode,
    mortgageRatePct,
    purchaseMonth,
    purchasePrice,
    rentMonthly,
    rentStartMonth,
    goalType,
    scenario.assumptions.rentAnnualGrowthPct,
    termYears,
  ]);

  const applyFamilyDraft = (nextDraft: FamilyLaunchDraft) => {
    setFamilyWeddingMonth(nextDraft.wedding?.weddingMonth ?? "");
    setFamilyWeddingBudget(nextDraft.wedding?.weddingBudget ?? "");
    setFamilyHoneymoonBudget(nextDraft.wedding?.honeymoonBudget ?? "");
    setFamilyBabyDueMonth(nextDraft.baby?.dueMonth ?? "");
    setFamilyBabyMonthlyBudget(nextDraft.baby?.babyMonthlyBudget ?? "");
    setFamilyBabyOneOffBudget(nextDraft.baby?.babyOneOffBudget ?? "");
    setFamilyBabyDurationMonths(nextDraft.baby?.babyDurationMonths ?? 24);
    setFamilyHousingMode(nextDraft.housing?.housingMode ?? "buy-home");
    setFamilyRentStartMonth(
      nextDraft.housing?.rentStartMonth ?? scenario.assumptions.baseMonth ?? ""
    );
    setFamilyCurrentRent(
      nextDraft.housing?.currentRent ?? scenario.assumptions.rentMonthly ?? ""
    );
    setFamilyUpgradedRent(
      nextDraft.housing?.upgradedRent ??
        (scenario.assumptions.rentMonthly
          ? Math.round(scenario.assumptions.rentMonthly * 1.3)
          : "")
    );
    const homePrice = nextDraft.housing?.homePrice ?? defaultPurchasePrice;
    setFamilyHomePrice(homePrice);
    setFamilyPurchaseMonth(
      nextDraft.housing?.purchaseMonth ?? scenario.assumptions.baseMonth ?? ""
    );
    const nextDownPaymentPct =
      nextDraft.housing?.downPaymentPct ?? defaultDownPaymentPct;
    setFamilyDownPaymentPct(nextDownPaymentPct);
    if (nextDraft.housing?.downPaymentAmount !== undefined) {
      setFamilyDownPaymentAmount(nextDraft.housing.downPaymentAmount);
    } else {
      setFamilyDownPaymentAmount(Math.round((homePrice * nextDownPaymentPct) / 100));
    }
    setFamilyMortgageRatePct(
      nextDraft.housing?.mortgageRatePct ??
        scenario.assumptions.mortgageRatePct ??
        2.5
    );
    setFamilyMortgageTermYears(
      nextDraft.housing?.mortgageTermYears ??
        scenario.assumptions.mortgageTermYears ??
        30
    );
    setFamilyOneOffFees(nextDraft.housing?.oneOffFees ?? "");
    setFamilyHoldingCost(nextDraft.housing?.monthlyHoldingCost ?? "");
    setFamilyAppreciationPct(nextDraft.housing?.annualAppreciationPct ?? "");
  };

  const planLabEnabled = Boolean(draft) && !hasInvalidMonths;
  const planLabProjection = usePlanLabProjectionWithLedger(
    planLabEnabled ? draft : null,
    planLabEnabled ? scenario : null,
    eventLibrary,
    { members, budgetRules }
  );

  const optionViewModel = useMemo(
    () =>
      planLabProjection.projection
        ? projectionToOverviewViewModel(planLabProjection.projection)
        : null,
    [planLabProjection.projection]
  );

  const optionSeries = useMemo(() => {
    if (!optionViewModel || !planLabProjection.projection) {
      return {
        cash: [],
        netWorth: [],
        netCashflow: [],
      };
    }
    const netCashflowBase = planLabProjection.months.map((month) => ({
      month,
      value: planLabProjection.projectionNetCashflowByMonth?.[month] ?? 0,
    }));
    const base = {
      cash: optionViewModel.cashSeries ?? [],
      netWorth: optionViewModel.netWorthSeries ?? [],
      netCashflow: netCashflowBase,
    };
    if (displayMode === "real") {
      return {
        cash: deflateSeries(base.cash),
        netWorth: deflateSeries(base.netWorth),
        netCashflow: deflateSeries(base.netCashflow),
      };
    }
    return base;
  }, [deflateSeries, displayMode, optionViewModel, planLabProjection]);

  const familyScorecard = useMemo(() => {
    if (goalType !== "family-launch") {
      return null;
    }
    return computeFamilyLaunchScorecard({
      projection: planLabProjection.projection,
      ledgerByMonth: planLabProjection.ledgerByMonth,
      draft: draft?.familyLaunch ?? familyDraftSnapshot,
    });
  }, [
    draft?.familyLaunch,
    familyDraftSnapshot,
    goalType,
    planLabProjection.ledgerByMonth,
    planLabProjection.projection,
  ]);

  const applicableExperiments = useMemo(
    () =>
      familyLaunchExperiments.filter((experiment) =>
        experiment.applies(familyDraftSnapshot)
      ),
    [familyDraftSnapshot]
  );

  const chartData = useMemo(() => {
    const baseline =
      chartType === "cash"
        ? baselineSeries.cash
        : chartType === "netCashflow"
          ? baselineSeries.netCashflow
          : baselineSeries.netWorth;
    const option =
      chartType === "cash"
        ? optionSeries.cash
        : chartType === "netCashflow"
          ? optionSeries.netCashflow
          : optionSeries.netWorth;
    return mergeSeries(baseline, option);
  }, [baselineSeries, chartType, optionSeries]);

  const hasExistingHomes = Boolean(
    (scenario.positions?.homes && scenario.positions.homes.length > 0) ||
      scenario.positions?.home
  );
  const shouldWarnHomeReplace =
    (goalType === "classic" && housingMode === "buy") ||
    (goalType === "family-launch" && familyHousingMode === "buy-home");
  const saveWarnings = [
    ...(hasInvalidMonths ? [t("planLabSaveInvalidMonths")] : []),
    ...(shouldWarnHomeReplace && hasExistingHomes
      ? [t("planLabHomeReplaceWarning")]
      : []),
  ];
  const scorecardTone = familyScorecard?.status ?? "yellow";
  const scorecardBadgeColor =
    scorecardTone === "green" ? "green" : scorecardTone === "red" ? "red" : "yellow";
  const scorecardStatusLabel =
    scorecardTone === "green"
      ? t.has("planLabFamilyScorecardStatusGreen")
        ? t("planLabFamilyScorecardStatusGreen")
        : "Green"
      : scorecardTone === "red"
        ? t.has("planLabFamilyScorecardStatusRed")
          ? t("planLabFamilyScorecardStatusRed")
          : "Red"
        : t.has("planLabFamilyScorecardStatusYellow")
          ? t("planLabFamilyScorecardStatusYellow")
          : "Yellow";
  const scorecardHeadline =
    scorecardTone === "red"
      ? t.has("planLabFamilyScorecardConclusionRed")
        ? t("planLabFamilyScorecardConclusionRed", {
            month: familyScorecard?.minCash.month ?? "",
          })
        : "Cash dips below zero near a key milestone."
      : scorecardTone === "yellow"
        ? t.has("planLabFamilyScorecardConclusionYellow")
          ? t("planLabFamilyScorecardConclusionYellow", {
              month: familyScorecard?.minCash.month ?? "",
            })
          : "Cash buffer is thin in key windows."
        : t.has("planLabFamilyScorecardConclusionGreen")
          ? t("planLabFamilyScorecardConclusionGreen")
          : "Plan looks resilient across key windows.";
  const missingInputLabels = (familyScorecard?.missingInputs ?? []).map((key) => {
    if (key === "weddingMonth") {
      return t.has("planLabFamilyWeddingMonth")
        ? t("planLabFamilyWeddingMonth")
        : "Wedding month";
    }
    if (key === "dueMonth") {
      return t.has("planLabFamilyBabyDueMonth")
        ? t("planLabFamilyBabyDueMonth")
        : "Due month";
    }
    if (key === "purchaseMonth") {
      return t.has("planLabFamilyPurchaseMonth")
        ? t("planLabFamilyPurchaseMonth")
        : "Purchase month";
    }
    return key;
  });

  const shiftMonth = (value: string, delta: number) => {
    if (!value) {
      return value;
    }
    const normalized = normalizeMonthStrict(value);
    if (!normalized.ok) {
      return value;
    }
    return addMonths(normalized.month, delta);
  };

  const summaryItems = useMemo(() => {
    if (goalType === "family-launch") {
      return [
        familyWeddingMonth
          ? t("planLabSummaryWedding", { month: familyWeddingMonth })
          : null,
        familyBabyDueMonth
          ? t("planLabSummaryBaby", { month: familyBabyDueMonth })
          : null,
        familyHousingMode === "buy-home" && familyPurchaseMonth
          ? t("planLabSummaryBuyHome", { month: familyPurchaseMonth })
          : null,
        familyHousingMode === "rent-upgrade" && familyRentStartMonth
          ? t("planLabSummaryRentUpgrade", { month: familyRentStartMonth })
          : null,
        familyHousingMode === "keep-rent" && familyRentStartMonth
          ? t("planLabSummaryRentStart", { month: familyRentStartMonth })
          : null,
      ].filter(Boolean) as string[];
    }

    return [
      housingMode === "buy" && purchaseMonth
        ? t("planLabSummaryPurchase", { month: purchaseMonth })
        : null,
      (housingMode === "rent" || housingMode === "rent-bigger") && rentStartMonth
        ? t("planLabSummaryRentStart", { month: rentStartMonth })
        : null,
      babyDueMonth
        ? t("planLabSummaryBaby", { month: babyDueMonth })
        : null,
    ].filter(Boolean) as string[];
  }, [
    babyDueMonth,
    familyBabyDueMonth,
    familyHousingMode,
    familyPurchaseMonth,
    familyRentStartMonth,
    familyWeddingMonth,
    goalType,
    housingMode,
    purchaseMonth,
    rentStartMonth,
    t,
  ]);

  const recommendedFixes = useMemo(() => {
    if (goalType === "family-launch") {
      return applicableExperiments.slice(0, 4).map((experiment) => ({
        id: experiment.id,
        label: t.has(experiment.labelKey)
          ? t(experiment.labelKey)
          : experiment.defaultLabel,
        onApply: () =>
          applyFamilyDraft(experiment.apply(familyDraftSnapshot)),
      }));
    }

    const fixes: Array<{ id: string; label: string; onApply: () => void }> = [];
    if (purchaseMonth) {
      fixes.push({
        id: "purchase-plus-6",
        label: t("planLabRecommendedPurchasePlus6"),
        onApply: () => {
          const nextMonth = shiftMonth(purchaseMonth, 6);
          setPurchaseMonth(nextMonth);
        },
      });
    }
    if (housingMode === "buy") {
      fixes.push({
        id: "down-payment-plus-5",
        label: t("planLabRecommendedDownPaymentPlus5"),
        onApply: () => {
          const pct =
            typeof downPaymentPct === "number" ? downPaymentPct + 5 : defaultDownPaymentPct;
          setDownPaymentPct(pct);
          if (typeof purchasePrice === "number") {
            setDownPaymentAmount(Math.round((purchasePrice * pct) / 100));
          }
        },
      });
    }
    if (babyDueMonth) {
      fixes.push({
        id: "baby-plus-6",
        label: t("planLabRecommendedBabyPlus6"),
        onApply: () => {
          const nextMonth = shiftMonth(babyDueMonth, 6);
          setBabyDueMonth(nextMonth);
        },
      });
    }
    if (housingMode === "rent" || housingMode === "rent-bigger") {
      fixes.push({
        id: "rent-plus-1000",
        label: t("planLabRecommendedRentPlus1000"),
        onApply: () => {
          if (typeof rentMonthly === "number") {
            setRentMonthly(rentMonthly + 1000);
          } else {
            setRentMonthly(1000);
          }
        },
      });
    }
    return fixes.slice(0, 4);
  }, [
    applicableExperiments,
    babyDueMonth,
    downPaymentPct,
    familyDraftSnapshot,
    goalType,
    housingMode,
    purchaseMonth,
    purchasePrice,
    rentMonthly,
    t,
  ]);

  const handleSave = () => {
    setSaveError(null);
    if (!draft) {
      setSaveError(t("planLabSaveMissingDraft"));
      return;
    }
    if (hasInvalidMonths) {
      setSaveError(t("planLabSaveInvalidMonths"));
      return;
    }
    const validation = applyPlanLabDraftToScenario(scenario, draft, {
      scenarioId: scenario.id,
    });
    if (validation.errors.length > 0) {
      setSaveError(t("planLabSaveInvalidMonths"));
      return;
    }
    const duplicated = duplicateScenario(scenario.id);
    if (!duplicated) {
      setSaveError(t("planLabSaveFailed"));
      return;
    }
    const result = applyPlanLabDraftToScenario(duplicated, draft, {
      scenarioId: duplicated.id,
    });
    if (result.errors.length > 0) {
      setSaveError(t("planLabSaveInvalidMonths"));
      return;
    }
    result.eventDefinitions.forEach((definition) => {
      upsertEventDefinition(definition);
    });
    const nextScenario = {
      ...result.scenario,
      name: buildPlanLabScenarioName(draft, locale, scenario.baseCurrency, t),
    };
    replaceScenario(nextScenario);
    setActiveScenario(nextScenario.id);
    router.push(`/${locale}${buildScenarioUrl("/dashboard", nextScenario.id)}`);
  };

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs" align="center">
              <Title order={3}>{t("planLabTitle")}</Title>
              <Badge color="blue" variant="light">
                {t("planLabPreviewBadge")}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {t("planLabSubtitle")}
            </Text>
          </Stack>
          <Button
            size="sm"
            variant="light"
            disabled={!planLabEnabled}
            title={planLabEnabled ? t("planLabSaveEnabled") : t("planLabSaveDisabled")}
            onClick={handleSave}
          >
            {t("planLabSave")}
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="md" padding="sm">
        <Text size="sm">{t("planLabSandboxBanner")}</Text>
      </Card>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 6 }} order={{ base: 1, md: 2 }}>
          <Stack gap="lg">
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Text fw={600}>{t("planLabSummaryTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("planLabSummaryBaseline", { name: scenario.name })}
                </Text>
                {summaryItems.length > 0 ? (
                  <Text size="sm">{summaryItems.join(" · ")}</Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("planLabSummaryEmpty")}
                  </Text>
                )}
                <Divider />
                <Stack gap="xs">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabRecommendedTitle")}</Text>
                  </Group>
                  {recommendedFixes.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t("planLabRecommendedEmpty")}
                    </Text>
                  ) : (
                    <Group gap="xs" wrap="wrap">
                      {recommendedFixes.map((fix) => (
                        <Button
                          key={fix.id}
                          size="xs"
                          variant="light"
                          onClick={fix.onApply}
                        >
                          {fix.label}
                        </Button>
                      ))}
                    </Group>
                  )}
                </Stack>
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="lg">
                <Text fw={600}>{t("planLabControlsTitle")}</Text>
                {/* <Stack gap="xs">
                  <Text fw={600}>{t("planLabGoalTitle")}</Text>
                  <SegmentedControl
                    data={[
                      { value: "family-launch", label: t("planLabGoalFamily") },
                      { value: "classic", label: t("planLabGoalClassic") },
                    ]}
                    value={goalType}
                    onChange={(value) => setGoalType(value as PlanLabGoalType)}
                  />
                </Stack> */}

                {goalType === "family-launch" ? (
                  <Accordion multiple defaultValue={["wedding"]}>
                    <Accordion.Item value="wedding">
                      <Accordion.Control>{t("planLabFamilyWeddingTitle")}</Accordion.Control>
                      <Accordion.Panel>
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                          <TextInput
                            label={t("planLabFamilyWeddingMonth")}
                            placeholder="YYYY-MM"
                            value={familyWeddingMonth}
                            onChange={(event) =>
                              setFamilyWeddingMonth(event.currentTarget.value)
                            }
                            error={familyWeddingMonthError}
                          />
                          <NumberInput
                            label={t("planLabFamilyWeddingBudget")}
                            value={familyWeddingBudget}
                            min={0}
                            onChange={(value) =>
                              setFamilyWeddingBudget(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                          <NumberInput
                            label={t("planLabFamilyHoneymoonBudget")}
                            value={familyHoneymoonBudget}
                            min={0}
                            onChange={(value) =>
                              setFamilyHoneymoonBudget(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                        </SimpleGrid>
                      </Accordion.Panel>
                    </Accordion.Item>
                    <Accordion.Item value="baby">
                      <Accordion.Control>{t("planLabFamilyBabyTitle")}</Accordion.Control>
                      <Accordion.Panel>
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                          <TextInput
                            label={t("planLabFamilyBabyDueMonth")}
                            placeholder="YYYY-MM"
                            value={familyBabyDueMonth}
                            onChange={(event) =>
                              setFamilyBabyDueMonth(event.currentTarget.value)
                            }
                            error={familyBabyDueMonthError}
                          />
                          <NumberInput
                            label={t("planLabFamilyBabyMonthlyBudget")}
                            value={familyBabyMonthlyBudget}
                            min={0}
                            onChange={(value) =>
                              setFamilyBabyMonthlyBudget(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                          <NumberInput
                            label={t("planLabFamilyBabyOneOffBudget")}
                            value={familyBabyOneOffBudget}
                            min={0}
                            onChange={(value) =>
                              setFamilyBabyOneOffBudget(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                          <NumberInput
                            label={t("planLabFamilyBabyDuration")}
                            value={familyBabyDurationMonths}
                            min={0}
                            onChange={(value) =>
                              setFamilyBabyDurationMonths(
                                typeof value === "number" ? value : ""
                              )
                            }
                          />
                        </SimpleGrid>
                      </Accordion.Panel>
                    </Accordion.Item>
                    <Accordion.Item value="housing">
                      <Accordion.Control>{t("planLabFamilyHousingTitle")}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <SegmentedControl
                            data={[
                              { value: "keep-rent", label: t("planLabFamilyHousingKeepRent") },
                              {
                                value: "rent-upgrade",
                                label: t("planLabFamilyHousingRentUpgrade"),
                              },
                              { value: "buy-home", label: t("planLabFamilyHousingBuy") },
                            ]}
                            value={familyHousingMode}
                            onChange={(value) => {
                              const nextMode = value as
                                | "keep-rent"
                                | "rent-upgrade"
                                | "buy-home";
                              setFamilyHousingMode(nextMode);
                            }}
                          />
                          {familyHousingMode === "keep-rent" && (
                            <Text size="sm" c="dimmed">
                              {t("planLabFamilyHousingKeepRentHint")}
                            </Text>
                          )}
                          {familyHousingMode === "rent-upgrade" && (
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                              <TextInput
                                label={t("planLabFamilyRentStartMonth")}
                                placeholder="YYYY-MM"
                                value={familyRentStartMonth}
                                onChange={(event) =>
                                  setFamilyRentStartMonth(event.currentTarget.value)
                                }
                                error={familyRentStartMonthError}
                              />
                              <NumberInput
                                label={t("planLabFamilyCurrentRent")}
                                value={familyCurrentRent}
                                min={0}
                                onChange={(value) =>
                                  setFamilyCurrentRent(
                                    typeof value === "number" ? value : ""
                                  )
                                }
                              />
                              <NumberInput
                                label={t("planLabFamilyUpgradedRent")}
                                value={familyUpgradedRent}
                                min={0}
                                onChange={(value) =>
                                  setFamilyUpgradedRent(
                                    typeof value === "number" ? value : ""
                                  )
                                }
                              />
                            </SimpleGrid>
                          )}
                          {familyHousingMode === "buy-home" && (
                            <Stack gap="sm">
                              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                                <TextInput
                                  label={t("planLabFamilyPurchaseMonth")}
                                  placeholder="YYYY-MM"
                                  value={familyPurchaseMonth}
                                  onChange={(event) =>
                                    setFamilyPurchaseMonth(event.currentTarget.value)
                                  }
                                  error={familyPurchaseMonthError}
                                />
                                <NumberInput
                                  label={t("planLabFamilyHomePrice")}
                                  value={familyHomePrice}
                                  min={0}
                                  onChange={(value) =>
                                    setFamilyHomePrice(
                                      typeof value === "number" ? value : ""
                                    )
                                  }
                                />
                                <NumberInput
                                  label={t("planLabFamilyDownPaymentAmount")}
                                  value={familyDownPaymentAmount}
                                  min={0}
                                  onChange={(value) => {
                                    const amount =
                                      typeof value === "number" ? value : "";
                                    setFamilyDownPaymentAmount(amount);
                                    if (
                                      typeof amount === "number" &&
                                      typeof familyHomePrice === "number"
                                    ) {
                                      setFamilyDownPaymentPct(
                                        familyHomePrice > 0
                                          ? Number(
                                              ((amount / familyHomePrice) * 100).toFixed(2)
                                            )
                                          : 0
                                      );
                                    }
                                  }}
                                />
                                <NumberInput
                                  label={t("planLabFamilyDownPaymentPct")}
                                  value={familyDownPaymentPct}
                                  min={0}
                                  max={100}
                                  decimalScale={2}
                                  onChange={(value) => {
                                    const pct =
                                      typeof value === "number" ? value : "";
                                    setFamilyDownPaymentPct(pct);
                                    if (
                                      typeof pct === "number" &&
                                      typeof familyHomePrice === "number"
                                    ) {
                                      setFamilyDownPaymentAmount(
                                        Math.round((familyHomePrice * pct) / 100)
                                      );
                                    }
                                  }}
                                />
                                <NumberInput
                                  label={t("planLabFamilyMortgageRate")}
                                  value={familyMortgageRatePct}
                                  min={0}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    setFamilyMortgageRatePct(
                                      typeof value === "number" ? value : ""
                                    )
                                  }
                                />
                                <NumberInput
                                  label={t("planLabFamilyMortgageTerm")}
                                  value={familyMortgageTermYears}
                                  min={0}
                                  onChange={(value) =>
                                    setFamilyMortgageTermYears(
                                      typeof value === "number" ? value : ""
                                    )
                                  }
                                />
                                <NumberInput
                                  label={t("planLabFamilyOneOffFees")}
                                  value={familyOneOffFees}
                                  min={0}
                                  onChange={(value) =>
                                    setFamilyOneOffFees(
                                      typeof value === "number" ? value : ""
                                    )
                                  }
                                />
                                <NumberInput
                                  label={t("planLabFamilyHoldingCost")}
                                  value={familyHoldingCost}
                                  min={0}
                                  onChange={(value) =>
                                    setFamilyHoldingCost(
                                      typeof value === "number" ? value : ""
                                    )
                                  }
                                />
                                <NumberInput
                                  label={t("planLabFamilyAppreciation")}
                                  value={familyAppreciationPct}
                                  min={0}
                                  decimalScale={2}
                                  onChange={(value) =>
                                    setFamilyAppreciationPct(
                                      typeof value === "number" ? value : ""
                                    )
                                  }
                                />
                              </SimpleGrid>
                            </Stack>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                ) : (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                    <Stack gap="sm">
                      <Text fw={600}>{t("planLabHousingTitle")}</Text>
                      <SegmentedControl
                        data={[
                          { value: "rent", label: t("planLabHousingRent") },
                          { value: "rent-bigger", label: t("planLabHousingRentBigger") },
                          { value: "buy", label: t("planLabHousingBuy") },
                        ]}
                        value={housingMode}
                        onChange={(value) => {
                          const nextMode = value as "rent" | "rent-bigger" | "buy";
                          setHousingMode(nextMode);
                          if (nextMode === "rent") {
                            setRentMonthly(scenario.assumptions.rentMonthly ?? "");
                          }
                          if (nextMode === "rent-bigger") {
                            const baseline = scenario.assumptions.rentMonthly ?? 0;
                            setRentMonthly(Math.round(baseline * 1.3));
                          }
                        }}
                      />
                      {(housingMode === "rent" || housingMode === "rent-bigger") && (
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                          <TextInput
                            label={t("planLabRentStartMonth")}
                            placeholder="YYYY-MM"
                            value={rentStartMonth}
                            onChange={(event) =>
                              setRentStartMonth(event.currentTarget.value)
                            }
                            error={rentStartMonthError}
                          />
                          <NumberInput
                            label={t("planLabRentMonthly")}
                            value={rentMonthly}
                            min={0}
                            onChange={(value) =>
                              setRentMonthly(typeof value === "number" ? value : "")
                            }
                          />
                        </SimpleGrid>
                      )}
                      {housingMode === "buy" && (
                        <Stack gap="sm">
                          <Button
                            size="xs"
                            variant={buyPanelOpen ? "filled" : "light"}
                            onClick={() => setBuyPanelOpen((current) => !current)}
                          >
                            {buyPanelOpen
                              ? t("planLabBuyHideDetails")
                              : t("planLabBuyShowDetails")}
                          </Button>
                          {buyPanelOpen && (
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                              <TextInput
                                label={t("planLabPurchaseMonth")}
                                placeholder="YYYY-MM"
                                value={purchaseMonth}
                                onChange={(event) =>
                                  setPurchaseMonth(event.currentTarget.value)
                                }
                                error={purchaseMonthError}
                              />
                              <NumberInput
                                label={t("planLabPurchasePrice")}
                                value={purchasePrice}
                                min={0}
                                onChange={(value) =>
                                  setPurchasePrice(typeof value === "number" ? value : "")
                                }
                              />
                              <NumberInput
                                label={t("planLabDownPaymentAmount")}
                                value={downPaymentAmount}
                                min={0}
                                onChange={(value) => {
                                  const amount = typeof value === "number" ? value : "";
                                  setDownPaymentAmount(amount);
                                  if (
                                    typeof amount === "number" &&
                                    typeof purchasePrice === "number"
                                  ) {
                                    setDownPaymentPct(
                                      purchasePrice > 0
                                        ? Number(
                                            ((amount / purchasePrice) * 100).toFixed(2)
                                          )
                                        : 0
                                    );
                                  }
                                }}
                              />
                              <NumberInput
                                label={t("planLabDownPaymentPct")}
                                value={downPaymentPct}
                                min={0}
                                max={100}
                                decimalScale={2}
                                onChange={(value) => {
                                  const pct = typeof value === "number" ? value : "";
                                  setDownPaymentPct(pct);
                                  if (
                                    typeof pct === "number" &&
                                    typeof purchasePrice === "number"
                                  ) {
                                    setDownPaymentAmount(
                                      Math.round((purchasePrice * pct) / 100)
                                    );
                                  }
                                }}
                              />
                              <NumberInput
                                label={t("planLabMortgageRate")}
                                value={mortgageRatePct}
                                min={0}
                                decimalScale={2}
                                onChange={(value) =>
                                  setMortgageRatePct(typeof value === "number" ? value : "")
                                }
                              />
                              <NumberInput
                                label={t("planLabMortgageTerm")}
                                value={termYears}
                                min={0}
                                onChange={(value) =>
                                  setTermYears(typeof value === "number" ? value : "")
                                }
                              />
                            </SimpleGrid>
                          )}
                        </Stack>
                      )}
                    </Stack>

                    <Stack gap="sm">
                      <Text fw={600}>{t("planLabBabyTitle")}</Text>
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                        <TextInput
                          label={t("planLabBabyDueMonth")}
                          placeholder="YYYY-MM"
                          value={babyDueMonth}
                          onChange={(event) => setBabyDueMonth(event.currentTarget.value)}
                          error={babyDueMonthError}
                        />
                        <NumberInput
                          label={t("planLabBabyMonthlyBudget")}
                          value={babyMonthlyBudget}
                          min={0}
                          onChange={(value) =>
                            setBabyMonthlyBudget(
                              typeof value === "number" ? value : ""
                            )
                          }
                        />
                        <NumberInput
                          label={t("planLabBabyOneOffCost")}
                          value={babyOneOffCost}
                          min={0}
                          onChange={(value) =>
                            setBabyOneOffCost(typeof value === "number" ? value : "")
                          }
                        />
                      </SimpleGrid>
                    </Stack>
                  </SimpleGrid>
                )}

                <Divider />

                <Stack gap="xs">
                  <WarningsPanel
                    warnings={planLabProjection.projectionWarnings}
                    title={projectionWarningsTitle}
                    defaultOpen={false}
                  />
                  <Text fw={600}>{t("planLabWarningsTitle")}</Text>
                  {saveWarnings.length === 0 && !saveError && (
                    <Text size="sm" c="dimmed">
                      {t("planLabWarningsPlaceholder")}
                    </Text>
                  )}
                  {saveWarnings.map((warning) => (
                    <Text key={warning} size="sm" c="orange">
                      {warning}
                    </Text>
                  ))}
                  {saveError && (
                    <Text size="sm" c="red">
                      {saveError}
                    </Text>
                  )}
                </Stack>
                <Text size="xs" c="dimmed">
                  {t("planLabSaveHint")}
                </Text>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }} order={{ base: 1, md: 2 }}>
          <div style={{ position: "sticky", top: 88 }}>
            <Stack gap="lg">
              <Card withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabFamilyScorecardTitle")}</Text>
                    {goalType === "family-launch" && (
                      <Badge color={scorecardBadgeColor} variant="light">
                        {scorecardStatusLabel}
                      </Badge>
                    )}
                  </Group>
                  {goalType !== "family-launch" && (
                    <Text size="sm" c="dimmed">
                      {t("planLabScorecardFamilyOnly")}
                    </Text>
                  )}
                  {goalType === "family-launch" && !planLabEnabled && (
                    <Text size="sm" c="dimmed">
                      {t("planLabFamilyScorecardDisabled")}
                    </Text>
                  )}
                  {goalType === "family-launch" && planLabEnabled && (
                    <>
                      <Text size="sm" c="dimmed">
                        {scorecardHeadline}
                      </Text>
                      {missingInputLabels.length > 0 && (
                        <Text size="sm" c="dimmed">
                          {t("planLabFamilyScorecardMissing", {
                            items: missingInputLabels.join("、"),
                          })}
                        </Text>
                      )}
                      {familyScorecard && (
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                          <Card withBorder radius="md" padding="sm">
                            <Stack gap={4}>
                              <Text size="sm" fw={600}>
                                {t("planLabFamilyScorecardMinCash")}
                              </Text>
                              <Text size="sm">
                                {formatCurrency(
                                  familyScorecard.minCash.value,
                                  scenario.baseCurrency,
                                  locale
                                )}
                              </Text>
                              {familyScorecard.minCash.month && (
                                <Text size="xs" c="dimmed">
                                  {t("monthLabel", {
                                    month: familyScorecard.minCash.month,
                                  })}
                                </Text>
                              )}
                            </Stack>
                          </Card>
                          <Card withBorder radius="md" padding="sm">
                            <Stack gap={4}>
                              <Text size="sm" fw={600}>
                                {t("planLabFamilyScorecardWindowMin")}
                              </Text>
                              <Text size="sm">
                                {formatCurrency(
                                  familyScorecard.windowMinCash.value,
                                  scenario.baseCurrency,
                                  locale
                                )}
                              </Text>
                              {familyScorecard.windowMinCash.details.length > 0 && (
                                <Text size="xs" c="dimmed">
                                  {familyScorecard.windowMinCash.details
                                    .map((detail) => {
                                      const label =
                                        detail.label === "purchase"
                                          ? t("planLabFamilyScorecardWindowPurchase")
                                          : detail.label === "baby"
                                            ? t("planLabFamilyScorecardWindowBaby")
                                            : t("planLabFamilyScorecardWindowWedding");
                                      return `${label}: ${formatCurrency(
                                        detail.value,
                                        scenario.baseCurrency,
                                        locale
                                      )}`;
                                    })
                                    .join(" · ")}
                                </Text>
                              )}
                            </Stack>
                          </Card>
                          <Card withBorder radius="md" padding="sm">
                            <Stack gap={4}>
                              <Text size="sm" fw={600}>
                                {t("planLabFamilyScorecardRiskMonths")}
                              </Text>
                              {familyScorecard.topRiskMonths.length === 0 && (
                                <Text size="sm" c="dimmed">
                                  {t("planLabFamilyScorecardNoRisk")}
                                </Text>
                              )}
                              {familyScorecard.topRiskMonths.map((entry) => (
                                <Text key={entry.month} size="sm">
                                  {entry.month}:{" "}
                                  {formatCurrency(
                                    entry.value,
                                    scenario.baseCurrency,
                                    locale
                                  )}
                                  {entry.flags.length > 0 && (
                                    <Text component="span" size="sm" c="dimmed">
                                      {" "}
                                      (
                                      {entry.flags
                                        .map((flag) =>
                                          flag === "purchase"
                                            ? t("planLabFamilyRiskTagPurchase")
                                            : flag === "baby"
                                              ? t("planLabFamilyRiskTagBaby")
                                              : t("planLabFamilyRiskTagWedding")
                                        )
                                        .join(" / ")}
                                      )
                                    </Text>
                                  )}
                                </Text>
                              ))}
                            </Stack>
                          </Card>
                          <Card withBorder radius="md" padding="sm">
                            <Stack gap={4}>
                              <Text size="sm" fw={600}>
                                {t("planLabFamilyScorecardBuffer")}
                              </Text>
                              {familyScorecard.buffer.recommended ? (
                                <Text size="sm">
                                  {t("planLabFamilyScorecardBufferNeed", {
                                    amount: formatCurrency(
                                      familyScorecard.buffer.recommended,
                                      scenario.baseCurrency,
                                      locale
                                    ),
                                  })}
                                </Text>
                              ) : (
                                <Text size="sm" c="dimmed">
                                  {t("planLabFamilyScorecardBufferOk")}
                                </Text>
                              )}
                            </Stack>
                          </Card>
                        </SimpleGrid>
                      )}
                    </>
                  )}
                </Stack>
              </Card>

              <Card withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={600}>{t("planLabPreviewTitle")}</Text>
                    <SegmentedControl
                      size="xs"
                      data={[
                        { value: "netWorth", label: t("planLabChartNetWorth") },
                        { value: "cash", label: t("planLabChartCash") },
                        { value: "netCashflow", label: t("planLabChartNetCashflow") },
                      ]}
                      value={chartType}
                      onChange={(value) => setChartType(value as ChartType)}
                    />
                  </Group>
                  {!planLabEnabled && (
                    <Text size="sm" c="dimmed">
                      {t("planLabPreviewDisabled")}
                    </Text>
                  )}
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ left: 8, right: 12 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          width={72}
                          tickFormatter={(value) =>
                            formatCurrency(Number(value), undefined, locale)
                          }
                        />
                        <Tooltip
                          formatter={(value) =>
                            formatCurrency(Number(value), undefined, locale)
                          }
                          labelFormatter={(label) => t("monthLabel", { month: label })}
                        />
                        <Line
                          type="monotone"
                          dataKey="baseline"
                          stroke="#228be6"
                          strokeWidth={2}
                          dot={false}
                          name={t("planLabBaselineLabel")}
                        />
                        <Line
                          type="monotone"
                          dataKey="option"
                          stroke="#12b886"
                          strokeWidth={2}
                          dot={false}
                          name={t("planLabOptionLabel")}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </div>
        </Grid.Col>
      </Grid>
    </Stack>
  );

}
