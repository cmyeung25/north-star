"use client";

import {
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";
import TemplatePicker from "../../components/eventTemplates/TemplatePicker";
import { formatCurrency } from "../../lib/i18n";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import type { MoneyItemCadence } from "../moneyFlow/types";
import {
  compileEventToOps,
} from "../../src/domain/milestoneEvents/compiler";
import type {
  MilestoneEvent,
  MilestoneEventDraft,
  MilestoneEventType,
  MilestoneScenarioSnapshot,
} from "../../src/domain/milestoneEvents/types";
import type { TemplateDef, TemplateId } from "../../src/domain/eventTemplates/types";

type MilestoneTemplatePreset = {
  eventType: MilestoneEventType;
  cadence?: MoneyItemCadence;
  assetType?: AssetPayloadDraft["assetType"];
  liabilityType?: LiabilityPayloadDraft["liabilityType"];
};

const resolveMilestoneTemplatePreset = (templateId: TemplateId): MilestoneTemplatePreset => {
  switch (templateId) {
    case "monthly_salary":
    case "salary_adjustment":
    case "rental_income":
    case "dividends_interest":
      return { eventType: "income", cadence: "recurring" };
    case "bonus_13th":
      return { eventType: "income", cadence: "oneOff" };
    case "living_total":
    case "living_breakdown":
    case "rent_housing":
    case "insurance_quick":
    case "insurance_detailed":
    case "childcare_monthly":
      return { eventType: "expense", cadence: "recurring" };
    case "one_time_big_expense":
      return { eventType: "expense", cadence: "oneOff" };
    case "mortgage_home_purchase":
      return { eventType: "liability", liabilityType: "mortgage" };
    case "housing_fees_rates":
      return { eventType: "expense", cadence: "recurring" };
    case "buy_car":
      return { eventType: "asset", assetType: "car" };
    case "monthly_investing":
      return { eventType: "asset", assetType: "investment" };
    case "personal_loan":
      return { eventType: "liability", liabilityType: "loan" };
    case "car_loan":
      return { eventType: "liability", liabilityType: "carLoan" };
    case "credit_card_balance":
      return { eventType: "liability", liabilityType: "other" };
    default:
      return { eventType: "income", cadence: "recurring" };
  }
};

type MoneyPayloadDraft = {
  cadence: MoneyItemCadence;
  amount: string;
  currency: string;
  category: string;
  memberId: string;
  startMonth: string;
  endMonth: string;
  month: string;
  notes: string;
};

type AssetPayloadDraft = {
  assetType: "property" | "investment" | "insurance" | "car";
  name: string;
  currentValue: string;
  currency: string;
  ownerMemberId: string;
  startMonth: string;
  notes: string;
};

type LiabilityPayloadDraft = {
  liabilityType: "mortgage" | "loan" | "carLoan" | "other";
  name: string;
  principalOutstanding: string;
  currency: string;
  interestRate: string;
  startMonth: string;
  termMonths: string;
  notes: string;
};

type EventDraftState = {
  id?: string;
  eventType: MilestoneEventType;
  effectiveMonth: string;
  notes: string;
  money: MoneyPayloadDraft;
  asset: AssetPayloadDraft;
  liability: LiabilityPayloadDraft;
};

const buildDefaultDraft = (
  baseCurrency: string,
  members: ScenarioMember[],
  event?: MilestoneEvent | null
): EventDraftState => {
  const defaultMemberId = members[0]?.id ?? "";
  if (event) {
    const base: EventDraftState = {
      id: event.id,
      eventType: event.eventType,
      effectiveMonth: event.effectiveMonth,
      notes: event.notes ?? "",
      money: {
        cadence: "recurring",
        amount: "",
        currency: baseCurrency,
        category: "",
        memberId: defaultMemberId,
        startMonth: event.effectiveMonth,
        endMonth: "",
        month: event.effectiveMonth,
        notes: "",
      },
      asset: {
        assetType: "investment",
        name: "",
        currentValue: "",
        currency: baseCurrency,
        ownerMemberId: defaultMemberId,
        startMonth: event.effectiveMonth,
        notes: "",
      },
      liability: {
        liabilityType: "loan",
        name: "",
        principalOutstanding: "",
        currency: baseCurrency,
        interestRate: "",
        startMonth: event.effectiveMonth,
        termMonths: "",
        notes: "",
      },
    };

    if (event.payload.kind === "money") {
      base.money = {
        cadence: event.payload.data.cadence,
        amount: String(event.payload.data.amount ?? ""),
        currency: event.payload.data.currency ?? baseCurrency,
        category: event.payload.data.category ?? "",
        memberId: event.payload.data.memberId ?? defaultMemberId,
        startMonth: event.payload.data.startMonth ?? event.effectiveMonth,
        endMonth: event.payload.data.endMonth ?? "",
        month: event.payload.data.month ?? event.effectiveMonth,
        notes: event.payload.data.notes ?? "",
      };
    }

    if (event.payload.kind === "asset") {
      base.asset = {
        assetType: event.payload.data.assetType,
        name: event.payload.data.name ?? "",
        currentValue: String(event.payload.data.currentValue ?? ""),
        currency: event.payload.data.currency ?? baseCurrency,
        ownerMemberId: event.payload.data.ownerMemberId ?? defaultMemberId,
        startMonth: event.payload.data.startMonth ?? event.effectiveMonth,
        notes: event.payload.data.notes ?? "",
      };
    }

    if (event.payload.kind === "liability") {
      base.liability = {
        liabilityType: event.payload.data.liabilityType,
        name: event.payload.data.name ?? "",
        principalOutstanding: String(event.payload.data.principalOutstanding ?? ""),
        currency: event.payload.data.currency ?? baseCurrency,
        interestRate:
          event.payload.data.interestRate !== undefined
            ? String(event.payload.data.interestRate)
            : "",
        startMonth: event.payload.data.startMonth ?? event.effectiveMonth,
        termMonths:
          event.payload.data.termMonths !== undefined
            ? String(event.payload.data.termMonths)
            : "",
        notes: event.payload.data.notes ?? "",
      };
    }

    return base;
  }

  return {
    id: `milestone-${nanoid(8)}`,
    eventType: "income",
    effectiveMonth: "",
    notes: "",
    money: {
      cadence: "recurring",
      amount: "",
      currency: baseCurrency,
      category: "",
      memberId: defaultMemberId,
      startMonth: "",
      endMonth: "",
      month: "",
      notes: "",
    },
    asset: {
      assetType: "investment",
      name: "",
      currentValue: "",
      currency: baseCurrency,
      ownerMemberId: defaultMemberId,
      startMonth: "",
      notes: "",
    },
    liability: {
      liabilityType: "loan",
      name: "",
      principalOutstanding: "",
      currency: baseCurrency,
      interestRate: "",
      startMonth: "",
      termMonths: "",
      notes: "",
    },
  };
};

const buildEventFromDraft = (draft: EventDraftState): MilestoneEvent => {
  const eventId = draft.id ?? `milestone-${nanoid(8)}`;

  if (draft.eventType === "income" || draft.eventType === "expense") {
    return {
      id: eventId,
      eventType: draft.eventType,
      effectiveMonth: draft.effectiveMonth,
      notes: draft.notes || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        kind: "money",
        data: {
          cadence: draft.money.cadence,
          amount: Number(draft.money.amount),
          currency: draft.money.currency,
          category: draft.money.category,
          memberId: draft.money.memberId || undefined,
          startMonth: draft.money.startMonth || undefined,
          endMonth: draft.money.endMonth || undefined,
          month: draft.money.month || undefined,
          notes: draft.money.notes || undefined,
        },
      },
    };
  }

  if (draft.eventType === "asset") {
    return {
      id: eventId,
      eventType: "asset",
      effectiveMonth: draft.effectiveMonth,
      notes: draft.notes || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        kind: "asset",
        data: {
          assetType: draft.asset.assetType,
          name: draft.asset.name,
          currentValue: Number(draft.asset.currentValue),
          currency: draft.asset.currency,
          ownerMemberId: draft.asset.ownerMemberId || undefined,
          startMonth: draft.asset.startMonth || undefined,
          notes: draft.asset.notes || undefined,
        },
      },
    };
  }

  return {
    id: eventId,
    eventType: "liability",
    effectiveMonth: draft.effectiveMonth,
    notes: draft.notes || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      kind: "liability",
      data: {
        liabilityType: draft.liability.liabilityType,
        name: draft.liability.name,
        principalOutstanding: Number(draft.liability.principalOutstanding),
        currency: draft.liability.currency,
        interestRate: draft.liability.interestRate ? Number(draft.liability.interestRate) : undefined,
        startMonth: draft.liability.startMonth || undefined,
        termMonths: draft.liability.termMonths ? Number(draft.liability.termMonths) : undefined,
        notes: draft.liability.notes || undefined,
      },
    },
  };
};

type EventWizardProps = {
  opened: boolean;
  onClose: () => void;
  baseCurrency: string;
  members: ScenarioMember[];
  incomeCategories: Array<{ value: string; label: string }>;
  expenseCategories: Array<{ value: string; label: string }>;
  budgetCategories: Array<{ value: string; label: string }>;
  snapshot: MilestoneScenarioSnapshot;
  initialEvent?: MilestoneEvent | null;
  onApply: (draft: MilestoneEventDraft) => void;
};

export default function EventWizard({
  opened,
  onClose,
  baseCurrency,
  members,
  incomeCategories,
  expenseCategories,
  budgetCategories,
  snapshot,
  initialEvent,
  onApply,
}: EventWizardProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EventDraftState>(() =>
    buildDefaultDraft(baseCurrency, members, initialEvent ?? null)
  );

  useEffect(() => {
    if (!opened) {
      return;
    }
    setDraft(buildDefaultDraft(baseCurrency, members, initialEvent ?? null));
    setStep(0);
  }, [opened, baseCurrency, members, initialEvent]);

  const handleTemplateSelect = (template: TemplateDef) => {
    const preset = resolveMilestoneTemplatePreset(template.id);
    setDraft((current) => {
      const nextDraft = { ...current, eventType: preset.eventType };
      if (preset.eventType === "income" || preset.eventType === "expense") {
        const cadence = preset.cadence ?? current.money.cadence;
        const effectiveMonth = current.effectiveMonth;
        nextDraft.money = {
          ...current.money,
          cadence,
          startMonth:
            cadence === "recurring"
              ? current.money.startMonth || effectiveMonth
              : current.money.startMonth,
          month:
            cadence === "oneOff"
              ? current.money.month || effectiveMonth
              : current.money.month,
        };
      }
      if (preset.eventType === "asset") {
        nextDraft.asset = {
          ...current.asset,
          assetType: preset.assetType ?? current.asset.assetType,
          startMonth: current.asset.startMonth || current.effectiveMonth,
        };
      }
      if (preset.eventType === "liability") {
        nextDraft.liability = {
          ...current.liability,
          liabilityType: preset.liabilityType ?? current.liability.liabilityType,
          startMonth: current.liability.startMonth || current.effectiveMonth,
        };
      }
      return nextDraft;
    });
    setStep(1);
  };

  const previewEvent = useMemo(() => buildEventFromDraft(draft), [draft]);
  const previewResult = useMemo(
    () => compileEventToOps(previewEvent, snapshot),
    [previewEvent, snapshot]
  );

  const hasErrors =
    Object.keys(previewResult.fieldErrors).length > 0 ||
    previewResult.warnings.some((warning) => warning.level === "error");

  const categoryOptions =
    draft.eventType === "expense" && draft.money.cadence === "recurring"
      ? budgetCategories
      : draft.eventType === "income"
      ? incomeCategories
      : expenseCategories;

  const handleApply = () => {
    if (hasErrors) {
      return;
    }
    const eventDraft: MilestoneEventDraft = {
      id: draft.id,
      eventType: previewEvent.eventType,
      effectiveMonth: previewEvent.effectiveMonth,
      notes: previewEvent.notes,
      payload: previewEvent.payload,
    };
    onApply(eventDraft);
  };

  const renderPreviewOps = () => {
    const moneyOps = previewResult.ops.filter((op) => op.entity === "moneyItem");
    const assetOps = previewResult.ops.filter((op) => op.entity === "asset");
    const liabilityOps = previewResult.ops.filter((op) => op.entity === "liability");

    return (
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={600}>{t("milestonePreviewMoney")}</Text>
          {moneyOps.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("milestonePreviewEmpty")}
            </Text>
          ) : (
            moneyOps.map((op, index) => (
              <Text size="sm" key={`${op.entity}-${index}`}>
                {t("milestonePreviewMoneyItem", {
                  kind: op.item.kind,
                  amount: formatCurrency(
                    op.item.amount ?? 0,
                    op.item.currency ?? baseCurrency,
                    locale
                  ),
                  cadence: op.item.cadence,
                  category: op.item.category,
                })}
              </Text>
            ))
          )}
        </Stack>

        <Stack gap={4}>
          <Text fw={600}>{t("milestonePreviewAssets")}</Text>
          {assetOps.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("milestonePreviewEmpty")}
            </Text>
          ) : (
            assetOps.map((op, index) => (
              <Text size="sm" key={`${op.entity}-${index}`}>
                {t("milestonePreviewAssetItem", {
                  name: op.item.name,
                  value: formatCurrency(
                    op.item.currentValue ?? 0,
                    op.item.currency ?? baseCurrency,
                    locale
                  ),
                })}
              </Text>
            ))
          )}
        </Stack>

        <Stack gap={4}>
          <Text fw={600}>{t("milestonePreviewLiabilities")}</Text>
          {liabilityOps.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("milestonePreviewEmpty")}
            </Text>
          ) : (
            liabilityOps.map((op, index) => (
              <Text size="sm" key={`${op.entity}-${index}`}>
                {t("milestonePreviewLiabilityItem", {
                  name: op.item.name,
                  value: formatCurrency(
                    op.item.principalOutstanding ?? 0,
                    op.item.currency ?? baseCurrency,
                    locale
                  ),
                })}
              </Text>
            ))
          )}
        </Stack>
      </Stack>
    );
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={t("milestoneWizardTitle")}
    >
      <Stack gap="md">
        <Stepper active={step} onStepClick={setStep} size="sm">
          <Stepper.Step label={t("milestoneStepType")} />
          <Stepper.Step label={t("milestoneStepMonth")} />
          <Stepper.Step label={t("milestoneStepPayload")} />
          <Stepper.Step label={t("milestoneStepPreview")} />
        </Stepper>

        {step === 0 && (
          <TemplatePicker
            opened={opened}
            defaultCategory="popular"
            onSelect={handleTemplateSelect}
          />
        )}

        {step === 1 && (
          <Stack gap="sm">
            <MonthField
              label={t("milestoneEffectiveMonth")}
              value={draft.effectiveMonth}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  effectiveMonth: value,
                }))
              }
              error={previewResult.fieldErrors.effectiveMonth}
            />
            <TextInput
              label={t("milestoneNotes")}
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.currentTarget.value,
                }))
              }
            />
          </Stack>
        )}

        {step === 2 && (
          <Stack gap="sm">
            {(draft.eventType === "income" || draft.eventType === "expense") && (
              <>
                <Group grow>
                  <Select
                    label={t("milestoneCadence")}
                    value={draft.money.cadence}
                    onChange={(value) =>
                      value &&
                      setDraft((current) => ({
                        ...current,
                        money: {
                          ...current.money,
                          cadence: value as MoneyItemCadence,
                        },
                      }))
                    }
                    data={[
                      { value: "recurring", label: t("flowFilterRecurring") },
                      { value: "oneOff", label: t("flowFilterOneOff") },
                    ]}
                  />
                  <Select
                    label={t("milestoneCategory")}
                    value={draft.money.category}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        money: {
                          ...current.money,
                          category: value ?? "",
                        },
                      }))
                    }
                    data={categoryOptions}
                    error={previewResult.fieldErrors.category}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label={t("milestoneAmount")}
                    value={draft.money.amount}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        money: {
                          ...current.money,
                          amount: value === "" || value === null ? "" : String(value),
                        },
                      }))
                    }
                    min={0}
                    error={previewResult.fieldErrors.amount}
                  />
                  <Select
                    label={t("milestoneMember")}
                    value={draft.money.memberId}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        money: {
                          ...current.money,
                          memberId: value ?? "",
                        },
                      }))
                    }
                    data={[
                      { value: "", label: t("flowMemberHousehold") },
                      ...members.map((member) => ({ value: member.id, label: member.name })),
                    ]}
                  />
                </Group>
                {draft.money.cadence === "recurring" ? (
                  <Group grow>
                    <MonthField
                      label={t("milestoneStartMonth")}
                      value={draft.money.startMonth}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          money: {
                            ...current.money,
                            startMonth: value,
                          },
                        }))
                      }
                      error={previewResult.fieldErrors.startMonth}
                    />
                    <MonthField
                      label={t("milestoneEndMonth")}
                      value={draft.money.endMonth}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          money: {
                            ...current.money,
                            endMonth: value,
                          },
                        }))
                      }
                      error={previewResult.fieldErrors.endMonth}
                    />
                  </Group>
                ) : (
                  <MonthField
                    label={t("milestoneOneOffMonth")}
                    value={draft.money.month}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        money: {
                          ...current.money,
                          month: value,
                        },
                      }))
                    }
                    error={previewResult.fieldErrors.month}
                  />
                )}
                <TextInput
                  label={t("milestoneNotesInline")}
                  value={draft.money.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      money: {
                        ...current.money,
                        notes: event.currentTarget.value,
                      },
                    }))
                  }
                />
              </>
            )}

            {draft.eventType === "asset" && (
              <>
                <Group grow>
                  <Select
                    label={t("milestoneAssetType")}
                    value={draft.asset.assetType}
                    onChange={(value) =>
                      value &&
                      setDraft((current) => ({
                        ...current,
                        asset: {
                          ...current.asset,
                          assetType: value as AssetPayloadDraft["assetType"],
                        },
                      }))
                    }
                    data={[
                      { value: "property", label: t("assetTypeProperty") },
                      { value: "investment", label: t("assetTypeInvestment") },
                      { value: "insurance", label: t("assetTypeInsurance") },
                      { value: "car", label: t("assetTypeCar") },
                    ]}
                  />
                  <TextInput
                    label={t("milestoneName")}
                    value={draft.asset.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        asset: {
                          ...current.asset,
                          name: event.currentTarget.value,
                        },
                      }))
                    }
                    error={previewResult.fieldErrors.name}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label={t("milestoneValue")}
                    value={draft.asset.currentValue}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        asset: {
                          ...current.asset,
                          currentValue: value === "" || value === null ? "" : String(value),
                        },
                      }))
                    }
                    min={0}
                    error={previewResult.fieldErrors.currentValue}
                  />
                  <Select
                    label={t("milestoneMember")}
                    value={draft.asset.ownerMemberId}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        asset: {
                          ...current.asset,
                          ownerMemberId: value ?? "",
                        },
                      }))
                    }
                    data={[
                      { value: "", label: t("flowMemberHousehold") },
                      ...members.map((member) => ({ value: member.id, label: member.name })),
                    ]}
                  />
                </Group>
                <MonthField
                  label={t("milestoneStartMonth")}
                  value={draft.asset.startMonth}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      asset: {
                        ...current.asset,
                        startMonth: value,
                      },
                    }))
                  }
                  error={previewResult.fieldErrors.startMonth}
                />
                <TextInput
                  label={t("milestoneNotesInline")}
                  value={draft.asset.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      asset: {
                        ...current.asset,
                        notes: event.currentTarget.value,
                      },
                    }))
                  }
                />
              </>
            )}

            {draft.eventType === "liability" && (
              <>
                <Group grow>
                  <Select
                    label={t("milestoneLiabilityType")}
                    value={draft.liability.liabilityType}
                    onChange={(value) =>
                      value &&
                      setDraft((current) => ({
                        ...current,
                        liability: {
                          ...current.liability,
                          liabilityType: value as LiabilityPayloadDraft["liabilityType"],
                        },
                      }))
                    }
                    data={[
                      { value: "mortgage", label: t("liabilityTypeMortgage") },
                      { value: "loan", label: t("liabilityTypeLoan") },
                      { value: "carLoan", label: t("liabilityTypeCarLoan") },
                      { value: "other", label: t("liabilityTypeOther") },
                    ]}
                  />
                  <TextInput
                    label={t("milestoneName")}
                    value={draft.liability.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        liability: {
                          ...current.liability,
                          name: event.currentTarget.value,
                        },
                      }))
                    }
                    error={previewResult.fieldErrors.name}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label={t("milestonePrincipal")}
                    value={draft.liability.principalOutstanding}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        liability: {
                          ...current.liability,
                          principalOutstanding:
                            value === "" || value === null ? "" : String(value),
                        },
                      }))
                    }
                    min={0}
                    error={previewResult.fieldErrors.principalOutstanding}
                  />
                  <NumberInput
                    label={t("milestoneInterestRate")}
                    value={draft.liability.interestRate}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        liability: {
                          ...current.liability,
                          interestRate: value === "" || value === null ? "" : String(value),
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    error={previewResult.fieldErrors.interestRate}
                  />
                </Group>
                <Group grow>
                  <MonthField
                    label={t("milestoneStartMonth")}
                    value={draft.liability.startMonth}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        liability: {
                          ...current.liability,
                          startMonth: value,
                        },
                      }))
                    }
                    error={previewResult.fieldErrors.startMonth}
                  />
                  <NumberInput
                    label={t("milestoneTermMonths")}
                    value={draft.liability.termMonths}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        liability: {
                          ...current.liability,
                          termMonths: value === "" || value === null ? "" : String(value),
                        },
                      }))
                    }
                    min={1}
                    error={previewResult.fieldErrors.termMonths}
                  />
                </Group>
                <TextInput
                  label={t("milestoneNotesInline")}
                  value={draft.liability.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      liability: {
                        ...current.liability,
                        notes: event.currentTarget.value,
                      },
                    }))
                  }
                />
              </>
            )}
          </Stack>
        )}

        {step === 3 && (
          <Stack gap="md">
            {previewResult.warnings.length > 0 && (
              <Card withBorder radius="md" padding="sm">
                <Stack gap="xs">
                  <Text fw={600}>{t("milestoneWarningsTitle")}</Text>
                  {previewResult.warnings.map((warning) => (
                    <Text size="sm" key={warning.id} c={warning.level === "error" ? "red" : "yellow"}>
                      {warning.message}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
            {renderPreviewOps()}
          </Stack>
        )}

        <Divider />

        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Group>
            <Button
              variant="default"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              {t("milestoneBack")}
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((current) => Math.min(3, current + 1))}>
                {t("milestoneNext")}
              </Button>
            ) : (
              <Button onClick={handleApply} disabled={hasErrors}>
                {t("milestoneApply")}
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
