import { Button, Card, Group, NumberInput, Stack, Switch, Text, TextInput } from "@mantine/core";
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
  const updateAsset = (assetId: string, patch: Partial<PropertyAsset>) => {
    onChange(
      assets.map((entry) => (entry.id === assetId ? { ...entry, ...patch } : entry))
    );
  };

  // NOTE: If month inputs are added in this step, use MonthField + YEAR_MONTH_PLACEHOLDER from ./monthFieldConstants.
  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>Assets setup</Text>
            <Text size="sm" c="dimmed">
              Add property / cash / investment assets, then enable only the details you want to include.
            </Text>
          </Stack>

          <Group>
            <Button variant="light" onClick={() => onChange([...assets, createAsset("home", startMonth)])}>
              新增房產
            </Button>
            <Button variant="light" onClick={() => onChange([...assets, createAsset("cash", startMonth)])}>
              新增現金
            </Button>
            <Button variant="light" onClick={() => onChange([...assets, createAsset("investment", startMonth)])}>
              新增投資項
            </Button>
          </Group>

          <Stack gap="md">
            {assets.map((asset) => {
              const isProperty = asset.kind === "home";
              const isInvestment = asset.kind === "investment";
              const isCash = asset.kind === "cash";
              const rentEnabled = asset.usage === "rent";
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
                          {isProperty ? "Property setup" : isInvestment ? "Investment setup" : isCash ? "Cash setup" : "Asset setup"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Kind: {asset.kind}
                        </Text>
                      </Stack>
                      <Button
                        color="red"
                        variant="subtle"
                        onClick={() => onChange(assets.filter((entry) => entry.id !== asset.id))}
                      >
                        Remove
                      </Button>
                    </Group>

                    <Stack gap="md">
                      <TextInput
                        label="Asset label"
                        value={asset.label ?? ""}
                        onChange={(event) => updateAsset(asset.id, { label: event.currentTarget.value })}
                      />

                      <NumberInput
                        label="Current value"
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
                            label="啟用租金收入"
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
                              label="Rent monthly"
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
                            label="啟用每月持有成本"
                            onChange={(event) => {
                              const enabled = event.currentTarget.checked;
                              updateAsset(asset.id, {
                                holdingCostMonthly: enabled
                                  ? asset.holdingCostMonthly ?? 0
                                  : undefined,
                              });
                            }}
                          />
                          {holdingCostEnabled ? (
                            <NumberInput
                              label="Holding cost monthly"
                              value={asset.holdingCostMonthly ?? 0}
                              onChange={(value) =>
                                updateAsset(asset.id, {
                                  holdingCostMonthly:
                                    typeof value === "number" ? value : 0,
                                })
                              }
                            />
                          ) : null}

                          <Switch
                            checked={mortgageEnabled}
                            label="啟用按揭資訊"
                            onChange={(event) => {
                              const enabled = event.currentTarget.checked;
                              updateAsset(asset.id, {
                                mortgagePrincipalOutstanding: enabled
                                  ? asset.mortgagePrincipalOutstanding ?? 0
                                  : undefined,
                                mortgageAnnualInterestRatePct: enabled
                                  ? asset.mortgageAnnualInterestRatePct ?? 0
                                  : undefined,
                                mortgageTermYears: enabled
                                  ? asset.mortgageTermYears ?? 0
                                  : undefined,
                              });
                            }}
                          />
                          {mortgageEnabled ? (
                            <Group grow>
                              <NumberInput
                                label="Mortgage principal"
                                value={asset.mortgagePrincipalOutstanding ?? 0}
                                onChange={(value) =>
                                  updateAsset(asset.id, {
                                    mortgagePrincipalOutstanding:
                                      typeof value === "number" ? value : 0,
                                  })
                                }
                              />
                              <NumberInput
                                label="Rate %"
                                value={asset.mortgageAnnualInterestRatePct ?? 0}
                                onChange={(value) =>
                                  updateAsset(asset.id, {
                                    mortgageAnnualInterestRatePct:
                                      typeof value === "number" ? value : 0,
                                  })
                                }
                              />
                              <NumberInput
                                label="Term years"
                                value={asset.mortgageTermYears ?? 0}
                                onChange={(value) =>
                                  updateAsset(asset.id, {
                                    mortgageTermYears:
                                      typeof value === "number" ? value : 0,
                                  })
                                }
                              />
                            </Group>
                          ) : null}
                        </>
                      ) : null}

                      {isInvestment ? (
                        <Stack gap={4}>
                          <Text size="sm" c="dimmed">
                            可先填寫投資名稱與當前市值；其餘明細可後續補充。
                          </Text>
                        </Stack>
                      ) : null}

                      {isCash ? (
                        <Stack gap={4}>
                          <Text size="sm" c="dimmed">
                            建議填寫現金用途（例如：緊急備用金 / 活存）。
                          </Text>
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
