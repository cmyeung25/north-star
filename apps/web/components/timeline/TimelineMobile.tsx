"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Notification,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { Fragment, useEffect, useMemo, useState } from "react";
import { type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import HomeDetailsForm from "./HomeDetailsForm";
import CarDetailsForm from "./CarDetailsForm";
import InvestmentDetailsForm from "./InvestmentDetailsForm";
import LoanDetailsForm from "./LoanDetailsForm";
import TimelineEventDrawer from "./TimelineEventDrawer";
import MergeDuplicatesModal from "./MergeDuplicatesModal";
import type {
  EventDefinition,
  ScenarioEventRef,
  ScenarioEventView,
} from "./types";
import {
  buildEventTreeRows,
  createCarPositionFromTemplate,
  createDefinitionCopy,
  createHomePositionFromTemplate,
  createInvestmentPositionFromTemplate,
  createLoanPositionFromTemplate,
  getEventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventLabel,
  formatCurrency,
  formatDateRange,
  formatCarSummary,
  formatHomeSummary,
  formatInvestmentSummary,
  formatLoanSummary,
  iconMap,
} from "./utils";
import type {
  CarPositionDraft,
  HomePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
  Scenario,
  ScenarioMember,
} from "../../src/store/scenarioStore";
import { Link } from "../../src/i18n/navigation";
import type { DuplicateCluster } from "../../src/domain/events/mergeDuplicates";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

interface TimelineMobileProps {
  eventViews: ScenarioEventView[];
  eventLibrary: EventDefinition[];
  scenarios: Scenario[];
  homePositions: HomePositionDraft[];
  carPositions: CarPositionDraft[];
  investmentPositions: InvestmentPositionDraft[];
  loanPositions: LoanPositionDraft[];
  members: ScenarioMember[];
  baseCurrency: string;
  baseMonth?: string | null;
  assumptions: { baseMonth: string | null; horizonMonths: number };
  scenarioId: string;
  onAddDefinition: (definition: EventDefinition, scenarioIds: string[]) => void;
  onUpdateDefinition: (id: string, patch: Partial<EventDefinition>) => void;
  onUpdateEventRef: (refId: string, patch: Partial<ScenarioEventRef>) => void;
  onRemoveEventRef: (refId: string) => void;
  onHomePositionAdd: (home: HomePositionDraft) => void;
  onHomePositionUpdate: (home: HomePositionDraft) => void;
  onHomePositionRemove: (homeId: string) => void;
  onCarPositionAdd: (car: CarPositionDraft) => void;
  onCarPositionUpdate: (car: CarPositionDraft) => void;
  onCarPositionRemove: (carId: string) => void;
  onInvestmentPositionAdd: (investment: InvestmentPositionDraft) => void;
  onInvestmentPositionUpdate: (investment: InvestmentPositionDraft) => void;
  onInvestmentPositionRemove: (investmentId: string) => void;
  onLoanPositionAdd: (loan: LoanPositionDraft) => void;
  onLoanPositionUpdate: (loan: LoanPositionDraft) => void;
  onLoanPositionRemove: (loanId: string) => void;
  onMergeDuplicates: (cluster: DuplicateCluster, baseDefinitionId: string) => void;
}

export default function TimelineMobile({
  eventViews,
  eventLibrary,
  scenarios,
  homePositions,
  carPositions,
  investmentPositions,
  loanPositions,
  members,
  baseCurrency,
  baseMonth,
  assumptions,
  scenarioId,
  onAddDefinition,
  onUpdateDefinition,
  onUpdateEventRef,
  onRemoveEventRef,
  onHomePositionAdd,
  onHomePositionUpdate,
  onHomePositionRemove,
  onCarPositionAdd,
  onCarPositionUpdate,
  onCarPositionRemove,
  onInvestmentPositionAdd,
  onInvestmentPositionUpdate,
  onInvestmentPositionRemove,
  onLoanPositionAdd,
  onLoanPositionUpdate,
  onLoanPositionRemove,
  onMergeDuplicates,
}: TimelineMobileProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const homes = useTranslations("homes");
  const cars = useTranslations("cars");
  const investments = useTranslations("investments");
  const loans = useTranslations("loans");
  const locale = useLocale();
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<"all" | EventGroup>("all");
  const [activeTab, setActiveTab] = useState<"events" | "positions" | "overview">(
    "events"
  );
  const [pendingScrollMonth, setPendingScrollMonth] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ScenarioEventView | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(
    null
  );
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [homeToastOpen, setHomeToastOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "event" | "home" | "car" | "investment" | "loan";
    id: string;
    label: string;
  } | null>(null);

  const eventRows = useMemo(
    () => buildEventTreeRows(eventViews, activeGroup, collapsedGroups),
    [activeGroup, collapsedGroups, eventViews]
  );
  const hasEvents = eventViews.length > 0;
  const monthGroups = useMemo(() => {
    const groups: Array<{
      month: string;
      label: string;
      rows: typeof eventRows;
    }> = [];
    const map = new Map<string, typeof eventRows>();
    eventRows.forEach((row) => {
      const month = row.view.rule.startMonth ?? "unscheduled";
      const existing = map.get(month);
      if (existing) {
        existing.push(row);
        return;
      }
      const rows: typeof eventRows = [row];
      map.set(month, rows);
      groups.push({
        month,
        label: month === "unscheduled" ? t("monthUnscheduled") : month,
        rows,
      });
    });
    return groups;
  }, [eventRows, t]);

  const milestoneRows = useMemo(() => {
    const normalizeMonths = (values: Array<string | null | undefined>) =>
      Array.from(new Set(values.filter(Boolean) as string[])).sort();
    const homeMonths = normalizeMonths(
      homePositions.map((home) =>
        (home.mode ?? "new_purchase") === "existing"
          ? home.existing?.asOfMonth
          : home.purchaseMonth
      )
    );
    const carMonths = normalizeMonths(carPositions.map((car) => car.purchaseMonth));
    const childMonths = normalizeMonths(
      eventViews
        .filter(
          (view) => view.definition.kind === "cashflow" && view.definition.type === "baby"
        )
        .map((view) => view.rule.startMonth)
    );
    const retirementCandidates = normalizeMonths(
      eventViews
        .filter(
          (view) =>
            view.definition.kind === "cashflow" && view.definition.type === "salary"
        )
        .map((view) => view.rule.endMonth)
    );
    const retirementMonth = retirementCandidates[0];

    return [
      { label: t("overviewHome"), months: homeMonths },
      { label: t("overviewCar"), months: carMonths },
      { label: t("overviewChild"), months: childMonths },
      {
        label: t("overviewRetirement"),
        months: retirementMonth ? [retirementMonth] : [],
      },
    ].filter((row) => row.months.length > 0);
  }, [carPositions, eventViews, homePositions, t]);

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

  const handleToggle = (eventId: string, enabled: boolean) => {
    onUpdateEventRef(eventId, { enabled });
  };

  const handleDuplicate = (view: ScenarioEventView) => {
    const copy = createDefinitionCopy(
      view.definition,
      t("copyName", { name: view.definition.title })
    );
    onAddDefinition(copy, [scenarioId]);
  };

  const handleDelete = (eventId: string, name: string) => {
    setConfirmDelete({ type: "event", id: eventId, label: name });
  };

  const handleEditOpen = (view: ScenarioEventView) => {
    setEditingEvent(view);
  };

  const handleCreateComplete = (startMonth?: string | null) => {
    if (!startMonth) {
      return;
    }
    setActiveTab("events");
    setSelectedMonth(startMonth);
    setPendingScrollMonth(startMonth);
  };

  const overviewUrl = buildScenarioUrl("/overview", scenarioId);
  const editingHome =
    homePositions.find((home) => home.id === editingHomeId) ?? null;
  const editingCar = carPositions.find((car) => car.id === editingCarId) ?? null;
  const editingInvestment =
    investmentPositions.find((investment) => investment.id === editingInvestmentId) ??
    null;
  const editingLoan = loanPositions.find((loan) => loan.id === editingLoanId) ?? null;

  useEffect(() => {
    if (!pendingScrollMonth) {
      return;
    }
    const target = document.getElementById(`month-${pendingScrollMonth}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollMonth(null);
    }
  }, [monthGroups, pendingScrollMonth]);

  return (
    <Stack gap="lg" pb={120}>
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitleMobile")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              {t("devHint")}
            </Text>
          )}
        </div>
        {activeTab === "events" && (
          <Button size="xs" variant="light" onClick={() => setMergeOpen(true)}>
            {t("mergeDuplicates")}
          </Button>
        )}
      </Group>

      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as "events" | "positions" | "overview")}
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="events">{t("tabEvents")}</Tabs.Tab>
          <Tabs.Tab value="positions">{t("tabPositions")}</Tabs.Tab>
          <Tabs.Tab value="overview">{t("tabOverview")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="events" pt="md">
          <Stack gap="md">
            <SegmentedControl
              data={getEventFilterOptions(t)}
              value={activeGroup}
              onChange={(value) => setActiveGroup(value as "all" | EventGroup)}
            />

            {monthGroups.length === 0 ? (
              <Text c="dimmed" size="sm">
                {hasEvents ? t("emptyGroup") : t("emptyAll")}
              </Text>
            ) : (
              <Stack gap="md">
                {monthGroups.map(({ month, label, rows }) => {
                  const monthKey = month === "unscheduled" ? "unscheduled" : month;
                  return (
                    <Fragment key={monthKey}>
                      <UnstyledButton
                        id={`month-${monthKey}`}
                        data-month={monthKey}
                        onClick={() => {
                          if (month !== "unscheduled") {
                            setSelectedMonth(month);
                          }
                        }}
                      >
                        <Group justify="space-between">
                          <Text fw={600}>{label}</Text>
                          {selectedMonth === month ? (
                            <Badge variant="light">{t("monthSelected")}</Badge>
                          ) : null}
                        </Group>
                      </UnstyledButton>
                      {rows.map(({ view, depth, hasChildren }) => {
                        const rule = view.rule;
                        const isGroup = view.definition.kind === "group";
                        const eventCurrency = view.definition.currency ?? baseCurrency;
                        const monthlyAmount = rule.monthlyAmount ?? 0;
                        const oneTimeAmount = rule.oneTimeAmount ?? 0;
                        const collapsed = collapsedGroups[view.definition.id] ?? false;

                        return (
                          <Card
                            key={view.definition.id}
                            withBorder
                            shadow="sm"
                            radius="md"
                            padding="md"
                          >
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start">
                                <Group gap="sm">
                                  <Text size="xl">
                                    {isGroup ? "📁" : iconMap[view.definition.type]}
                                  </Text>
                                  <div>
                                    <Badge variant="light" color="gray" size="sm">
                                      {isGroup
                                        ? t("groupLabel")
                                        : getEventGroupLabel(t, view.definition.type)}
                                    </Badge>
                                    <Text fw={600} style={{ paddingLeft: depth * 12 }}>
                                      {view.definition.title}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {isGroup
                                        ? t("groupNode")
                                        : getEventLabel(t, view.definition.type)}
                                    </Text>
                                    {rule.startMonth ? (
                                      <Text size="sm" c="dimmed">
                                        {formatDateRange(
                                          t,
                                          rule.startMonth,
                                          rule.endMonth ?? null
                                        )}
                                      </Text>
                                    ) : (
                                      <Text size="sm" c="dimmed">
                                        {t("tablePlaceholder")}
                                      </Text>
                                    )}
                                    {!isGroup && (
                                      <Text size="xs" c="dimmed">
                                        {getEventImpactHint(t, view.definition.type)}
                                      </Text>
                                    )}
                                  </div>
                                </Group>
                                <Switch
                                  checked={view.ref.enabled}
                                  onChange={(eventChange) =>
                                    handleToggle(
                                      view.definition.id,
                                      eventChange.currentTarget.checked
                                    )
                                  }
                                  label={t("tableEnabled")}
                                />
                              </Group>

                              <Group gap="xs">
                                {!isGroup && monthlyAmount !== 0 && (
                                  <Badge variant="light" color="indigo">
                                    {t("monthlyLabel")}{" "}
                                    {formatCurrency(
                                      monthlyAmount,
                                      eventCurrency,
                                      locale
                                    )}
                                  </Badge>
                                )}
                                {!isGroup && oneTimeAmount !== 0 && (
                                  <Badge variant="light" color="grape">
                                    {t("oneTimeLabel")}{" "}
                                    {formatCurrency(
                                      oneTimeAmount,
                                      eventCurrency,
                                      locale
                                    )}
                                  </Badge>
                                )}
                                {(isGroup ||
                                  (monthlyAmount === 0 && oneTimeAmount === 0)) && (
                                  <Badge variant="outline">{t("noAmounts")}</Badge>
                                )}
                              </Group>

                              <Group justify="space-between">
                                <Group gap="xs" wrap="nowrap">
                                  {isGroup && hasChildren && (
                                    <ActionIcon
                                      variant="subtle"
                                      onClick={() =>
                                        setCollapsedGroups((current) => ({
                                          ...current,
                                          [view.definition.id]: !collapsed,
                                        }))
                                      }
                                      aria-label={
                                        collapsed ? t("expandGroup") : t("collapseGroup")
                                      }
                                    >
                                      {collapsed ? "▸" : "▾"}
                                    </ActionIcon>
                                  )}
                                  <Button size="xs" onClick={() => handleEditOpen(view)}>
                                    {common("actionEdit")}
                                  </Button>
                                </Group>
                                <Group gap="xs">
                                  <ActionIcon
                                    variant="subtle"
                                    aria-label={t("duplicateAria", {
                                      name: view.definition.title,
                                    })}
                                    onClick={() => handleDuplicate(view)}
                                  >
                                    ⧉
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    aria-label={t("deleteAria", {
                                      name: view.definition.title,
                                    })}
                                    onClick={() =>
                                      handleDelete(view.definition.id, view.definition.title)
                                    }
                                  >
                                    🗑️
                                  </ActionIcon>
                                </Group>
                              </Group>
                            </Stack>
                          </Card>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="positions" pt="md">
          <Stack gap="md">
            {homeToastOpen && (
              <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
                <Stack gap="xs">
                  <Text size="sm">{t("homeToast")}</Text>
                  <Button component={Link} href={overviewUrl} size="xs" variant="light">
                    {t("goToOverview")}
                  </Button>
                </Stack>
              </Notification>
            )}

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{homes("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    onHomePositionAdd(createHomePositionFromTemplate({ baseMonth }));
                    setHomeToastOpen(true);
                  }}
                >
                  {homes("addHome")}
                </Button>
              </Group>
              {homePositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {homes("empty")}
                </Text>
              ) : (
                homePositions.map((home, index) => (
                  <Card key={home.id} withBorder shadow="sm" radius="md" padding="md">
                    <Stack gap="sm">
                      <div>
                        <Text fw={600}>
                          {homes("homeLabel", { index: index + 1 })}
                        </Text>
                        <Text size="sm">
                          {formatHomeSummary(homes, home, baseCurrency, locale)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {(home.mode ?? "new_purchase") === "existing"
                            ? `${homes("existingAsOfMonth")}: ${home.existing?.asOfMonth ?? "--"}`
                            : `${homes("purchaseMonth")}: ${home.purchaseMonth ?? "--"}`}
                        </Text>
                      </div>
                      <Group gap="sm">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setEditingHomeId(home.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() =>
                            setConfirmDelete({
                              type: "home",
                              id: home.id,
                              label: homes("homeLabel", { index: index + 1 }),
                            })
                          }
                        >
                          {homes("removeHome")}
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{cars("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => onCarPositionAdd(createCarPositionFromTemplate({ baseMonth }))}
                >
                  {cars("addCar")}
                </Button>
              </Group>
              {carPositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {cars("empty")}
                </Text>
              ) : (
                carPositions.map((car, index) => (
                  <Card key={car.id} withBorder shadow="sm" radius="md" padding="md">
                    <Stack gap="sm">
                      <div>
                        <Text fw={600}>{cars("carLabel", { index: index + 1 })}</Text>
                        <Text size="sm">
                          {formatCarSummary(cars, car, baseCurrency, locale)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {cars("purchaseMonth")}: {car.purchaseMonth ?? "--"}
                        </Text>
                      </div>
                      <Group gap="sm">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setEditingCarId(car.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() =>
                            setConfirmDelete({
                              type: "car",
                              id: car.id,
                              label: cars("carLabel", { index: index + 1 }),
                            })
                          }
                        >
                          {cars("removeCar")}
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{investments("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    onInvestmentPositionAdd(
                      createInvestmentPositionFromTemplate({ baseMonth })
                    )
                  }
                >
                  {investments("addInvestment")}
                </Button>
              </Group>
              {investmentPositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {investments("empty")}
                </Text>
              ) : (
                investmentPositions.map((investment, index) => (
                  <Card
                    key={investment.id}
                    withBorder
                    shadow="sm"
                    radius="md"
                    padding="md"
                  >
                    <Stack gap="sm">
                      <div>
                        <Text fw={600}>
                          {investments("investmentLabel", { index: index + 1 })}
                        </Text>
                        <Text size="sm">
                          {formatInvestmentSummary(
                            investments,
                            investment,
                            baseCurrency,
                            locale
                          )}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {investments("startMonth")}: {investment.startMonth ?? "--"}
                        </Text>
                      </div>
                      <Group gap="sm">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setEditingInvestmentId(investment.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() =>
                            setConfirmDelete({
                              type: "investment",
                              id: investment.id,
                              label: investments("investmentLabel", { index: index + 1 }),
                            })
                          }
                        >
                          {investments("removeInvestment")}
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{loans("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => onLoanPositionAdd(createLoanPositionFromTemplate({ baseMonth }))}
                >
                  {loans("addLoan")}
                </Button>
              </Group>
              {loanPositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {loans("empty")}
                </Text>
              ) : (
                loanPositions.map((loan, index) => (
                  <Card key={loan.id} withBorder shadow="sm" radius="md" padding="md">
                    <Stack gap="sm">
                      <div>
                        <Text fw={600}>
                          {loans("loanLabel", { index: index + 1 })}
                        </Text>
                        <Text size="sm">
                          {formatLoanSummary(loans, loan, baseCurrency, locale)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {loans("startMonth")}: {loan.startMonth ?? "--"}
                        </Text>
                      </div>
                      <Group gap="sm">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setEditingLoanId(loan.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() =>
                            setConfirmDelete({
                              type: "loan",
                              id: loan.id,
                              label: loans("loanLabel", { index: index + 1 }),
                            })
                          }
                        >
                          {loans("removeLoan")}
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {milestoneRows.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t("overviewEmpty")}
              </Text>
            ) : (
              <Stack gap="md">
                <Card withBorder radius="md">
                  <Stack gap="sm">
                    <Text fw={600}>{t("overviewTitle")}</Text>
                    {milestoneRows.map((row) => (
                      <Group key={row.label} justify="space-between">
                        <Text>{row.label}</Text>
                        <Text c="dimmed">{row.months.join(", ")}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {activeTab === "events" && (
        <Button
          style={floatingButtonStyle}
          onClick={() => {
            setActiveTab("events");
            setAddEventOpen(true);
          }}
        >
          {t("addEvent")}
        </Button>
      )}

      <TimelineEventDrawer
        mode="create"
        opened={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        assumptions={assumptions}
        members={members}
        scenarioOptions={scenarios.map((scenario) => ({
          value: scenario.id,
          label: scenario.name,
        }))}
        defaultScenarioId={scenarioId}
        defaultMonth={selectedMonth ?? baseMonth ?? null}
        parentGroupOptions={parentGroupOptions}
        onAddDefinition={(definition, scenarioIds) => onAddDefinition(definition, scenarioIds)}
        onAddHomePosition={() => {
          onHomePositionAdd(createHomePositionFromTemplate({ baseMonth }));
          setHomeToastOpen(true);
        }}
        onCreateComplete={handleCreateComplete}
      />

      <MergeDuplicatesModal
        opened={mergeOpen}
        onClose={() => setMergeOpen(false)}
        scenarios={scenarios}
        eventLibrary={eventLibrary}
        onMerge={onMergeDuplicates}
      />

      <TimelineEventDrawer
        mode="edit"
        opened={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        assumptions={assumptions}
        members={members}
        parentGroupOptions={parentGroupOptions}
        editingEvent={editingEvent}
        onUpdateDefinition={onUpdateDefinition}
        onUpdateEventRef={onUpdateEventRef}
      />

      <Modal
        opened={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={common("actionDelete")}
        centered
      >
        <Stack gap="md">
          <Text>
            {common("confirmDelete", { name: confirmDelete?.label ?? "" })}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              {common("actionCancel")}
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (!confirmDelete) {
                  return;
                }
                if (confirmDelete.type === "event") {
                  onRemoveEventRef(confirmDelete.id);
                } else if (confirmDelete.type === "home") {
                  onHomePositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "car") {
                  onCarPositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "investment") {
                  onInvestmentPositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "loan") {
                  onLoanPositionRemove(confirmDelete.id);
                }
                setConfirmDelete(null);
              }}
            >
              {common("actionDelete")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(editingHome)}
        onClose={() => setEditingHomeId(null)}
        title={homes("title")}
        fullScreen
      >
        {editingHome && (
          <HomeDetailsForm
            home={editingHome}
            onCancel={() => setEditingHomeId(null)}
            onSave={(updated) => {
              onHomePositionUpdate(updated);
              setEditingHomeId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={Boolean(editingCar)}
        onClose={() => setEditingCarId(null)}
        title={cars("title")}
        fullScreen
      >
        {editingCar && (
          <CarDetailsForm
            car={editingCar}
            onCancel={() => setEditingCarId(null)}
            onSave={(updated) => {
              onCarPositionUpdate(updated);
              setEditingCarId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={Boolean(editingInvestment)}
        onClose={() => setEditingInvestmentId(null)}
        title={investments("title")}
        fullScreen
      >
        {editingInvestment && (
          <InvestmentDetailsForm
            investment={editingInvestment}
            onCancel={() => setEditingInvestmentId(null)}
            onSave={(updated) => {
              onInvestmentPositionUpdate(updated);
              setEditingInvestmentId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={Boolean(editingLoan)}
        onClose={() => setEditingLoanId(null)}
        title={loans("title")}
        fullScreen
      >
        {editingLoan && (
          <LoanDetailsForm
            loan={editingLoan}
            onCancel={() => setEditingLoanId(null)}
            onSave={(updated) => {
              onLoanPositionUpdate(updated);
              setEditingLoanId(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}
