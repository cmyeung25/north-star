"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { getEventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link } from "../../../src/i18n/navigation";
import AddMoneyItemModal from "../../../components/money/AddMoneyItemModal";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { formatCurrency } from "../../../lib/i18n";
import { buildScenarioEventViews, buildTimelineEventFromDefinition } from "../../../src/domain/events/utils";
import { getEventTypeDisplay } from "../../../components/timeline/utils";

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
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const scenarioIdValue = scenario?.id;
  const [addModalOpen, setAddModalOpen] = useState(false);

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

  const renderEventList = (
    rows: typeof eventRows,
    options: { showHighlightToggle?: boolean; showOverlapHint?: boolean } = {}
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
            {renderEventList(incomeEvents)}
            <Button component={Link} href={timelineTabHref} size="xs" variant="light">
              {t("manageIncomeCta")}
            </Button>
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
              <Button component={Link} href={budgetHref} size="xs" variant="light">
                {t("expensesBudgetCta")}
              </Button>
            </Group>
            {renderEventList(expenseEvents, { showOverlapHint: true })}
            <Button component={Link} href={timelineTabHref} size="xs" variant="light">
              {t("expensesEventsCta")}
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assets" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("assetsDescription")}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Card withBorder radius="md" padding="sm">
                <Stack gap={4}>
                  <Text fw={600}>{homesText("title")}</Text>
                  <Text size="sm" c="dimmed">
                    {homes.length > 0
                      ? t("assetCount", { count: homes.length })
                      : homesText("empty")}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder radius="md" padding="sm">
                <Stack gap={4}>
                  <Text fw={600}>{investmentsText("title")}</Text>
                  <Text size="sm" c="dimmed">
                    {investments.length > 0
                      ? t("assetCount", { count: investments.length })
                      : investmentsText("empty")}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder radius="md" padding="sm">
                <Stack gap={4}>
                  <Text fw={600}>{insurancesText("title")}</Text>
                  <Text size="sm" c="dimmed">
                    {insurances.length > 0
                      ? t("assetCount", { count: insurances.length })
                      : insurancesText("empty")}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder radius="md" padding="sm">
                <Stack gap={4}>
                  <Text fw={600}>{carsText("title")}</Text>
                  <Text size="sm" c="dimmed">
                    {cars.length > 0
                      ? t("assetCount", { count: cars.length })
                      : carsText("empty")}
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>
            <Button component={Link} href={timelineTabHref} size="xs" variant="light">
              {t("assetsCta")}
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="liabilities" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("liabilitiesDescription")}
            </Text>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text fw={600}>{loansText("title")}</Text>
                <Text size="sm" c="dimmed">
                  {loans.length > 0 ? t("assetCount", { count: loans.length }) : loansText("empty")}
                </Text>
              </Stack>
            </Card>
            <Button component={Link} href={timelineTabHref} size="xs" variant="light">
              {t("liabilitiesCta")}
            </Button>
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
    </Stack>
  );
}
