import {
  Badge,
  Card,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useTranslations } from "next-intl";
import type {
  CashAsset,
  InvestmentAsset,
  OnboardingAsset,
  PropertyAsset,
  ScenarioDraftV3AssetToggles,
} from "../types";

type Props = {
  assets: OnboardingAsset[];
  startMonth: string;
  baseCurrency: string;
  assetToggles: ScenarioDraftV3AssetToggles;
  onAssetsChange: (assets: OnboardingAsset[]) => void;
  onAssetTogglesChange: (toggles: ScenarioDraftV3AssetToggles) => void;
};

const SUPPORTED_CURRENCY_OPTIONS = ["HKD", "USD", "CNY", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CHF"].map((code) => ({
  value: code,
  label: code,
}));

const createCashAsset = (startMonth: string, currency: string): CashAsset => ({
  id: `asset-${nanoid(6)}`,
  assetType: "cash",
  kind: "cash",
  source: "manual",
  currency,
  startMonth,
  amount: 0,
  currentValue: 0,
});

const createPropertyAsset = (startMonth: string, currency: string): PropertyAsset => ({
  id: `asset-${nanoid(6)}`,
  assetType: "property",
  kind: "home",
  source: "manual",
  currency,
  startMonth,
  usage: "self",
  currentValue: 0,
});

const createInvestmentAsset = (startMonth: string): InvestmentAsset => ({
  id: `asset-${nanoid(6)}`,
  assetType: "investment",
  kind: "investment",
  source: "manual",
  currency: "HKD",
  startMonth,
  principal: 0,
  returnMode: "assumption",
  currentValue: 0,
});

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const resolveMortgageTermMode = (asset?: PropertyAsset): "years" | "months" => {
  if ((asset?.mortgageTermMonths ?? 0) > 0) {
    return "months";
  }
  return "years";
};

const buildMonthlyPayment = (principal: number, annualRatePct: number, totalMonths: number) => {
  if (totalMonths <= 0) {
    return 0;
  }
  const monthlyRate = annualRatePct / 1200;
  if (monthlyRate <= 0) {
    return principal / totalMonths;
  }
  const growth = (1 + monthlyRate) ** totalMonths;
  return (principal * monthlyRate * growth) / (growth - 1);
};

export default function AssetsStep({
  assets,
  startMonth,
  baseCurrency,
  assetToggles,
  onAssetsChange,
  onAssetTogglesChange,
}: Props) {
  const t = useTranslations("onboardingV3.steps");

  const cashAsset = assets.find((asset): asset is CashAsset => asset.assetType === "cash");
  const propertyAsset = assets.find((asset): asset is PropertyAsset => asset.assetType === "property");
  const investmentAsset = assets.find((asset): asset is InvestmentAsset => asset.assetType === "investment");

  const upsertAsset = <T extends OnboardingAsset>(assetType: T["assetType"], create: () => T, patch: Partial<T>) => {
    const existing = assets.find((asset): asset is T => asset.assetType === assetType);
    if (existing) {
      onAssetsChange(assets.map((asset) => (asset.id === existing.id ? { ...existing, ...patch } : asset)));
      return;
    }
    onAssetsChange([...assets, { ...create(), ...patch }]);
  };

  const setToggle = (key: keyof ScenarioDraftV3AssetToggles, enabled: boolean) => {
    onAssetTogglesChange({ ...assetToggles, [key]: enabled });
  };

  const mortgagePrincipal = toFiniteNumber(propertyAsset?.mortgagePrincipalOutstanding);
  const mortgageRate = toFiniteNumber(propertyAsset?.mortgageAnnualInterestRatePct);
  const mortgageTermMonths = toFiniteNumber(propertyAsset?.mortgageTermMonths);
  const mortgageTermYears = toFiniteNumber(propertyAsset?.mortgageTermYears);
  const mortgageTermMode = resolveMortgageTermMode(propertyAsset);
  const normalizedMortgageMonths = mortgageTermMonths ?? ((mortgageTermYears ?? 30) * 12);
  const mortgageMonthlyPayment =
    mortgagePrincipal !== undefined && mortgageRate !== undefined
      ? buildMonthlyPayment(mortgagePrincipal, mortgageRate, normalizedMortgageMonths)
      : undefined;

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap={4}>
          <Text fw={600}>{t("assets.title")}</Text>
          <Text size="sm" c="dimmed">
            {t("assets.description")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("assets.currentHoldingsHint")}
          </Text>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text fw={600}>{t("assets.card.kind.cash")}</Text>
          <NumberInput
            label={t("assets.fields.cashAmount")}
            value={cashAsset?.amount ?? cashAsset?.currentValue ?? 0}
            onChange={(value) => {
              const amount = typeof value === "number" ? value : 0;
              upsertAsset("cash", () => createCashAsset(startMonth, baseCurrency), {
                amount,
                currentValue: amount,
              });
            }}
            description={t("assets.hints.cashCurrentBalance")}
          />
          <Select
            searchable
            label={t("assets.fields.cashCurrency")}
            data={SUPPORTED_CURRENCY_OPTIONS}
            value={cashAsset?.currency ?? baseCurrency}
            onChange={(value) =>
              upsertAsset("cash", () => createCashAsset(startMonth, baseCurrency), {
                currency: value ?? baseCurrency,
              })
            }
          />
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={600}>{t("assets.card.kind.property")}</Text>
              <Badge size="xs" variant="light">
                {t("assets.badges.optional")}
              </Badge>
            </Group>
            <Switch
              checked={assetToggles.propertyEnabled}
              label={t("assets.switches.enableProperty")}
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                setToggle("propertyEnabled", enabled);
                if (enabled && !propertyAsset) {
                  onAssetsChange([...assets, createPropertyAsset(startMonth, baseCurrency)]);
                }
                if (!enabled && propertyAsset) {
                  onAssetsChange(assets.filter((asset) => asset.id !== propertyAsset.id));
                }
              }}
            />
          </Group>

          {assetToggles.propertyEnabled ? (
            <>
              <TextInput
                label={t("assets.fields.assetLabel")}
                value={propertyAsset?.label ?? ""}
                onChange={(event) =>
                  upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                    label: event.currentTarget.value,
                  })
                }
              />
              <NumberInput
                label={t("assets.fields.currentValue")}
                value={propertyAsset?.currentValue ?? 0}
                onChange={(value) =>
                  upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                    currentValue: typeof value === "number" ? value : 0,
                  })
                }
              />
              <SegmentedControl
                data={[
                  { value: "self", label: t("assets.usage.self") },
                  { value: "rent", label: t("assets.usage.rent") },
                ]}
                value={propertyAsset?.usage ?? "self"}
                onChange={(value) =>
                  upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                    usage: value as PropertyAsset["usage"],
                    rentMonthly: value === "rent" ? propertyAsset?.rentMonthly ?? 0 : undefined,
                  })
                }
              />
              <NumberInput
                label={t("assets.fields.holdingCostMonthly")}
                value={propertyAsset?.holdingCostMonthly ?? 0}
                onChange={(value) =>
                  upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                    holdingCostMonthly: typeof value === "number" ? value : 0,
                  })
                }
              />
              {(propertyAsset?.usage ?? "self") === "rent" ? (
                <NumberInput
                  label={t("assets.fields.rentMonthly")}
                  value={propertyAsset?.rentMonthly ?? 0}
                  onChange={(value) =>
                    upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                      rentMonthly: typeof value === "number" ? value : 0,
                    })
                  }
                />
              ) : null}
              <Switch
                checked={propertyAsset?.mortgagePrincipalOutstanding !== undefined}
                label={t("assets.switches.enableMortgage")}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked;
                  upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                    mortgagePrincipalOutstanding: enabled
                      ? propertyAsset?.mortgagePrincipalOutstanding ?? 0
                      : undefined,
                    mortgageTermYears: enabled ? propertyAsset?.mortgageTermYears ?? 30 : undefined,
                    mortgageTermMonths: enabled ? propertyAsset?.mortgageTermMonths : undefined,
                    mortgageAnnualInterestRatePct: enabled
                      ? propertyAsset?.mortgageAnnualInterestRatePct ?? 3
                      : undefined,
                  });
                }}
              />
              {propertyAsset?.mortgagePrincipalOutstanding !== undefined ? (
                <>
                  <NumberInput
                    label={t("assets.fields.mortgagePrincipal")}
                    value={propertyAsset.mortgagePrincipalOutstanding ?? 0}
                    onChange={(value) =>
                      upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                        mortgagePrincipalOutstanding: typeof value === "number" ? value : 0,
                      })
                    }
                  />
                  <Group grow>
                    <SegmentedControl
                      data={[
                        { label: t("assets.fields.mortgageTermMode.years"), value: "years" },
                        { label: t("assets.fields.mortgageTermMode.months"), value: "months" },
                      ]}
                      value={mortgageTermMode}
                      onChange={(value) => {
                        const nextMode = value as "years" | "months";
                        const months = propertyAsset.mortgageTermMonths ?? ((propertyAsset.mortgageTermYears ?? 30) * 12);
                        upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                          mortgageTermYears: nextMode === "years" ? Math.max(1, Math.round(months / 12)) : undefined,
                          mortgageTermMonths: nextMode === "months" ? Math.max(1, months) : undefined,
                        });
                      }}
                    />
                  </Group>
                  <Group grow>
                    {mortgageTermMode === "years" ? (
                    <NumberInput
                      label={t("assets.fields.mortgageTermYears")}
                      value={propertyAsset.mortgageTermYears ?? 30}
                      onChange={(value) => {
                        const years = typeof value === "number" ? value : 30;
                        upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                          mortgageTermYears: years,
                          mortgageTermMonths: undefined,
                        });
                      }}
                    />
                    ) : (
                    <NumberInput
                      label={t("assets.fields.mortgageTermMonths")}
                      value={propertyAsset.mortgageTermMonths ?? ((propertyAsset.mortgageTermYears ?? 30) * 12)}
                      onChange={(value) => {
                        const months = typeof value === "number" ? value : 0;
                        upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                          mortgageTermMonths: months,
                          mortgageTermYears: undefined,
                        });
                      }}
                    />
                    )}
                    <NumberInput
                      label={t("assets.fields.mortgageRate")}
                      value={propertyAsset.mortgageAnnualInterestRatePct ?? 3}
                      onChange={(value) =>
                        upsertAsset("property", () => createPropertyAsset(startMonth, baseCurrency), {
                          mortgageAnnualInterestRatePct: typeof value === "number" ? value : 3,
                        })
                      }
                    />
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t("assets.hints.mortgageAutoProjection")}
                  </Text>
                  {mortgageMonthlyPayment !== undefined ? (
                    <Text size="sm">
                      {t("assets.hints.mortgageMonthlyPayment", { amount: Math.round(mortgageMonthlyPayment).toLocaleString() })}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={600}>{t("assets.card.kind.investment")}</Text>
              <Badge size="xs" variant="light">
                {t("assets.badges.optional")}
              </Badge>
            </Group>
            <Switch
              checked={assetToggles.investmentEnabled}
              label={t("assets.switches.enableInvestment")}
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                setToggle("investmentEnabled", enabled);
                if (enabled && !investmentAsset) {
                  onAssetsChange([...assets, createInvestmentAsset(startMonth)]);
                }
                if (!enabled && investmentAsset) {
                  onAssetsChange(assets.filter((asset) => asset.id !== investmentAsset.id));
                }
              }}
            />
          </Group>

          {assetToggles.investmentEnabled ? (
            <>
              <TextInput
                label={t("assets.fields.assetLabel")}
                value={investmentAsset?.label ?? ""}
                onChange={(event) =>
                  upsertAsset("investment", () => createInvestmentAsset(startMonth), {
                    label: event.currentTarget.value,
                  })
                }
              />
              <NumberInput
                label={t("assets.fields.investmentPrincipal")}
                value={investmentAsset?.principal ?? investmentAsset?.currentValue ?? 0}
                onChange={(value) => {
                  const principal = typeof value === "number" ? value : 0;
                  upsertAsset("investment", () => createInvestmentAsset(startMonth), {
                    principal,
                    currentValue: principal,
                  });
                }}
              />
              <SegmentedControl
                data={[
                  { label: t("assets.fields.returnMode.assumption"), value: "assumption" },
                  { label: t("assets.fields.returnMode.custom"), value: "custom" },
                ]}
                value={investmentAsset?.returnMode ?? "assumption"}
                onChange={(value) =>
                  upsertAsset("investment", () => createInvestmentAsset(startMonth), {
                    returnMode: value as InvestmentAsset["returnMode"],
                    annualReturnRatePct:
                      value === "custom"
                        ? investmentAsset?.annualReturnRatePct ?? 0
                        : undefined,
                  })
                }
              />
              {(investmentAsset?.returnMode ?? "assumption") === "custom" ? (
                <NumberInput
                  label={t("assets.fields.investmentReturnPct")}
                  value={investmentAsset?.annualReturnRatePct ?? 0}
                  onChange={(value) =>
                    upsertAsset("investment", () => createInvestmentAsset(startMonth), {
                      annualReturnRatePct: typeof value === "number" ? value : 0,
                    })
                  }
                />
              ) : null}
              <TextInput
                label={t("assets.fields.investmentStartMonth")}
                value={investmentAsset?.startMonth ?? startMonth}
                onChange={(event) =>
                  upsertAsset("investment", () => createInvestmentAsset(startMonth), {
                    startMonth: event.currentTarget.value,
                  })
                }
              />
            </>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
