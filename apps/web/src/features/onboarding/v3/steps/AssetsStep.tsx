import {
  Badge,
  Card,
  Group,
  NumberInput,
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
  assetToggles: ScenarioDraftV3AssetToggles;
  onAssetsChange: (assets: OnboardingAsset[]) => void;
  onAssetTogglesChange: (toggles: ScenarioDraftV3AssetToggles) => void;
};

const createCashAsset = (startMonth: string): CashAsset => ({
  id: `asset-${nanoid(6)}`,
  assetType: "cash",
  kind: "cash",
  source: "manual",
  currency: "HKD",
  startMonth,
  amount: 0,
  currentValue: 0,
});

const createPropertyAsset = (startMonth: string): PropertyAsset => ({
  id: `asset-${nanoid(6)}`,
  assetType: "property",
  kind: "home",
  source: "manual",
  currency: "HKD",
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

export default function AssetsStep({
  assets,
  startMonth,
  assetToggles,
  onAssetsChange,
  onAssetTogglesChange,
}: Props) {
  const t = useTranslations("onboardingV3.steps");

  const cashAsset = assets.find((asset): asset is CashAsset => asset.assetType === "cash");
  const propertyAsset = assets.find((asset): asset is PropertyAsset => asset.assetType === "property");
  const investmentAsset = assets.find((asset): asset is InvestmentAsset => asset.assetType === "investment");

  const upsertAsset = <T extends OnboardingAsset>(
    assetType: T["assetType"],
    create: () => T,
    patch: Partial<T>
  ) => {
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

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap={4}>
          <Text fw={600}>{t("assets.title")}</Text>
          <Text size="sm" c="dimmed">
            {t("assets.description")}
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
              upsertAsset("cash", () => createCashAsset(startMonth), {
                amount,
                currentValue: amount,
              });
            }}
          />
          <TextInput
            label={t("assets.fields.cashCurrency")}
            value={cashAsset?.currency ?? "HKD"}
            onChange={(event) =>
              upsertAsset("cash", () => createCashAsset(startMonth), {
                currency: event.currentTarget.value.toUpperCase(),
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
                  onAssetsChange([...assets, createPropertyAsset(startMonth)]);
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
                  upsertAsset("property", () => createPropertyAsset(startMonth), {
                    label: event.currentTarget.value,
                  })
                }
              />
              <NumberInput
                label={t("assets.fields.currentValue")}
                value={propertyAsset?.currentValue ?? 0}
                onChange={(value) =>
                  upsertAsset("property", () => createPropertyAsset(startMonth), {
                    currentValue: typeof value === "number" ? value : 0,
                  })
                }
              />
              <Switch
                checked={(propertyAsset?.usage ?? "self") === "rent"}
                label={t("assets.switches.enableRentIncome")}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked;
                  upsertAsset("property", () => createPropertyAsset(startMonth), {
                    usage: enabled ? "rent" : "self",
                    rentMonthly: enabled ? propertyAsset?.rentMonthly ?? 0 : undefined,
                  });
                }}
              />
              {(propertyAsset?.usage ?? "self") === "rent" ? (
                <NumberInput
                  label={t("assets.fields.rentMonthly")}
                  value={propertyAsset?.rentMonthly ?? 0}
                  onChange={(value) =>
                    upsertAsset("property", () => createPropertyAsset(startMonth), {
                      rentMonthly: typeof value === "number" ? value : 0,
                    })
                  }
                />
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
