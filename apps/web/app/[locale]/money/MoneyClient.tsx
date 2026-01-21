"use client";

import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { getEventGroup, monthIndex } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link } from "../../../src/i18n/navigation";
import AddMoneyItemModal from "../../../components/money/AddMoneyItemModal";
import TimelineEventDrawer from "../../../components/timeline/TimelineEventDrawer";
import HomeDetailsForm from "../../../components/timeline/HomeDetailsForm";
import CarDetailsForm from "../../../components/timeline/CarDetailsForm";
import InvestmentDetailsForm from "../../../components/timeline/InvestmentDetailsForm";
import InsuranceDetailsForm from "../../../components/timeline/InsuranceDetailsForm";
import LoanDetailsForm from "../../../components/timeline/LoanDetailsForm";
import {
  createCarPositionFromTemplate,
  createHomePositionFromTemplate,
  createInsurancePositionFromTemplate,
  createInvestmentPositionFromTemplate,
  createLoanPositionFromTemplate,
  formatCarSummary,
  formatHomeSummary,
  formatInsuranceSummary,
  formatInvestmentSummary,
  formatLoanSummary,
} from "../../../components/timeline/utils";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { formatCurrency } from "../../../lib/i18n";
import { buildScenarioEventViews, buildTimelineEventFromDefinition } from "../../../src/domain/events/utils";
import { getEventTypeDisplay } from "../../../components/timeline/utils";
import type { ScenarioEventView } from "../../../components/timeline/types";
import { isValidMonthStr } from "../../../src/utils/month";
import type {
  CarPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
} from "../../../src/store/scenarioStore";
import type { EventGroup } from "@north-star/engine";

type MoneyTab = "income" | "expenses" | "assets" | "liabilities" | "timeline";

type MoneyClientProps = {
  scenarioId?: string;
  initialTab?: string;
};

const tabOrder: MoneyTab[] = [
  "income",
  "expenses",
  "assets",
  "liabilities",
  "timeline",
];

export default function MoneyClient({ scenarioId, initialTab }: MoneyClientProps) {
  const t = useTranslations("money");
  const timelineText = useTranslations("timeline");
  const homesText = useTranslations("homes");
  const investmentsText = useTranslations("investments");
  const insurancesText = useTranslations("insurances");
  const loansText = useTranslations("loans");
  const carsText = useTranslations("cars");
  const common = useTranslations("common");
  const locale = useLocale();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const updateScenarioEventRef = useScenarioStore((state) => state.updateScenarioEventRef);
  const updateEventDefinition = useScenarioStore((state) => state.updateEventDefinition);
  const addEventToScenarios = useScenarioStore((state) => state.addEventToScenarios);
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore((state) => state.updateHomePosition);
  const addCarPosition = useScenarioStore((state) => state.addCarPosition);
  const updateCarPosition = useScenarioStore((state) => state.updateCarPosition);
  const addInvestmentPosition = useScenarioStore((state) => state.addInvestmentPosition);
  const updateInvestmentPosition = useScenarioStore((state) => state.updateInvestmentPosition);
  const addInsurancePosition = useScenarioStore((state) => state.addInsurancePosition);
  const updateInsurancePosition = useScenarioStore((state) => state.updateInsurancePosition);
  const addLoanPosition = useScenarioStore((state) => state.addLoanPosition);
  const updateLoanPosition = useScenarioStore((state) => state.updateLoanPosition);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const scenarioIdValue = scenario?.id;
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addEventGroup, setAddEventGroup] = useState<EventGroup | null>(null);
  const [editingEvent, setEditingEvent] = useState<ScenarioEventView | null>(null);
  const [creatingHome, setCreatingHome] = useState<HomePositionDraft | null>(null);
  const [creatingCar, setCreatingCar] = useState<CarPositionDraft | null>(null);
  const [creatingInvestment, setCreatingInvestment] =
    useState<InvestmentPositionDraft | null>(null);
  const [creatingInsurance, setCreatingInsurance] =
    useState<InsurancePositionDraft | null>(null);
  const [creatingLoan, setCreatingLoan] = useState<LoanPositionDraft | null>(null);
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const resolvedTab = tabOrder.includes(initialTab as MoneyTab)
    ? (initialTab as MoneyTab)
    : "income";
  const [activeTab, setActiveTab] = useState<MoneyTab>(resolvedTab);
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [memberFilter, setMemberFilter] = useState<string | null>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>("all");

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  );

  const eventRows = useMemo(() => {
    if (!scenario) {
      return [];
    }
    return buildScenarioEventViews(scenario, eventLibrary).map((view) => {
      const event = buildTimelineEventFromDefinition(
        view.definition,
        view.ref,
        {
          baseCurrency: scenario.baseCurrency,
          fallbackMonth: scenario.assumptions.baseMonth ?? null,
        }
      );
      return { view, event };
    });
  }, [eventLibrary, scenario]);

  const incomeEvents = eventRows.filter(
    (row) => getEventGroup(row.event.type) === "income"
  );
  const expenseEvents = eventRows.filter(
    (row) => getEventGroup(row.event.type) === "expense"
  );

  const parentGroupOptions = useMemo(
    () =>
      eventLibrary
        .filter((definition) => definition.kind === "group")
        .map((definition) => ({
          value: definition.id,
          label: definition.title,
        })),
    [eventLibrary]
  );

  const timelineEvents = useMemo(() => {
    return eventRows.filter(({ event }) => {
      if (highlightOnly && !event.highlighted) {
        return false;
      }
      if (memberFilter && memberFilter !== "all") {
        if (event.memberId !== memberFilter) {
          return false;
        }
      }
      if (categoryFilter && categoryFilter !== "all") {
        if (event.type !== categoryFilter) {
          return false;
        }
      }
      return true;
    });
  }, [categoryFilter, eventRows, highlightOnly, memberFilter]);
  const hasBudgetRules = budgetRules.length > 0;

  const timelineHref = scenarioIdValue
    ? buildScenarioUrl("/money", scenarioIdValue)
    : "/money";
  const timelineTabHref = `${timelineHref}${timelineHref.includes("?") ? "&" : "?"}tab=timeline`;
  const budgetHref = scenarioIdValue
    ? `/people?scenarioId=${scenarioIdValue}&tab=budget`
    : "/people?tab=budget";

  const positions = scenario?.positions;
  const homes = positions?.homes ?? [];
  const investments = positions?.investments ?? [];
  const insurances = positions?.insurances ?? [];
  const cars = positions?.cars ?? [];
  const loans = positions?.loans ?? [];
  const baseMonth = scenario?.assumptions.baseMonth ?? null;
  const currentProjectionMonth = baseMonth ?? null;
  const isPastSellMonth = (sellMonth?: string) => {
    if (!sellMonth || !currentProjectionMonth) {
      return false;
    }
    if (!isValidMonthStr(sellMonth) || !isValidMonthStr(currentProjectionMonth)) {
      return false;
    }
    return monthIndex(currentProjectionMonth, sellMonth) < 0;
  };
  const editingHome = homes.find((home) => home.id === editingHomeId) ?? null;
  const editingCar = cars.find((car) => car.id === editingCarId) ?? null;
  const editingInvestment =
    investments.find((investment) => investment.id === editingInvestmentId) ?? null;
  const editingInsurance =
    insurances.find((insurance) => insurance.id === editingInsuranceId) ?? null;
  const editingLoan = loans.find((loan) => loan.id === editingLoanId) ?? null;
  const homeDrawerDraft = editingHome ?? creatingHome;
  const carDrawerDraft = editingCar ?? creatingCar;
  const investmentDrawerDraft = editingInvestment ?? creatingInvestment;
  const insuranceDrawerDraft = editingInsurance ?? creatingInsurance;
  const loanDrawerDraft = editingLoan ?? creatingLoan;

  const renderEventList = (
    rows: typeof eventRows,
    options: {
      showHighlightToggle?: boolean;
      showOverlapHint?: boolean;
      showEditButton?: boolean;
    } = {}
  ) => {
    if (rows.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          {t("emptyEvents")}
        </Text>
      );
    }

    return (
      <Stack gap="sm">
        {rows.map(({ view, event }) => {
          const memberLabel =
            (event.memberId ? memberLookup.get(event.memberId) : null) ??
            timelineText("memberHousehold");
          const displayLabel = event.name || getEventTypeDisplay(timelineText, event.type);
          const amountValue = event.monthlyAmount || event.oneTimeAmount;
          const amountLabel =
            amountValue && amountValue !== 0
              ? formatCurrency(amountValue, event.currency, locale)
              : t("amountUnset");
          const overlapBadge =
            options.showOverlapHint && hasBudgetRules && getEventGroup(event.type) === "expense";

          return (
            <Card key={event.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Group>
                  {options.showHighlightToggle && scenarioIdValue && (
                    <Button
                      size="xs"
                      variant={view.ref.highlighted ? "light" : "subtle"}
                      color={view.ref.highlighted ? "yellow" : "gray"}
                      onClick={() =>
                        updateScenarioEventRef(scenarioIdValue, view.ref.refId, {
                          highlighted: !view.ref.highlighted,
                        })
                      }
                      aria-label={timelineText("highlightToggle")}
                    >
                      {view.ref.highlighted ? "★" : "☆"}
                    </Button>
                  )}
                  <Stack gap={2}>
                    <Text fw={600}>{displayLabel}</Text>
                    <Text size="xs" c="dimmed">
                      {t("eventMeta", { member: memberLabel, month: event.startMonth })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("eventAmount", { amount: amountLabel })}
                    </Text>
                    {overlapBadge && (
                      <Badge color="yellow" variant="light">
                        {t("overlapWarning")}
                      </Badge>
                    )}
                  </Stack>
                </Group>
                
                
                {options.showEditButton && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setEditingEvent(view)}
                  >
                    {common("actionEdit")}
                  </Button>
                )}
              </Group>
            </Card>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={2}>{t("title")}</Title>
          <Text size="sm" c="dimmed">
            {t("subtitle")}
          </Text>
        </Stack>
        <Button onClick={() => setAddModalOpen(true)}>{t("addButton")}</Button>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{t("orderTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("orderHint")}
          </Text>
        </Stack>
      </Card>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as MoneyTab)}>
        <Tabs.List>
          <Tabs.Tab value="income">{t("incomeTitle")}</Tabs.Tab>
          <Tabs.Tab value="expenses">{t("expensesTitle")}</Tabs.Tab>
          <Tabs.Tab value="assets">{t("assetsTitle")}</Tabs.Tab>
          <Tabs.Tab value="liabilities">{t("liabilitiesTitle")}</Tabs.Tab>
          <Tabs.Tab value="timeline">{t("timelineTitle")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="income" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("incomeDescription")}
            </Text>
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("incomeListLabel")}
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => setAddEventGroup("income")}
                disabled={!scenarioIdValue}
              >
                {t("addIncomeEvent")}
              </Button>
            </Group>
            {renderEventList(incomeEvents, { showEditButton: true })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="expenses" pt="md">
          <Stack gap="md">
            <Card withBorder radius="md" padding="md">
              <Text size="sm">{t("expenseGuidance")}</Text>
            </Card>
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("expensesDescription")}
              </Text>
              <Group gap="xs">
                <Button component={Link} href={budgetHref} size="xs" variant="light">
                  {t("expensesBudgetCta")}
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setAddEventGroup("expense")}
                  disabled={!scenarioIdValue}
                >
                  {t("addExpenseEvent")}
                </Button>
              </Group>
            </Group>
            {renderEventList(expenseEvents, {
              showOverlapHint: true,
              showEditButton: true,
            })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assets" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("assetsDescription")}
            </Text>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{homesText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingHome(createHomePositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {homesText("addHome")}
                </Button>
              </Group>
              {homes.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {homesText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {homes.map((home) => (
                    <Card key={home.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{homesText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatHomeSummary(homesText, home, scenario?.baseCurrency ?? "USD", locale)}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setEditingHomeId(home.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{investmentsText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingInvestment(createInvestmentPositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {investmentsText("addInvestment")}
                </Button>
              </Group>
              {investments.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {investmentsText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {investments.map((investment) => (
                    <Card key={investment.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{investmentsText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatInvestmentSummary(
                            investmentsText,
                            investment,
                            scenario?.baseCurrency ?? "USD",
                            locale
                          )}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setEditingInvestmentId(investment.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{insurancesText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingInsurance(createInsurancePositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {insurancesText("addInsurance")}
                </Button>
              </Group>
              {insurances.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {insurancesText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {insurances.map((insurance) => (
                    <Card key={insurance.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{insurancesText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatInsuranceSummary(
                            insurancesText,
                            insurance,
                            scenario?.baseCurrency ?? "USD",
                            locale
                          )}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setEditingInsuranceId(insurance.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{carsText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingCar(createCarPositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {carsText("addCar")}
                </Button>
              </Group>
              {cars.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {carsText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {cars.map((car) => (
                    <Card key={car.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{carsText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatCarSummary(carsText, car, scenario?.baseCurrency ?? "USD", locale)}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setEditingCarId(car.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="liabilities" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("liabilitiesDescription")}
            </Text>
            <Group justify="space-between" align="center" wrap="wrap">
              <Text fw={600}>{loansText("title")}</Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => setCreatingLoan(createLoanPositionFromTemplate({ baseMonth }))}
                disabled={!scenarioIdValue}
              >
                {loansText("addLoan")}
              </Button>
            </Group>
            {loans.length === 0 ? (
              <Text size="sm" c="dimmed">
                {loansText("empty")}
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {loans.map((loan) => (
                  <Card key={loan.id} withBorder radius="md" padding="sm">
                    <Stack gap={4}>
                      <Text fw={600}>{loansText("title")}</Text>
                      <Text size="sm" c="dimmed">
                        {formatLoanSummary(loansText, loan, scenario?.baseCurrency ?? "USD", locale)}
                      </Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => setEditingLoanId(loan.id)}
                      >
                        {common("actionEdit")}
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="md">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("timelineDescription")}
              </Text>
              <Switch
                label={t("highlightFilter")}
                checked={highlightOnly}
                onChange={(event) => setHighlightOnly(event.currentTarget.checked)}
              />
            </Group>
            <Group wrap="wrap">
              <Select
                value={memberFilter}
                onChange={setMemberFilter}
                data={[
                  { value: "all", label: t("filterAllMembers") },
                  ...members.map((member) => ({
                    value: member.id,
                    label: member.name,
                  })),
                ]}
                placeholder={t("filterMemberPlaceholder")}
              />
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                data={[
                  { value: "all", label: t("filterAllCategories") },
                  ...Array.from(new Set(eventRows.map((row) => row.event.type))).map((type) => ({
                    value: type,
                    label: getEventTypeDisplay(timelineText, type),
                  })),
                ]}
                placeholder={t("filterCategoryPlaceholder")}
              />
            </Group>
            <Card withBorder radius="md" padding="md">
              <Text size="sm">{t("timelineWarning")}</Text>
            </Card>
            {renderEventList(timelineEvents, {
              showHighlightToggle: true,
              showOverlapHint: true,
              showEditButton: true,
            })}
            <Button component={Link} href={timelineTabHref} size="xs" variant="light">
              {common("openTimeline")}
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <AddMoneyItemModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        scenarioId={scenarioIdValue ?? null}
      />

      {scenario && scenarioIdValue && (
        <>
          <TimelineEventDrawer
            mode="create"
            opened={Boolean(addEventGroup)}
            onClose={() => setAddEventGroup(null)}
            baseCurrency={scenario.baseCurrency}
            baseMonth={baseMonth}
            assumptions={{
              baseMonth,
              horizonMonths: scenario.assumptions.horizonMonths ?? 0,
            }}
            members={members}
            scenarioOptions={scenarios.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
            defaultScenarioId={scenarioIdValue}
            defaultMonth={baseMonth}
            defaultGroup={addEventGroup ?? undefined}
            parentGroupOptions={parentGroupOptions}
            onAddDefinition={(definition, scenarioIds) =>
              addEventToScenarios(definition, scenarioIds)
            }
            onAddHomePosition={() =>
              setCreatingHome(createHomePositionFromTemplate({ baseMonth }))
            }
          />

          <TimelineEventDrawer
            mode="edit"
            opened={Boolean(editingEvent)}
            onClose={() => setEditingEvent(null)}
            baseCurrency={scenario.baseCurrency}
            baseMonth={baseMonth}
            assumptions={{
              baseMonth,
              horizonMonths: scenario.assumptions.horizonMonths ?? 0,
            }}
            members={members}
            parentGroupOptions={parentGroupOptions}
            editingEvent={editingEvent}
            onUpdateDefinition={updateEventDefinition}
            onUpdateEventRef={(refId, patch) =>
              updateScenarioEventRef(scenarioIdValue, refId, patch)
            }
          />

          <Drawer
            opened={Boolean(homeDrawerDraft)}
            onClose={() => {
              setEditingHomeId(null);
              setCreatingHome(null);
            }}
            position="right"
            size="md"
            title={homesText("title")}
          >
            {homeDrawerDraft && (
              <HomeDetailsForm
                home={homeDrawerDraft}
                isSold={isPastSellMonth(homeDrawerDraft.sellMonth)}
                onCancel={() => {
                  setEditingHomeId(null);
                  setCreatingHome(null);
                }}
                onSave={(updated) => {
                  if (editingHome) {
                    updateHomePosition(scenarioIdValue, updated);
                  } else {
                    addHomePosition(scenarioIdValue, updated);
                  }
                  setEditingHomeId(null);
                  setCreatingHome(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(carDrawerDraft)}
            onClose={() => {
              setEditingCarId(null);
              setCreatingCar(null);
            }}
            position="right"
            size="md"
            title={carsText("title")}
          >
            {carDrawerDraft && (
              <CarDetailsForm
                car={carDrawerDraft}
                isSold={isPastSellMonth(carDrawerDraft.sellMonth)}
                onCancel={() => {
                  setEditingCarId(null);
                  setCreatingCar(null);
                }}
                onSave={(updated) => {
                  if (editingCar) {
                    updateCarPosition(scenarioIdValue, updated);
                  } else {
                    addCarPosition(scenarioIdValue, updated);
                  }
                  setEditingCarId(null);
                  setCreatingCar(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(investmentDrawerDraft)}
            onClose={() => {
              setEditingInvestmentId(null);
              setCreatingInvestment(null);
            }}
            position="right"
            size="md"
            title={investmentsText("title")}
          >
            {investmentDrawerDraft && (
              <InvestmentDetailsForm
                investment={investmentDrawerDraft}
                onCancel={() => {
                  setEditingInvestmentId(null);
                  setCreatingInvestment(null);
                }}
                onSave={(updated) => {
                  if (editingInvestment) {
                    updateInvestmentPosition(scenarioIdValue, updated);
                  } else {
                    addInvestmentPosition(scenarioIdValue, updated);
                  }
                  setEditingInvestmentId(null);
                  setCreatingInvestment(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(insuranceDrawerDraft)}
            onClose={() => {
              setEditingInsuranceId(null);
              setCreatingInsurance(null);
            }}
            position="right"
            size="md"
            title={insurancesText("title")}
          >
            {insuranceDrawerDraft && (
              <InsuranceDetailsForm
                insurance={insuranceDrawerDraft}
                onCancel={() => {
                  setEditingInsuranceId(null);
                  setCreatingInsurance(null);
                }}
                onSave={(updated) => {
                  if (editingInsurance) {
                    updateInsurancePosition(scenarioIdValue, updated);
                  } else {
                    addInsurancePosition(scenarioIdValue, updated);
                  }
                  setEditingInsuranceId(null);
                  setCreatingInsurance(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(loanDrawerDraft)}
            onClose={() => {
              setEditingLoanId(null);
              setCreatingLoan(null);
            }}
            position="right"
            size="md"
            title={loansText("title")}
          >
            {loanDrawerDraft && (
              <LoanDetailsForm
                loan={loanDrawerDraft}
                onCancel={() => {
                  setEditingLoanId(null);
                  setCreatingLoan(null);
                }}
                onSave={(updated) => {
                  if (editingLoan) {
                    updateLoanPosition(scenarioIdValue, updated);
                  } else {
                    addLoanPosition(scenarioIdValue, updated);
                  }
                  setEditingLoanId(null);
                  setCreatingLoan(null);
                }}
              />
            )}
          </Drawer>
        </>
      )}
    </Stack>
  );
}
