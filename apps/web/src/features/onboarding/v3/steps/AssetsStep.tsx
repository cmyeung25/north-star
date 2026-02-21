import { Badge, Button, Card, Group, NumberInput, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import type { ScenarioAssetKind } from "../../../../store/scenarioStore";
import type { PropertyAsset } from "../types";

type Props = {
  assets: PropertyAsset[];
  startMonth: string;
  onChange: (assets: PropertyAsset[]) => void;
};

const createAsset = (kind: ScenarioAssetKind, startMonth: string): PropertyAsset => ({
  id: `asset-${nanoid(6)}`,
  kind,
  source: "manual",
  currency: "HKD",
  startMonth,
});

export default function AssetsStep({ assets, startMonth, onChange }: Props) {
  const t = useTranslations("onboardingV3.steps");
  const usageLabelByValue = {
    self: t("assets.usage.self"),
    rent: t("assets.usage.rent"),
  } as const;

  const updateAsset = (assetId: string, patch: Partial<PropertyAsset>) => {
    onChange(
      assets.map((entry) => (entry.id === assetId ? { ...entry, ...patch } : entry))
    );
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("assets.title")}</Text>
            <Text size="sm" c="dimmed">{t("assets.description")}</Text>
          </Stack>

          <Group>
            <Button variant="light" onClick={() => onChange([...assets, createAsset("home", startMonth)])}>
              {t("assets.actions.addProperty")}
            </Button>
            <Button variant="light" onClick={() => onChange([...assets, createAsset("cash", startMonth)])}>
              {t("assets.actions.addCash")}
            </Button>
            <Button variant="light" onClick={() => onChange([...assets, createAsset("investment", startMonth)])}>
              {t("assets.actions.addInvestment")}
            </Button>
          </Group>

          <Stack gap="md">
            {assets.map((asset) => {
              const isProperty = asset.kind === "home";
              const isInvestment = asset.kind === "investment";
              const isCash = asset.kind === "cash";
              const usage = asset.usage ?? "self";
              const rentEnabled = usage === "rent";
              const holdingCostEnabled = typeof asset.holdingCostMonthly === "number";
              const mortgageEnabled =
                typeof asset.mortgagePrincipalOutstanding === "number" ||
                typeof asset.mortgageAnnualInterestRatePct === "number" ||
                typeof asset.mortgageTermYears === "number";

              return (
                <Card key={asset.id} withBorder radius="md" padding="md">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>
                          {isProperty
                            ? t("assets.card.kind.property")
                            : isInvestment
                              ? t("assets.card.kind.investment")
                              : isCash
                                ? t("assets.card.kind.cash")
                                : t("assets.card.kind.asset")}
                        </Text>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">{t("assets.card.kindLabel", { kind: asset.kind })}</Text>
                          {isProperty ? <Badge size="xs" variant="light">{usageLabelByValue[usage]}</Badge> : null}
                        </Group>
                      </Stack>
                      <Button
                        color="red"
                        variant="subtle"
                        onClick={() => onChange(assets.filter((entry) => entry.id !== asset.id))}
                      >
                        {t("assets.actions.remove")}
                      </Button>
                    </Group>

                    <Stack gap="md">
                      <TextInput
                        label={t("assets.fields.assetLabel")}
                        value={asset.label ?? ""}
                        onChange={(event) => updateAsset(asset.id, { label: event.currentTarget.value })}
                      />

                      <NumberInput
                        label={t("assets.fields.currentValue")}
                        value={asset.currentValue ?? 0}
                        onChange={(value) =>
                          updateAsset(asset.id, {
                            currentValue: typeof value === "number" ? value : 0,
                          })
                        }
                      />

                      {isProperty ? (
                        <>
                          <Switch
                            checked={rentEnabled}
                            label={t("assets.switches.enableRentIncome")}
                            onChange={(event) => {
                              const enabled = event.currentTarget.checked;
                              updateAsset(asset.id, {
                                usage: enabled ? "rent" : "self",
                                rentMonthly: enabled ? asset.rentMonthly ?? 0 : undefined,
                              });
                            }}
                          />
                          {rentEnabled ? (
                            <NumberInput
                              label={t("assets.fields.rentMonthly")}
                              value={asset.rentMonthly ?? 0}
                              onChange={(value) =>
                                updateAsset(asset.id, {
                                  rentMonthly: typeof value === "number" ? value : 0,
                                })
                              }
                            />
                          ) : null}

                          <Switch
                            checked={holdingCostEnabled}
                            label={t("assets.switches.enableHoldingCost")}
                            onChange={(event) => {
                              const enabled = event.currentTarget.checked;
                              updateAsset(asset.id, {
                                holdingCostMonthly: enabled ? asset.holdingCostMonthly ?? 0 : undefined,
                              });
                            }}
                          />
                          {holdingCostEnabled ? (
                            <NumberInput
                              label={t("assets.fields.holdingCostMonthly")}
                              value={asset.holdingCostMonthly ?? 0}
                              onChange={(value) =>
                                updateAsset(asset.id, {
                                  holdingCostMonthly: typeof value === "number" ? value : 0,
                                })
                              }
                            />
                          ) : null}

                          <Switch
                            checked={mortgageEnabled}
                            label={t("assets.switches.enableMortgage")}
                            onChange={(event) => {
                              const enabled = event.currentTarget.checked;
                              updateAsset(asset.id, {
                                mortgagePrincipalOutstanding: enabled ? asset.mortgagePrincipalOutstanding ?? 0 : undefined,
                                mortgageAnnualInterestRatePct: enabled ? asset.mortgageAnnualInterestRatePct ?? 0 : undefined,
                                mortgageTermYears: enabled ? asset.mortgageTermYears ?? 0 : undefined,
                              });
                            }}
                          />
                          {mortgageEnabled ? (
                            <Group grow>
                              <NumberInput
                                label={t("assets.fields.mortgagePrincipal")}
                                value={asset.mortgagePrincipalOutstanding ?? 0}
                                onChange={(value) =>
                                  updateAsset(asset.id, {
                                    mortgagePrincipalOutstanding: typeof value === "number" ? value : 0,
                                  })
                                }
                              />
                              <NumberInput
                                label={t("assets.fields.mortgageRate")}
                                value={asset.mortgageAnnualInterestRatePct ?? 0}
                                onChange={(value) =>
                                  updateAsset(asset.id, {
                                    mortgageAnnualInterestRatePct: typeof value === "number" ? value : 0,
                                  })
                                }
                              />
                              <NumberInput
                                label={t("assets.fields.mortgageTermYears")}
                                value={asset.mortgageTermYears ?? 0}
                                onChange={(value) =>
                                  updateAsset(asset.id, {
                                    mortgageTermYears: typeof value === "number" ? value : 0,
                                  })
                                }
                              />
                            </Group>
                          ) : null}
                        </>
                      ) : null}

                      {isInvestment ? (
                        <Stack gap={4}>
                          <Text size="sm" c="dimmed">{t("assets.hints.investment")}</Text>
                        </Stack>
                      ) : null}

                      {isCash ? (
                        <Stack gap={4}>
                          <Text size="sm" c="dimmed">{t("assets.hints.cash")}</Text>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
