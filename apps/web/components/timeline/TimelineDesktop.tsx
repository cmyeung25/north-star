"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Notification,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { Fragment, useEffect, useMemo, useState } from "react";
import { type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { defaultCurrency } from "../../lib/i18n";
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
import type { DuplicateCluster } from "../../src/domain/events/mergeDuplicates";
import {
  buildEventTreeRows,
  createCarPositionFromTemplate,
  createHomePositionFromTemplate,
  createInvestmentPositionFromTemplate,
  createLoanPositionFromTemplate,
  getEventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventLabel,
  formatCurrency,
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

interface TimelineDesktopProps {
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

export default function TimelineDesktop({
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
}: TimelineDesktopProps) {
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
    type: "home" | "car" | "investment" | "loan";
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
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitleDesktop")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              {t("devHint")}
            </Text>
          )}
        </div>
        {activeTab === "events" && (
          <Group gap="sm">
            <Button variant="light" onClick={() => setMergeOpen(true)}>
              {t("mergeDuplicates")}
            </Button>
            <Button
              onClick={() => {
                setActiveTab("events");
                setAddEventOpen(true);
              }}
            >
              {t("addEvent")}
            </Button>
          </Group>
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

            <Stack gap="sm">
              {monthGroups.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {hasEvents ? t("emptyGroup") : t("emptyAll")}
                </Text>
              ) : (
                <Table striped highlightOnHover withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("tableEnabled")}</Table.Th>
                      <Table.Th>{t("tableGroup")}</Table.Th>
                      <Table.Th>{t("tableType")}</Table.Th>
                      <Table.Th>{t("tableName")}</Table.Th>
                      <Table.Th>{t("tableStart")}</Table.Th>
                      <Table.Th>{t("tableEnd")}</Table.Th>
                      <Table.Th>{t("tableImpact")}</Table.Th>
                      <Table.Th>{t("tableMonthly")}</Table.Th>
                      <Table.Th>{t("tableOneTime")}</Table.Th>
                      <Table.Th>{t("tableGrowth")}</Table.Th>
                      <Table.Th>{t("tableCurrency")}</Table.Th>
                      <Table.Th>{t("tableActions")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {monthGroups.map(({ month, label, rows }) => {
                      const monthKey = month === "unscheduled" ? "unscheduled" : month;
                      return (
                        <Fragment key={monthKey}>
                          <Table.Tr id={`month-${monthKey}`} data-month={monthKey}>
                            <Table.Td colSpan={12}>
                              <UnstyledButton
                                style={{ width: "100%" }}
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
                            </Table.Td>
                          </Table.Tr>
                          {rows.map(({ view, depth, hasChildren }) => {
                            const rule = view.rule;
                            const isGroup = view.definition.kind === "group";
                            const monthlyAmount = rule.monthlyAmount ?? 0;
                            const oneTimeAmount = rule.oneTimeAmount ?? 0;
                            const annualGrowthPct = rule.annualGrowthPct ?? 0;
                            const eventCurrency = view.definition.currency ?? defaultCurrency;
                            const hasOverrides =
                              Boolean(view.ref.overrides) &&
                              Object.keys(view.ref.overrides ?? {}).length > 0;
                            const collapsed =
                              collapsedGroups[view.definition.id] ?? false;

                            return (
                              <Table.Tr key={view.definition.id}>
                                <Table.Td>
                                  <Switch
                                    checked={view.ref.enabled}
                                    onChange={(eventChange) =>
                                      handleToggle(
                                        view.definition.id,
                                        eventChange.currentTarget.checked
                                      )
                                    }
                                  />
                                </Table.Td>
                                <Table.Td>
                                  <Badge variant="light" color="gray">
                                    {isGroup
                                      ? t("groupLabel")
                                      : getEventGroupLabel(t, view.definition.type)}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  {isGroup
                                    ? t("groupNode")
                                    : `${iconMap[view.definition.type]} ${getEventLabel(
                                        t,
                                        view.definition.type
                                      )}`}
                                </Table.Td>
                                <Table.Td>
                                  <Group gap="xs" style={{ paddingLeft: depth * 16 }}>
                                    <Text fw={isGroup ? 600 : undefined}>
                                      {view.definition.title}
                                    </Text>
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  {rule.startMonth ?? t("tablePlaceholder")}
                                </Table.Td>
                                <Table.Td>
                                  {rule.endMonth ?? t("tablePlaceholder")}
                                </Table.Td>
                                <Table.Td>
                                  {isGroup
                                    ? t("tablePlaceholder")
                                    : getEventImpactHint(t, view.definition.type)}
                                </Table.Td>
                                <Table.Td>
                                  {isGroup || monthlyAmount === 0
                                    ? t("tablePlaceholder")
                                    : formatCurrency(
                                        monthlyAmount,
                                        eventCurrency,
                                        locale
                                      )}
                                </Table.Td>
                                <Table.Td>
                                  {isGroup || oneTimeAmount === 0
                                    ? t("tablePlaceholder")
                                    : formatCurrency(
                                        oneTimeAmount,
                                        eventCurrency,
                                        locale
                                      )}
                                </Table.Td>
                                <Table.Td>
                                  {!isGroup && annualGrowthPct > 0
                                    ? `${annualGrowthPct}%`
                                    : t("tablePlaceholder")}
                                </Table.Td>
                                <Table.Td>
                                  {isGroup ? t("tablePlaceholder") : eventCurrency}
                                </Table.Td>
                                <Table.Td>
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
                                    <Button
                                      size="xs"
                                      variant="light"
                                      onClick={() => handleEditOpen(view)}
                                    >
                                      {common("actionEdit")}
                                    </Button>
                                    {hasOverrides && !isGroup && (
                                      <Badge variant="light" color="indigo">
                                        {t("overrideBadge")}
                                      </Badge>
                                    )}
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="positions" pt="md">
          <Stack gap="md">
            {homeToastOpen && (
              <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
                <Group justify="space-between" align="center" wrap="wrap">
                  <Text size="sm">{t("homeToast")}</Text>
                  <Button component={Link} href={overviewUrl} size="xs" variant="light">
                    {t("goToOverview")}
                  </Button>
                </Group>
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
                  <Card key={home.id} withBorder padding="md" radius="md">
                    <Group justify="space-between" align="center" wrap="wrap">
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
                    </Group>
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
                  onClick={() =>
                    onCarPositionAdd(createCarPositionFromTemplate({ baseMonth }))
                  }
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
                  <Card key={car.id} withBorder padding="md" radius="md">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <div>
                        <Text fw={600}>
                          {cars("carLabel", { index: index + 1 })}
                        </Text>
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
                    </Group>
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
                  <Card key={investment.id} withBorder padding="md" radius="md">
                    <Group justify="space-between" align="center" wrap="wrap">
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
                    </Group>
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
                  onClick={() =>
                    onLoanPositionAdd(createLoanPositionFromTemplate({ baseMonth }))
                  }
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
                  <Card key={loan.id} withBorder padding="md" radius="md">
                    <Group justify="space-between" align="center" wrap="wrap">
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
                    </Group>
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
              <Card withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Text fw={600}>{t("overviewTitle")}</Text>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("overviewMilestone")}</Table.Th>
                        <Table.Th>{t("overviewMonth")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {milestoneRows.map((row) => (
                        <Table.Tr key={row.label}>
                          <Table.Td>{row.label}</Table.Td>
                          <Table.Td>{row.months.join(", ")}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

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
                if (confirmDelete.type === "home") {
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

      <Drawer
        opened={Boolean(editingHome)}
        onClose={() => setEditingHomeId(null)}
        position="right"
        size="md"
        title={homes("title")}
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
      </Drawer>

      <Drawer
        opened={Boolean(editingCar)}
        onClose={() => setEditingCarId(null)}
        position="right"
        size="md"
        title={cars("title")}
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
      </Drawer>

      <Drawer
        opened={Boolean(editingInvestment)}
        onClose={() => setEditingInvestmentId(null)}
        position="right"
        size="md"
        title={investments("title")}
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
      </Drawer>

      <Drawer
        opened={Boolean(editingLoan)}
        onClose={() => setEditingLoanId(null)}
        position="right"
        size="md"
        title={loans("title")}
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
      </Drawer>
    </Stack>
  );
}
