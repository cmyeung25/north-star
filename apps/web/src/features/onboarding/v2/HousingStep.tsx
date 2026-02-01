"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import MonthField from "../../../../components/MonthField";
import type { OnboardingV2DraftHousing } from "../../../domain/onboarding/v2/draftTypes";

export type HousingErrors = {
  rent: Partial<{
    amount: string;
    startMonth: string;
    endMonth: string;
  }>;
  own: {
    propertyValue?: string;
    startMonth?: string;
    mortgageRatePct?: string;
    mortgageTermMonths?: string;
    mortgagePayment?: string;
    fees: Record<
      string,
      Partial<{ label: string; amount: string; month: string }>
    >;
    ongoingCosts: Record<
      string,
      Partial<{ label: string; amount: string; startMonth: string; endMonth: string }>
    >;
    rental: Partial<{ amount: string; startMonth: string; endMonth: string }>;
  };
};

type HousingStepProps = {
  housing: OnboardingV2DraftHousing;
  baseMonth: string;
  errors: HousingErrors;
  onChange: (next: OnboardingV2DraftHousing) => void;
  t: (key: string, values?: Record<string, number>) => string;
};

const toNumber = (value: number | string) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toOptionalNumber = (value: number | string) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const estimateMonthlyPayment = ({
  principal,
  annualRatePct,
  termMonths,
}: {
  principal: number;
  annualRatePct: number;
  termMonths: number;
}) => {
  if (!Number.isFinite(principal) || principal <= 0) {
    return null;
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    return null;
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    return null;
  }
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return (principal * monthlyRate) / denominator;
};

export default function HousingStep({
  housing,
  baseMonth,
  errors,
  onChange,
  t,
}: HousingStepProps) {
  const updateHousing = (patch: Partial<OnboardingV2DraftHousing>) => {
    onChange({
      ...housing,
      ...patch,
    });
  };

  const updateRent = (
    patch: Partial<OnboardingV2DraftHousing["rent"]>
  ) => {
    updateHousing({
      rent: {
        ...housing.rent,
        ...patch,
      },
    });
  };

  const updateOwn = (
    patch: Partial<OnboardingV2DraftHousing["own"]>
  ) => {
    updateHousing({
      own: {
        ...housing.own,
        ...patch,
      },
    });
  };

  const updateFee = (
    id: string,
    patch: Partial<OnboardingV2DraftHousing["own"]["fees"][number]>
  ) => {
    updateOwn({
      fees: housing.own.fees.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  };

  const addFee = () => {
    updateOwn({
      fees: [
        ...housing.own.fees,
        {
          id: nanoid(6),
          label: "",
          amount: 0,
          month: housing.own.startMonth || baseMonth,
        },
      ],
    });
  };

  const removeFee = (id: string) => {
    updateOwn({
      fees: housing.own.fees.filter((item) => item.id !== id),
    });
  };

  const updateCost = (
    id: string,
    patch: Partial<OnboardingV2DraftHousing["own"]["ongoingCosts"][number]>
  ) => {
    updateOwn({
      ongoingCosts: housing.own.ongoingCosts.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  };

  const addCost = () => {
    updateOwn({
      ongoingCosts: [
        ...housing.own.ongoingCosts,
        {
          id: nanoid(6),
          label: "",
          amount: 0,
          startMonth: housing.own.startMonth || baseMonth,
          endMonth: "",
        },
      ],
    });
  };

  const removeCost = (id: string) => {
    updateOwn({
      ongoingCosts: housing.own.ongoingCosts.filter((item) => item.id !== id),
    });
  };

  const updateRental = (
    patch: Partial<OnboardingV2DraftHousing["own"]["rental"]>
  ) => {
    updateOwn({
      rental: {
        ...housing.own.rental,
        ...patch,
      },
    });
  };

  const propertyValue = toNumber(housing.own.propertyValue);
  const downPaymentPercent =
    housing.own.downPaymentMode === "percent"
      ? toNumber(housing.own.downPaymentPercent ?? 0)
      : propertyValue > 0
        ? (toNumber(housing.own.downPaymentAmount ?? 0) / propertyValue) * 100
        : 0;
  const downPaymentAmount =
    housing.own.downPaymentMode === "percent"
      ? (propertyValue * downPaymentPercent) / 100
      : toNumber(housing.own.downPaymentAmount ?? 0);
  const loanAmount = Math.max(0, propertyValue - downPaymentAmount);

  const estimatedPayment = estimateMonthlyPayment({
    principal: loanAmount,
    annualRatePct: toNumber(housing.own.mortgageRatePct ?? 0),
    termMonths: Math.max(
      1,
      Math.round(toNumber(housing.own.mortgageTermMonths ?? 0))
    ),
  });
  const paymentInput = toNumber(housing.own.mortgagePayment ?? 0);
  const paymentDiff =
    estimatedPayment && paymentInput > 0 ? paymentInput - estimatedPayment : null;

  const rentNetAmount = Math.max(
    0,
    toNumber(housing.own.rental.amount) -
      toNumber(housing.own.rental.discountAmount ?? 0)
  );
  const isRentFree = housing.rent.noPayment ?? false;

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Title order={4}>{t("housingTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("housingHint")}
          </Text>
          <SegmentedControl
            value={housing.mode}
            onChange={(value) =>
              updateHousing({ mode: value === "own" ? "own" : "rent" })
            }
            data={[
              { label: t("housingModeRent"), value: "rent" },
              { label: t("housingModeOwn"), value: "own" },
            ]}
          />
        </Stack>
      </Card>

      {housing.mode === "rent" ? (
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Title order={5}>{t("housingRentTitle")}</Title>
            <Text size="sm" c="dimmed">
              {t("housingRentHint")}
            </Text>
            <Switch
              checked={isRentFree}
              label={t("housingRentNoPayment")}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                updateRent({
                  noPayment: checked,
                  amount: checked ? 0 : housing.rent.amount,
                  startMonth: checked
                    ? ""
                    : housing.rent.startMonth || baseMonth,
                  endMonth: checked ? "" : housing.rent.endMonth ?? "",
                });
              }}
            />
            {!isRentFree && (
              <>
                <NumberInput
                  label={t("housingRentAmount")}
                  min={0}
                  value={housing.rent.amount}
                  error={errors.rent.amount}
                  onChange={(value) => updateRent({ amount: toNumber(value) })}
                />
                <Group grow align="flex-start">
                  <MonthField
                    label={t("housingRentStartMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={housing.rent.startMonth ?? ""}
                    error={errors.rent.startMonth}
                    onChange={(value) => updateRent({ startMonth: value })}
                  />
                  <MonthField
                    label={t("housingRentEndMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={housing.rent.endMonth ?? ""}
                    error={errors.rent.endMonth}
                    onChange={(value) => updateRent({ endMonth: value })}
                  />
                </Group>
                <NumberInput
                  label={t("housingRentGrowth")}
                  min={0}
                  value={housing.rent.rentGrowthPct ?? ""}
                  onChange={(value) =>
                    updateRent({ rentGrowthPct: toOptionalNumber(value) })
                  }
                />
                <Text size="xs" c="dimmed">
                  {t("housingRentGrowthHint")}
                </Text>
              </>
            )}
          </Stack>
        </Card>
      ) : (
        <Stack gap="md">
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Title order={5}>{t("housingOwnTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("housingOwnHint")}
              </Text>
              <Group grow align="flex-start">
                <NumberInput
                  label={t("housingPropertyValue")}
                  min={0}
                  value={housing.own.propertyValue}
                  error={errors.own.propertyValue}
                  onChange={(value) => updateOwn({ propertyValue: toNumber(value) })}
                />
                <MonthField
                  label={t("housingPropertyStartMonth")}
                  placeholder={t("monthPlaceholder")}
                  value={housing.own.startMonth ?? ""}
                  error={errors.own.startMonth}
                  onChange={(value) => updateOwn({ startMonth: value })}
                />
              </Group>

              <Divider />

              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t("housingDownPaymentTitle")}
                </Text>
                <SegmentedControl
                  value={housing.own.downPaymentMode}
                  onChange={(value) =>
                    updateOwn({
                      downPaymentMode: value === "amount" ? "amount" : "percent",
                    })
                  }
                  data={[
                    { label: t("housingDownPaymentPercent"), value: "percent" },
                    { label: t("housingDownPaymentAmount"), value: "amount" },
                  ]}
                />
                {housing.own.downPaymentMode === "percent" ? (
                  <NumberInput
                    label={t("housingDownPaymentPercent")}
                    min={0}
                    max={100}
                    value={housing.own.downPaymentPercent ?? 0}
                    onChange={(value) =>
                      updateOwn({ downPaymentPercent: toNumber(value) })
                    }
                  />
                ) : (
                  <NumberInput
                    label={t("housingDownPaymentAmount")}
                    min={0}
                    value={housing.own.downPaymentAmount ?? 0}
                    onChange={(value) =>
                      updateOwn({ downPaymentAmount: toNumber(value) })
                    }
                  />
                )}
                <Text size="xs" c="dimmed">
                  {t("housingDownPaymentSummary", {
                    downPayment: Number(downPaymentAmount.toFixed(0)),
                    loanAmount: Number(loanAmount.toFixed(0)),
                  })}
                </Text>
              </Stack>

              <Divider />

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {t("housingMortgageTitle")}
                  </Text>
                  <Switch
                    checked={housing.own.mortgageEnabled}
                    label={t("housingMortgageToggle")}
                    onChange={(event) =>
                      updateOwn({ mortgageEnabled: event.currentTarget.checked })
                    }
                  />
                </Group>
                {housing.own.mortgageEnabled && (
                  <Stack gap="xs">
                    <Group grow align="flex-start">
                      <NumberInput
                        label={t("housingMortgageRate")}
                        min={0}
                        value={housing.own.mortgageRatePct ?? 0}
                        error={errors.own.mortgageRatePct}
                        onChange={(value) =>
                          updateOwn({ mortgageRatePct: toNumber(value) })
                        }
                      />
                      <NumberInput
                        label={t("housingMortgageTermMonths")}
                        min={1}
                        value={housing.own.mortgageTermMonths ?? 0}
                        error={errors.own.mortgageTermMonths}
                        onChange={(value) =>
                          updateOwn({ mortgageTermMonths: toNumber(value) })
                        }
                      />
                    </Group>
                    <NumberInput
                      label={t("housingMortgagePayment")}
                      min={0}
                      value={housing.own.mortgagePayment ?? 0}
                      error={errors.own.mortgagePayment}
                      onChange={(value) =>
                        updateOwn({ mortgagePayment: toNumber(value) })
                      }
                    />
                    <Text size="xs" c="dimmed">
                      {t("housingMortgageEstimate", {
                        amount: Number((estimatedPayment ?? 0).toFixed(0)),
                      })}
                    </Text>
                    {paymentDiff !== null && (
                      <Text size="xs" c="dimmed">
                        {t("housingMortgageDifference", {
                          diff: Number(paymentDiff.toFixed(0)),
                        })}
                      </Text>
                    )}
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group align="center" justify="space-between">
                <Title order={5}>{t("housingFeesTitle")}</Title>
                <Badge variant="light">{t("livingOptional")}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {t("housingFeesHint")}
              </Text>
              {housing.own.fees.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("housingFeesEmpty")}
                </Text>
              ) : (
                <Stack gap="sm">
                  {housing.own.fees.map((fee) => (
                    <Card key={fee.id} withBorder radius="md" padding="sm">
                      <Stack gap="xs">
                        <TextInput
                          label={t("housingFeeLabel")}
                          value={fee.label}
                          error={errors.own.fees[fee.id]?.label}
                          onChange={(event) =>
                            updateFee(fee.id, { label: event.currentTarget.value })
                          }
                        />
                        <Group grow align="flex-start">
                          <NumberInput
                            label={t("housingFeeAmount")}
                            min={0}
                            value={fee.amount}
                            error={errors.own.fees[fee.id]?.amount}
                            onChange={(value) =>
                              updateFee(fee.id, { amount: toNumber(value) })
                            }
                          />
                          <MonthField
                            label={t("housingFeeMonth")}
                            placeholder={t("monthPlaceholder")}
                            value={fee.month ?? ""}
                            error={errors.own.fees[fee.id]?.month}
                            onChange={(value) => updateFee(fee.id, { month: value })}
                          />
                        </Group>
                        <Button
                          variant="subtle"
                          color="red"
                          onClick={() => removeFee(fee.id)}
                        >
                          {t("incomeRemove")}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
              <Button variant="light" onClick={addFee}>
                {t("housingFeesAdd")}
              </Button>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group align="center" justify="space-between">
                <Title order={5}>{t("housingOngoingCostsTitle")}</Title>
                <Badge variant="light">{t("livingOptional")}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {t("housingOngoingCostsHint")}
              </Text>
              {housing.own.ongoingCosts.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("housingOngoingCostsEmpty")}
                </Text>
              ) : (
                <Stack gap="sm">
                  {housing.own.ongoingCosts.map((cost) => (
                    <Card key={cost.id} withBorder radius="md" padding="sm">
                      <Stack gap="xs">
                        <TextInput
                          label={t("housingCostLabel")}
                          value={cost.label}
                          error={errors.own.ongoingCosts[cost.id]?.label}
                          onChange={(event) =>
                            updateCost(cost.id, { label: event.currentTarget.value })
                          }
                        />
                        <Group grow align="flex-start">
                          <NumberInput
                            label={t("housingCostAmount")}
                            min={0}
                            value={cost.amount}
                            error={errors.own.ongoingCosts[cost.id]?.amount}
                            onChange={(value) =>
                              updateCost(cost.id, { amount: toNumber(value) })
                            }
                          />
                          <MonthField
                            label={t("housingCostStartMonth")}
                            placeholder={t("monthPlaceholder")}
                            value={cost.startMonth ?? ""}
                            error={errors.own.ongoingCosts[cost.id]?.startMonth}
                            onChange={(value) =>
                              updateCost(cost.id, { startMonth: value })
                            }
                          />
                        </Group>
                        <MonthField
                          label={t("housingCostEndMonth")}
                          placeholder={t("monthPlaceholder")}
                          value={cost.endMonth ?? ""}
                          error={errors.own.ongoingCosts[cost.id]?.endMonth}
                          onChange={(value) => updateCost(cost.id, { endMonth: value })}
                        />
                        <Button
                          variant="subtle"
                          color="red"
                          onClick={() => removeCost(cost.id)}
                        >
                          {t("incomeRemove")}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
              <Button variant="light" onClick={addCost}>
                {t("housingOngoingCostsAdd")}
              </Button>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group align="center" justify="space-between">
                <Title order={5}>{t("housingRentalTitle")}</Title>
                <Badge variant="light">{t("livingOptional")}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {t("housingRentalHint")}
              </Text>
              <Switch
                label={t("housingRentalToggle")}
                checked={housing.own.rental.enabled}
                onChange={(event) =>
                  updateRental({ enabled: event.currentTarget.checked })
                }
              />
              {housing.own.rental.enabled && (
                <Stack gap="xs">
                  <NumberInput
                    label={t("housingRentalAmount")}
                    min={0}
                    value={housing.own.rental.amount}
                    error={errors.own.rental.amount}
                    onChange={(value) => updateRental({ amount: toNumber(value) })}
                  />
                  <Group grow align="flex-start">
                    <MonthField
                      label={t("housingRentalStartMonth")}
                      placeholder={t("monthPlaceholder")}
                      value={housing.own.rental.startMonth ?? ""}
                      error={errors.own.rental.startMonth}
                      onChange={(value) => updateRental({ startMonth: value })}
                    />
                    <MonthField
                      label={t("housingRentalEndMonth")}
                      placeholder={t("monthPlaceholder")}
                      value={housing.own.rental.endMonth ?? ""}
                      error={errors.own.rental.endMonth}
                      onChange={(value) => updateRental({ endMonth: value })}
                    />
                  </Group>
                  <NumberInput
                    label={t("housingRentalDiscountAmount")}
                    min={0}
                    value={housing.own.rental.discountAmount ?? 0}
                    onChange={(value) =>
                      updateRental({ discountAmount: toNumber(value) })
                    }
                  />
                  <Text size="xs" c="dimmed">
                    {t("housingRentalNetSummary", {
                      amount: Number(rentNetAmount.toFixed(0)),
                    })}
                  </Text>
                </Stack>
              )}
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
