"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Notification,
  NumberInput,
  MultiSelect,
  Select,
  SegmentedControl,
  Slider,
  Stack,
  Tabs,
  Switch,
  Text,
  TextInput,
  Title,
  SimpleGrid,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import { signInWithGoogle, signOutUser } from "../../../lib/authActions";
import { isFirebaseConfigured } from "../../../lib/firebaseClient";
import {
  downloadCloudStateToLocal,
  fetchCloudSummary,
  requiresSchemaUpgrade,
  uploadLocalStateToCloud,
  type CloudSummary,
} from "../../../lib/sync/firestoreSync";
import { useAuthState } from "../../../src/hooks/useAuthState";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
  createBudgetRuleId,
  createMemberId,
  type MemberMilestone,
  type ScenarioMemberKind,
} from "../../../src/store/scenarioStore";
import { appliesToScenario, type ApplyScope } from "../../../src/domain/applyScope";
import { useSettingsStore } from "../../../src/store/settingsStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";
import { buildMonthRange } from "@north-star/engine";
import { getMemberAgeYears } from "../../../src/domain/members/age";
import { isValidMonthStr, normalizeMonthStrict } from "../../../src/utils/month";
import {
  compileBudgetRuleToMonthlySeries,
  type BudgetRuleMonthlyEntry,
} from "../../../src/domain/budget/compileBudgetRules";
import DataManagementSection from "../../../components/DataManagementSection";
import PositionDetailList from "../../../components/timeline/PositionDetailList";
import { buildScenarioTimelineEvents } from "../../../src/domain/events/utils";
import { getEventMeta } from "../../../src/events/eventCatalog";
import { buildDefaultSmartInvestPolicy } from "../../../src/domain/smartInvest/defaultPolicy";

type SettingsClientProps = {
  scenarioId?: string;
};

type ToastState = {
  message: string;
  color?: string;
};

const isHousingCategory = (category: string) => category === "housing";

export default function SettingsClient({ scenarioId }: SettingsClientProps) {
  const locale = useLocale();
  const t = useTranslations("assumptions");
  const membersText = useTranslations("members");
  const budgetText = useTranslations("budgetRules");
  const common = useTranslations("common");
  const timelineText = useTranslations("timeline");
  const errors = useTranslations("errors");
  const validation = useTranslations("validation");
  const horizonOptions = [
    { value: "120", label: t("horizon10y") },
    { value: "240", label: t("horizon20y") },
    { value: "360", label: t("horizon30y") },
  ];
  const baseMonthHelper = t("baseMonthHelper");
  const authState = useAuthState();
  const scenarioIdFromQuery = scenarioId ?? null;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const setGlobalHorizonMonths = useScenarioStore(
    (state) => state.setGlobalHorizonMonths
  );
  const setGlobalBaseMonth = useScenarioStore((state) => state.setGlobalBaseMonth);
  const setAnnualInflationPct = useScenarioStore(
    (state) => state.setAnnualInflationPct
  );
  const setViewMode = useScenarioStore((state) => state.setViewMode);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const deleteMember = useScenarioStore((state) => state.deleteMember);
  const setMemberApplyScope = useScenarioStore((state) => state.setMemberApplyScope);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);
  const removeBudgetRule = useScenarioStore((state) => state.removeBudgetRule);
  const autoSyncEnabled = useSettingsStore((state) => state.autoSyncEnabled);
  const lastAutoSyncAt = useSettingsStore((state) => state.lastAutoSyncAt);
  const autoSyncError = useSettingsStore((state) => state.autoSyncError);
  const setAutoSyncEnabled = useSettingsStore((state) => state.setAutoSyncEnabled);
  const setAutoSyncError = useSettingsStore((state) => state.setAutoSyncError);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [syncToast, setSyncToast] = useState<ToastState | null>(null);
  const [baseMonthInput, setBaseMonthInput] = useState("");
  const [baseMonthError, setBaseMonthError] = useState<string | null>(null);
  const [memberBirthMonthInputs, setMemberBirthMonthInputs] = useState<
    Record<string, string>
  >({});
  const [memberBirthMonthErrors, setMemberBirthMonthErrors] = useState<
    Record<string, string | null>
  >({});
  const [milestoneMonthInputs, setMilestoneMonthInputs] = useState<
    Record<string, string>
  >({});
  const [milestoneMonthErrors, setMilestoneMonthErrors] = useState<
    Record<string, string | null>
  >({});
  const [activeTab, setActiveTab] = useState("data");
  const [budgetMonthInputs, setBudgetMonthInputs] = useState<
    Record<string, { startMonth: string; endMonth: string }>
  >({});
  const [budgetMonthErrors, setBudgetMonthErrors] = useState<
    Record<string, { startMonth?: string; endMonth?: string }>
  >({});
  const [cloudSummary, setCloudSummary] = useState<CloudSummary | null>(null);
  const [syncingAction, setSyncingAction] = useState<null | "upload" | "download">(
    null
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMemberMonthRef = useRef<Record<string, string>>({});
  const prevMilestoneMonthRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (
      scenarioIdFromQuery &&
      scenarioIdFromQuery !== activeScenarioId &&
      scenarios.some((scenario) => scenario.id === scenarioIdFromQuery)
    ) {
      setActiveScenario(scenarioIdFromQuery);
    }
  }, [activeScenarioId, scenarioIdFromQuery, scenarios, setActiveScenario]);

  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioIdFromQuery, activeScenarioId, scenarios),
    [activeScenarioId, scenarioIdFromQuery, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const includeBudgetRulesInProjection =
    scenario?.assumptions.includeBudgetRulesInProjection ?? true;
  const defaultSmartInvestPolicy = useMemo(
    () => buildDefaultSmartInvestPolicy(t("smartInvestDefaultAllocation")),
    [t]
  );
  const smartInvestPolicy = scenario?.assumptions.smartInvest ?? defaultSmartInvestPolicy;
  const hasExpenseEvents = useMemo(() => {
    if (!scenario) {
      return false;
    }
    const events = buildScenarioTimelineEvents(scenario, eventLibrary);
    return events.some(
      (event) => event.enabled && getEventMeta(event.type).group === "expense"
    );
  }, [eventLibrary, scenario]);
  const baseCurrency = scenario?.baseCurrency ?? "";
  const formatCurrency = useCallback(
    (value: number) => {
      if (!baseCurrency) {
        return value.toLocaleString(locale);
      }
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: baseCurrency,
        maximumFractionDigits: 0,
      }).format(value);
    },
    [baseCurrency, locale]
  );
  const smartInvestSummaryItems = useMemo(() => {
    const reserveValue =
      smartInvestPolicy.reserve.mode === "fixed"
        ? formatCurrency(smartInvestPolicy.reserve.amount ?? 0)
        : timelineText("smartInvestReserveMonths", {
            months: smartInvestPolicy.reserve.months ?? 0,
          });
    const contributionValue =
      smartInvestPolicy.contribution.mode === "percentOfIncome"
        ? timelineText("smartInvestContributionIncome", {
            pct: smartInvestPolicy.contribution.pct ?? 0,
          })
        : timelineText("smartInvestContributionSurplus", {
            pct: smartInvestPolicy.contribution.pct ?? 0,
          });
    const allocationValue = smartInvestPolicy.allocation
      .map((allocation) =>
        timelineText("smartInvestAllocationItem", {
          name: allocation.name,
          pct: allocation.targetPct,
          returnPct: allocation.assumedAnnualReturnPct,
        })
      )
      .join(" · ");
    return [
      {
        label: timelineText("smartInvestSummaryReserve"),
        value: reserveValue,
      },
      {
        label: timelineText("smartInvestSummaryContribution"),
        value: contributionValue,
      },
      {
        label: timelineText("smartInvestSummaryAllocation"),
        value: allocationValue,
      },
    ];
  }, [formatCurrency, smartInvestPolicy, timelineText]);

  useEffect(() => {
    setBaseMonthInput(appSettings.globalBaseMonth ?? "");
    setBaseMonthError(null);
  }, [appSettings.globalBaseMonth]);

  useEffect(() => {
    setMemberBirthMonthInputs((current) => {
      const next = { ...current };
      const previous = prevMemberMonthRef.current;
      members.forEach((member) => {
        const stored = member.birthMonth ?? "";
        if (next[member.id] === undefined || next[member.id] === previous[member.id]) {
          next[member.id] = stored;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!members.some((member) => member.id === key)) {
          delete next[key];
        }
      });
      prevMemberMonthRef.current = members.reduce<Record<string, string>>(
        (acc, member) => {
          acc[member.id] = member.birthMonth ?? "";
          return acc;
        },
        {}
      );
      return next;
    });
    setMilestoneMonthInputs((current) => {
      const next = { ...current };
      const previous = prevMilestoneMonthRef.current;
      const currentMilestoneKeys = new Set<string>();
      members.forEach((member) => {
        (member.milestones ?? []).forEach((milestone) => {
          const key = `${member.id}:${milestone.id}`;
          currentMilestoneKeys.add(key);
          const stored = milestone.month ?? "";
          if (next[key] === undefined || next[key] === previous[key]) {
            next[key] = stored;
          }
        });
      });
      Object.keys(next).forEach((key) => {
        if (!currentMilestoneKeys.has(key)) {
          delete next[key];
        }
      });
      prevMilestoneMonthRef.current = members.reduce<Record<string, string>>(
        (acc, member) => {
          (member.milestones ?? []).forEach((milestone) => {
            acc[`${member.id}:${milestone.id}`] = milestone.month ?? "";
          });
          return acc;
        },
        {}
      );
      return next;
    });
  }, [members]);

  useEffect(() => {
    let active = true;

    const loadCloudSummary = async () => {
      if (authState.status !== "signed-in" || !authState.user) {
        setCloudSummary(null);
        setSyncError(null);
        return;
      }

      try {
        const summary = await fetchCloudSummary(authState.user.uid);
        if (active) {
          setCloudSummary(summary);
          setSyncError(null);
        }
      } catch (error) {
        if (active) {
          setSyncError(
            error instanceof Error
              ? error.message
              : errors("syncStatusLoadFailed")
          );
        }
      }
    };

    void loadCloudSummary();

    return () => {
      active = false;
    };
  }, [authState.status, authState.user, errors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnlineChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", handleOnlineChange);
    window.addEventListener("offline", handleOnlineChange);

    return () => {
      window.removeEventListener("online", handleOnlineChange);
      window.removeEventListener("offline", handleOnlineChange);
    };
  }, []);

  const showToast = (message: string, color?: string) => {
    setToast({ message, color });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2000);
  };

  const showSyncToast = (message: string, color?: string) => {
    setSyncToast({ message, color });
    if (syncToastTimeoutRef.current) {
      clearTimeout(syncToastTimeoutRef.current);
    }
    syncToastTimeoutRef.current = setTimeout(() => {
      setSyncToast(null);
    }, 3000);
  };

  const isSignedIn = authState.status === "signed-in" && authState.user;
  const cloudHasData = (cloudSummary?.scenarioCount ?? 0) > 0;
  const localHasData = scenarios.length > 0;
  const schemaUpgradeRequired = requiresSchemaUpgrade(cloudSummary);
  const hasConflict = isSignedIn && cloudHasData && localHasData;
  const autoSyncStatusLabel = isSignedIn
    ? autoSyncEnabled
      ? common("autoSyncOn")
      : common("autoSyncOff")
    : common("autoSyncSignIn");
  const autoSyncDetails = isSignedIn && autoSyncEnabled
    ? isOnline
      ? lastAutoSyncAt
        ? common("lastSyncAt", {
            time: new Date(lastAutoSyncAt).toLocaleString(locale),
          })
        : common("lastSyncNotYet")
      : common("offlineSyncNotice")
    : null;

  const refreshCloudSummary = async () => {
    if (!authState.user) {
      setCloudSummary(null);
      return;
    }

    const summary = await fetchCloudSummary(authState.user.uid);
    setCloudSummary(summary);
  };

  const handleUpload = async (force = false) => {
    if (!authState.user) {
      return;
    }

    if (schemaUpgradeRequired) {
      setSyncError(errors("syncUpgradeRequired"));
      return;
    }

    if (hasConflict && !force) {
      setConflictModalOpen(true);
      return;
    }

    setSyncingAction("upload");
    setSyncError(null);
    try {
      const result = await uploadLocalStateToCloud(authState.user.uid);
      showSyncToast(
        common("syncUploadSuccess", { count: result.scenarioCount }),
        "teal"
      );
      await refreshCloudSummary();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : errors("uploadFailed")
      );
    } finally {
      setSyncingAction(null);
    }
  };

  const handleDownload = async (force = false) => {
    if (!authState.user) {
      return;
    }

    if (schemaUpgradeRequired) {
      setSyncError(errors("syncUpgradeRequired"));
      return;
    }

    if (hasConflict && !force) {
      setConflictModalOpen(true);
      return;
    }

    setSyncingAction("download");
    setSyncError(null);
    try {
      const result = await downloadCloudStateToLocal(authState.user.uid);
      showSyncToast(
        common("syncDownloadSuccess", { count: result.scenarioCount }),
        "teal"
      );
      await refreshCloudSummary();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : errors("downloadFailed")
      );
    } finally {
      setSyncingAction(null);
    }
  };

  const handleAssumptionChange = (
    patch: Parameters<typeof updateScenarioAssumptions>[1]
  ) => {
    if (!scenario) {
      return;
    }
    updateScenarioAssumptions(scenario.id, patch);
    showToast(common("saved"), "teal");
  };

  useEffect(() => {
    setBudgetMonthInputs((current) => {
      const next = { ...current };
      budgetRules.forEach((rule) => {
        if (!next[rule.id]) {
          next[rule.id] = {
            startMonth: rule.startMonth ?? "",
            endMonth: rule.endMonth ?? "",
          };
        }
      });
      Object.keys(next).forEach((ruleId) => {
        if (!budgetRules.some((rule) => rule.id === ruleId)) {
          delete next[ruleId];
        }
      });
      return next;
    });
  }, [budgetRules]);

  const updateBudgetMonthInput = (
    ruleId: string,
    field: "startMonth" | "endMonth",
    value: string
  ) => {
    setBudgetMonthInputs((current) => ({
      ...current,
      [ruleId]: {
        startMonth: current[ruleId]?.startMonth ?? "",
        endMonth: current[ruleId]?.endMonth ?? "",
        [field]: value,
      },
    }));
    setBudgetMonthErrors((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], [field]: undefined },
    }));
  };

  const validateBudgetMonth = (
    ruleId: string,
    field: "startMonth" | "endMonth"
  ) => {
    if (!scenario) {
      return;
    }
    const rawValue = budgetMonthInputs[ruleId]?.[field] ?? "";
    const trimmed = rawValue.trim();

    if (trimmed === "") {
      updateBudgetRule(ruleId, { [field]: undefined });
      setBudgetMonthErrors((current) => ({
        ...current,
        [ruleId]: { ...current[ruleId], [field]: undefined },
      }));
      updateBudgetMonthInput(ruleId, field, "");
      return;
    }

    const normalized = normalizeMonthStrict(trimmed);
    if (!normalized.ok) {
      setBudgetMonthErrors((current) => ({
        ...current,
        [ruleId]: { ...current[ruleId], [field]: validation("useYearMonth") },
      }));
      return;
    }

    updateBudgetRule(ruleId, { [field]: normalized.month });
    setBudgetMonthErrors((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], [field]: undefined },
    }));
    updateBudgetMonthInput(ruleId, field, normalized.month);
  };

  const scenarioOptions = useMemo(
    () =>
      scenarios.map((entry) => ({
        value: entry.id,
        label: entry.name,
      })),
    [scenarios]
  );

  if (!scenario) {
    return (
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>{common("settingsTitle")}</Title>
          <Text c="dimmed" size="sm">
            {common("settingsMissingScenario")}
          </Text>
        </Stack>
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Text fw={600}>{common("settingsRecoveryTitle")}</Text>
            <Text size="sm" c="dimmed">
              {common("settingsRecoveryDescription")}
            </Text>
            <Group>
              <Button component={Link} href="/onboarding" variant="light">
                {common("actionContinue")}
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    );
  }

  const { assumptions } = scenario;
  const baseMonth = appSettings.globalBaseMonth;
  const horizonMonths = appSettings.globalHorizonMonths;
  const scopedBudgetRules = budgetRules.filter((rule) =>
    appliesToScenario(rule.applyScope, scenario.id)
  );
  const hasHousingRules = scopedBudgetRules.some((rule) =>
    isHousingCategory(rule.category)
  );
  const horizonValue = horizonOptions.some(
    (option) => Number(option.value) === horizonMonths
  )
    ? String(horizonMonths)
    : "240";
  const horizonEndMonth =
    baseMonth && horizonMonths > 0
      ? buildMonthRange(baseMonth, horizonMonths).at(-1) ?? null
      : null;
  const formatAgeYears = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  const buildZeroPreview = (rule: (typeof budgetRules)[number]): BudgetRuleMonthlyEntry[] => {
    if (!baseMonth || horizonMonths <= 0) {
      return [];
    }
    return buildMonthRange(baseMonth, horizonMonths).map(
      (month) => ({
        month,
        amount: 0,
        source: "budget",
        sourceId: rule.id,
        memberId: rule.memberId,
        label: rule.name,
        category: rule.category,
      })
    );
  };

  const budgetRulePreviews = new Map(
    budgetRules.map((rule) => [
      rule.id,
      rule.enabled
        ? compileBudgetRuleToMonthlySeries(rule, scenario, members)
        : buildZeroPreview(rule),
    ])
  );

  const lastSyncedLabel = cloudSummary?.lastSyncedAt
    ? common("lastSyncedAt", {
        time: new Date(cloudSummary.lastSyncedAt).toLocaleString(locale),
      })
    : common("notSyncedYet");
  const syncStatusLabel = isSignedIn
    ? common("signedInStatus", { status: lastSyncedLabel })
    : common("localModeStatus");

  const normalizeApplyScope = (applyScope?: ApplyScope): ApplyScope =>
    applyScope ?? { scope: "all" };

  const renderApplyScope = (
    value: ApplyScope | undefined,
    onChange: (next: ApplyScope) => void,
    description?: string
  ) => {
    const scope = value?.scope ?? "all";
    const scenarioIds =
      value?.scope === "include" || value?.scope === "exclude"
        ? value.scenarioIds
        : [];

    return (
      <Stack gap={4}>
        <SegmentedControl
          data={[
            { value: "all", label: common("applyScopeAll") },
            { value: "include", label: common("applyScopeInclude") },
            { value: "exclude", label: common("applyScopeExclude") },
          ]}
          value={scope}
          onChange={(next) => {
            if (next === "all") {
              onChange({ scope: "all" });
              return;
            }
            onChange({ scope: next as "include" | "exclude", scenarioIds });
          }}
        />
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
        {scope !== "all" && (
          <MultiSelect
            data={scenarioOptions}
            value={scenarioIds}
            onChange={(next: string[]) =>
              onChange({ scope: scope as "include" | "exclude", scenarioIds: next })
            }
            placeholder={common("applyScopePlaceholder")}
          />
        )}
      </Stack>
    );
  };

  const createMilestoneId = () => `milestone-${nanoid(8)}`;

  const buildDefaultMilestones = (kind: ScenarioMemberKind): MemberMilestone[] => {
    if (kind !== "person") {
      return [];
    }
    return [
      {
        id: createMilestoneId(),
        kind: "schoolStart",
        label: membersText("milestoneSchoolStart"),
        atAgeYears: 6,
        applyScope: { scope: "all" } as ApplyScope,
      },
      {
        id: createMilestoneId(),
        kind: "graduation",
        label: membersText("milestoneGraduation"),
        atAgeYears: 22,
        applyScope: { scope: "all" } as ApplyScope,
      },
      {
        id: createMilestoneId(),
        kind: "retirement",
        label: membersText("milestoneRetirement"),
        atAgeYears: 65,
        applyScope: { scope: "all" } as ApplyScope,
      },
    ];
  };

  const updateMemberMilestones = (
    memberId: string,
    updater: (milestones: NonNullable<(typeof members)[number]["milestones"]>) =>
      NonNullable<(typeof members)[number]["milestones"]>
  ) => {
    const member = members.find((entry) => entry.id === memberId);
    if (!member) {
      return;
    }
    const currentMilestones = member.milestones ?? [];
    updateMember(memberId, { milestones: updater(currentMilestones) });
  };

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>{common("settingsTitle")}</Title>
        <Text c="dimmed" size="sm">
          {common("settingsSubtitle", { name: scenario.name })}
        </Text>
      </Stack>

      {toast && (
        <Notification color={toast.color} onClose={() => setToast(null)}>
          {toast.message}
        </Notification>
      )}

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? "data")}>
        <Tabs.List>
          <Tabs.Tab value="data">{common("settingsTabData")}</Tabs.Tab>
          <Tabs.Tab value="global">{common("settingsTabGlobal")}</Tabs.Tab>
          <Tabs.Tab value="members">{common("settingsTabMembers")}</Tabs.Tab>
          <Tabs.Tab value="budget">{common("settingsTabBudget")}</Tabs.Tab>
          <Tabs.Tab value="other">{common("settingsTabOther")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="data" pt="md">
          <Card withBorder radius="md" padding="md" id="sync">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600}>{common("syncTitle")}</Text>
                <Text size="xs" c="dimmed">
                  {syncStatusLabel}
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                {common("syncSubtitle")}
              </Text>

              {syncToast && (
                <Notification
                  color={syncToast.color}
                  onClose={() => setSyncToast(null)}
                >
                  {syncToast.message}
                </Notification>
              )}

              {syncError && (
                <Notification color="red" onClose={() => setSyncError(null)}>
                  {syncError}
                </Notification>
              )}

              {autoSyncError && (
                <Notification color="yellow" onClose={() => setAutoSyncError(null)}>
                  {autoSyncError}
                </Notification>
              )}

              {!isFirebaseConfigured && !isSignedIn && (
                <Notification color="yellow">
                  {common("firebaseNotConfigured")}
                </Notification>
              )}

              {schemaUpgradeRequired && (
                <Notification color="yellow">
                  {errors("syncUpgradeRequired")}
                </Notification>
              )}

              {!isSignedIn && (
                <Group>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                      } catch (error) {
                        setSyncError(
                          error instanceof Error
                            ? error.message
                            : errors("signInFailed")
                        );
                      }
                    }}
                    disabled={!isFirebaseConfigured}
                  >
                    {common("signInToSync")}
                  </Button>
                  <Text size="xs" c="dimmed">
                    {common("signInHint")}
                  </Text>
                </Group>
              )}

              <Stack gap="sm">
                {hasConflict && (
                  <Notification color="orange">
                    {common("syncConflictNotice")}
                  </Notification>
                )}
                <Stack gap={4}>
                  <Switch
                    label={common("autoSyncLabel")}
                    checked={autoSyncEnabled}
                    disabled={!isSignedIn}
                    onChange={(event) =>
                      setAutoSyncEnabled(event.currentTarget.checked)
                    }
                    description={common("autoSyncDescription")}
                  />
                  <Text size="xs" c="dimmed">
                    {autoSyncStatusLabel}
                    {autoSyncDetails ? ` · ${autoSyncDetails}` : ""}
                  </Text>
                </Stack>
                {isSignedIn && (
                  <>
                    <Group wrap="wrap">
                      <Button
                        size="sm"
                        onClick={() => void handleUpload()}
                        loading={syncingAction === "upload"}
                        disabled={schemaUpgradeRequired}
                      >
                        {common("uploadLocalToCloud")}
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => void handleDownload()}
                        loading={syncingAction === "download"}
                        disabled={schemaUpgradeRequired}
                      >
                        {common("downloadCloudToLocal")}
                      </Button>
                    </Group>
                    <Divider />
                    <Group justify="space-between" align="center">
                      <Text size="sm" c="dimmed">
                        {common("signedInAs", {
                          email: authState.user?.email ?? common("googleUser"),
                        })}
                      </Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={async () => {
                          await signOutUser();
                          setCloudSummary(null);
                        }}
                      >
                        {common("signOut")}
                      </Button>
                    </Group>
                  </>
                )}
              </Stack>
            </Stack>
          </Card>

          <Modal
            opened={conflictModalOpen}
            onClose={() => setConflictModalOpen(false)}
            title={common("resolveSyncTitle")}
            centered
          >
            <Stack>
              <Text size="sm">
                {common("resolveSyncSubtitle")}
              </Text>
              <Group grow>
                <Button
                  onClick={async () => {
                    setConflictModalOpen(false);
                    await handleUpload(true);
                  }}
                >
                  {common("useLocalData")}
                </Button>
                <Button
                  variant="light"
                  onClick={async () => {
                    setConflictModalOpen(false);
                    await handleDownload(true);
                  }}
                >
                  {common("useCloudData")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <DataManagementSection onNotify={showToast} />
        </Tabs.Panel>

        <Tabs.Panel value="global" pt="md">
          <Card withBorder radius="md" padding="md">
            <Stack gap="xs">
              <Text fw={600}>{common("assumptionsHowTitle")}</Text>
              <Text size="sm" c="dimmed">
                {common("assumptionsHowLine1")}
              </Text>
              <Text size="sm" c="dimmed">
                {common("assumptionsHowLine2")}
              </Text>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md" mt="md">
            <Stack gap="md">
              <Stack gap={6}>
                <Text fw={600}>{t("planningHorizon")}</Text>
                <SegmentedControl
                  data={horizonOptions}
                  value={horizonValue}
                  onChange={(value) => {
                    setGlobalHorizonMonths(Number(value));
                    showToast(common("saved"), "teal");
                  }}
                />
              </Stack>

              <Stack gap={6}>
                <TextInput
                  label={t("baseMonth")}
                  placeholder={common("yearMonthPlaceholder")}
                  value={baseMonthInput}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setBaseMonthInput(nextValue);
                    if (baseMonthError) {
                      setBaseMonthError(null);
                    }
                  }}
                  onBlur={() => {
                    const trimmed = baseMonthInput.trim();
                    if (trimmed === "") {
                      setGlobalBaseMonth(null);
                      setBaseMonthError(null);
                      return;
                    }
                    const normalized = normalizeMonthStrict(trimmed);
                    if (!normalized.ok) {
                      setBaseMonthError(validation("useYearMonth"));
                      return;
                    }
                    setGlobalBaseMonth(normalized.month);
                    setBaseMonthInput(normalized.month);
                    setBaseMonthError(null);
                  }}
                  error={baseMonthError ?? undefined}
                />
                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">
                    {baseMonthHelper}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setBaseMonthInput("");
                      setGlobalBaseMonth(null);
                    }}
                  >
                    {common("actionAuto")}
                  </Button>
                </Group>
              </Stack>

              <Group grow>
                <NumberInput
                  label={t("annualInflationPct")}
                  value={appSettings.annualInflationPct}
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  onChange={(value) =>
                    setAnnualInflationPct(typeof value === "number" ? value : 0)
                  }
                />
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    {t("viewModeLabel")}
                  </Text>
                  <SegmentedControl
                    data={[
                      { value: "nominal", label: t("viewNominal") },
                      { value: "real", label: t("viewReal") },
                    ]}
                    value={appSettings.viewMode}
                    onChange={(value) => setViewMode(value as "nominal" | "real")}
                  />
                  <Text size="xs" c="dimmed">
                    {t("viewRealHint")}
                  </Text>
                </Stack>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="md" mt="md">
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text fw={600}>{t("smartInvestSettingsTitle")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("smartInvestSettingsHint")}
                  </Text>
                </div>
                <Button
                  component={Link}
                  href={buildScenarioUrl("/timeline", scenario.id)}
                  size="xs"
                  variant="light"
                >
                  {common("openTimeline")}
                </Button>
              </Group>
              <Divider />
              <PositionDetailList items={smartInvestSummaryItems} />
              {!smartInvestPolicy.enabled && (
                <Text size="sm" c="dimmed">
                  {t("smartInvestSummaryDisabled")}
                </Text>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="members" pt="md">
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600}>{membersText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    createMember({
                      id: createMemberId(),
                      name: membersText("defaultName"),
                      kind: "person",
                      ageAtBaseMonth: 0,
                      applyScope: { scope: "all" },
                      milestones: buildDefaultMilestones("person"),
                    });
                    showToast(common("saved"), "teal");
                  }}
                >
                  {membersText("addMember")}
                </Button>
              </Group>
              <Text size="sm" c="dimmed">
                {membersText("subtitle")}
              </Text>
              <Stack gap="sm">
                <SimpleGrid
                  cols={{ base: 1, sm: 1, lg: 2 }}
                  spacing={{ base: 10, sm: 'xl' }}
                  verticalSpacing={{ base: 'md', sm: 'xl' }}
                >
                  {members.map((member, index) => {
                    const birthMonthInput =
                      memberBirthMonthInputs[member.id] ?? member.birthMonth ?? "";
                    const birthMonthError =
                      memberBirthMonthErrors[member.id] ?? undefined;
                    const hasBirthMonth =
                      typeof member.birthMonth === "string" &&
                      isValidMonthStr(member.birthMonth);
                    const hasAgeAtBase = typeof member.ageAtBaseMonth === "number";
                    const baseMonthValue = baseMonth;
                    const validBaseMonth =
                      baseMonthValue && isValidMonthStr(baseMonthValue)
                        ? baseMonthValue
                        : null;
                    const canCalculateAge = Boolean(validBaseMonth);
                    const baseAge =
                      canCalculateAge && (hasBirthMonth || hasAgeAtBase)
                        ? getMemberAgeYears(member, validBaseMonth!, validBaseMonth!)
                        : null;
                    const endAge =
                      canCalculateAge && horizonEndMonth && (hasBirthMonth || hasAgeAtBase)
                        ? getMemberAgeYears(member, horizonEndMonth!, validBaseMonth!)
                        : null;
                    const showAgeError = !hasBirthMonth && !hasAgeAtBase;

                    return (
                      <Card key={member.id} withBorder radius="md" padding="md">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text fw={600}>
                              {membersText("memberLabel", { index: index + 1 })}
                            </Text>
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              disabled={members.length <= 1}
                              onClick={() => {
                                deleteMember(member.id);
                                showToast(common("saved"), "teal");
                              }}
                            >
                              {membersText("removeMember")}
                            </Button>
                          </Group>
                          <Group grow>
                            <TextInput
                              label={membersText("nameLabel")}
                              value={member.name}
                              onChange={(event) =>
                                updateMember(member.id, {
                                  name: event.currentTarget.value,
                                })
                              }
                            />
                            <Select
                              label={membersText("kindLabel")}
                              data={[
                                { value: "person", label: membersText("kindPerson") },
                                { value: "pet", label: membersText("kindPet") },
                              ]}
                              value={member.kind}
                              onChange={(value) => {
                                if (!value) {
                                  return;
                                }
                                updateMember(member.id, {
                                  kind: value as typeof member.kind,
                                });
                              }}
                            />
                          </Group>
                          <Group grow>
                            <TextInput
                              label={membersText("birthMonthLabel")}
                              placeholder={common("yearMonthPlaceholder")}
                              value={birthMonthInput}
                              error={birthMonthError}
                              onChange={(event) => {
                                const nextValue = event.currentTarget.value;
                                setMemberBirthMonthInputs((current) => ({
                                  ...current,
                                  [member.id]: nextValue,
                                }));
                                setMemberBirthMonthErrors((current) => ({
                                  ...current,
                                  [member.id]: null,
                                }));
                              }}
                              onBlur={() => {
                                const trimmed = birthMonthInput.trim();
                                if (trimmed === "") {
                                  updateMember(member.id, { birthMonth: undefined });
                                  setMemberBirthMonthErrors((current) => ({
                                    ...current,
                                    [member.id]: null,
                                  }));
                                  setMemberBirthMonthInputs((current) => ({
                                    ...current,
                                    [member.id]: "",
                                  }));
                                  return;
                                }
                                const normalized = normalizeMonthStrict(trimmed);
                                if (!normalized.ok) {
                                  setMemberBirthMonthErrors((current) => ({
                                    ...current,
                                    [member.id]: validation("useYearMonth"),
                                  }));
                                  return;
                                }
                                updateMember(member.id, {
                                  birthMonth: normalized.month,
                                });
                                setMemberBirthMonthErrors((current) => ({
                                  ...current,
                                  [member.id]: null,
                                }));
                                setMemberBirthMonthInputs((current) => ({
                                  ...current,
                                  [member.id]: normalized.month,
                                }));
                              }}
                            />
                            <NumberInput
                              label={membersText("ageAtBaseLabel")}
                              value={member.ageAtBaseMonth ?? ""}
                              min={0}
                              step={0.5}
                              decimalScale={2}
                              onChange={(value) =>
                                updateMember(member.id, {
                                  ageAtBaseMonth:
                                    typeof value === "number" ? value : undefined,
                                })
                              }
                            />
                          </Group>
                          {showAgeError && (
                            <Text size="xs" c="red">
                              {membersText("ageRequired")}
                            </Text>
                          )}
                          <Group gap="xl" wrap="wrap">
                            <Text size="sm" c="dimmed">
                              {membersText("baseAgeLabel")}:{" "}
                              {baseAge === null
                                ? t("notAvailable")
                                : formatAgeYears(baseAge)}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {membersText("endAgeLabel")}:{" "}
                              {endAge === null ? t("notAvailable") : formatAgeYears(endAge)}
                            </Text>
                          </Group>
                          <Stack gap="xs">
                            <Text fw={600}>{membersText("applyScopeTitle")}</Text>
                            <Text size="xs" c="dimmed">
                              {membersText("applyScopeHelper")}
                            </Text>
                            {renderApplyScope(
                              normalizeApplyScope(member.applyScope),
                              (next) => setMemberApplyScope(member.id, next),
                              membersText("applyScopeHint")
                            )}
                          </Stack>
                          <Stack gap="xs">
                            <Group justify="space-between" align="center">
                              <Text fw={600}>{membersText("milestonesTitle")}</Text>
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() =>
                                  updateMemberMilestones(member.id, (current) => [
                                    ...current,
                                    {
                                      id: createMilestoneId(),
                                      kind: "custom",
                                      label: membersText("milestoneCustomDefault"),
                                      applyScope: { scope: "all" },
                                    },
                                  ])
                                }
                              >
                                {membersText("addMilestone")}
                              </Button>
                            </Group>
                            <Text size="xs" c="dimmed">
                              {membersText("milestonesHelper")}
                            </Text>
                            {member.birthMonth && (
                              <Card withBorder radius="md" padding="sm">
                                <Group justify="space-between" align="center">
                                  <Text fw={500}>{membersText("milestoneBirth")}</Text>
                                  <Text size="sm" c="dimmed">
                                    {member.birthMonth}
                                  </Text>
                                </Group>
                              </Card>
                            )}
                            {(member.milestones ?? [])
                              .filter((milestone) => milestone.kind !== "birth")
                              .map((milestone) => {
                                const milestoneKey = `${member.id}:${milestone.id}`;
                                const monthInput =
                                  milestoneMonthInputs[milestoneKey] ??
                                  milestone.month ??
                                  "";
                                const monthError =
                                  milestoneMonthErrors[milestoneKey] ?? undefined;
                                return (
                                  <Card
                                    key={milestone.id}
                                    withBorder
                                    radius="md"
                                    padding="sm"
                                  >
                                    <Stack gap="sm">
                                      <Group justify="space-between" align="center">
                                        <Text fw={500}>
                                          {membersText(
                                            `milestoneKind.${milestone.kind}`
                                          )}
                                        </Text>
                                        <Button
                                          size="xs"
                                          variant="light"
                                          color="red"
                                          onClick={() =>
                                            updateMemberMilestones(member.id, (current) =>
                                              current.filter(
                                                (entry) => entry.id !== milestone.id
                                              )
                                            )
                                          }
                                        >
                                          {membersText("removeMilestone")}
                                        </Button>
                                      </Group>
                                      <TextInput
                                        label={membersText("milestoneLabel")}
                                        value={milestone.label}
                                        onChange={(event) =>
                                          updateMemberMilestones(member.id, (current) =>
                                            current.map((entry) =>
                                              entry.id === milestone.id
                                                ? {
                                                    ...entry,
                                                    label: event.currentTarget.value,
                                                  }
                                                : entry
                                            )
                                          )
                                        }
                                      />
                                      <Group grow>
                                        <NumberInput
                                          label={membersText("milestoneAgeLabel")}
                                          value={milestone.atAgeYears ?? ""}
                                          min={0}
                                          step={0.5}
                                          decimalScale={2}
                                          onChange={(value) =>
                                            updateMemberMilestones(member.id, (current) =>
                                              current.map((entry) =>
                                                entry.id === milestone.id
                                                  ? {
                                                      ...entry,
                                                      atAgeYears:
                                                        typeof value === "number"
                                                          ? value
                                                          : undefined,
                                                      month:
                                                        typeof value === "number"
                                                          ? undefined
                                                          : entry.month,
                                                    }
                                                  : entry
                                              )
                                            )
                                          }
                                        />
                                        <TextInput
                                          label={membersText("milestoneMonthLabel")}
                                          placeholder={common("yearMonthPlaceholder")}
                                          value={monthInput}
                                          error={monthError}
                                          onChange={(event) => {
                                            const nextValue = event.currentTarget.value;
                                            setMilestoneMonthInputs((current) => ({
                                              ...current,
                                              [milestoneKey]: nextValue,
                                            }));
                                            setMilestoneMonthErrors((current) => ({
                                              ...current,
                                              [milestoneKey]: null,
                                            }));
                                          }}
                                          onBlur={() => {
                                            const trimmed = monthInput.trim();
                                            if (trimmed === "") {
                                              updateMemberMilestones(
                                                member.id,
                                                (current) =>
                                                  current.map((entry) =>
                                                    entry.id === milestone.id
                                                      ? {
                                                          ...entry,
                                                          month: undefined,
                                                        }
                                                      : entry
                                                  )
                                              );
                                              setMilestoneMonthErrors((current) => ({
                                                ...current,
                                                [milestoneKey]: null,
                                              }));
                                              setMilestoneMonthInputs((current) => ({
                                                ...current,
                                                [milestoneKey]: "",
                                              }));
                                              return;
                                            }
                                            const normalized =
                                              normalizeMonthStrict(trimmed);
                                            if (!normalized.ok) {
                                              setMilestoneMonthErrors((current) => ({
                                                ...current,
                                                [milestoneKey]:
                                                  validation("useYearMonth"),
                                              }));
                                              return;
                                            }
                                            updateMemberMilestones(
                                              member.id,
                                              (current) =>
                                                current.map((entry) =>
                                                  entry.id === milestone.id
                                                    ? {
                                                        ...entry,
                                                        month: normalized.month,
                                                        atAgeYears: undefined,
                                                      }
                                                    : entry
                                                )
                                            );
                                            setMilestoneMonthErrors((current) => ({
                                              ...current,
                                              [milestoneKey]: null,
                                            }));
                                            setMilestoneMonthInputs((current) => ({
                                              ...current,
                                              [milestoneKey]: normalized.month,
                                            }));
                                          }}
                                        />
                                      </Group>
                                      <Stack gap="xs">
                                        <Text fw={500}>
                                          {membersText("milestoneApplyScope")}
                                        </Text>
                                        {renderApplyScope(
                                          normalizeApplyScope(milestone.applyScope),
                                          (next) =>
                                            updateMemberMilestones(
                                              member.id,
                                              (current) =>
                                                current.map((entry) =>
                                                  entry.id === milestone.id
                                                    ? { ...entry, applyScope: next }
                                                    : entry
                                                )
                                            )
                                        )}
                                      </Stack>
                                    </Stack>
                                  </Card>
                                );
                              })}
                          </Stack>
                        </Stack>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="budget" pt="md">
          <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{budgetText("title")}</Text>
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                const nextRule = {
                  id: createBudgetRuleId(),
                  name: budgetText("defaultRuleName", {
                    index: budgetRules.length + 1,
                  }),
                  enabled: true,
                  memberId: members[0]?.id,
                  category: "health" as const,
                  ageBand: { fromYears: 0, toYears: 3 },
                  monthlyAmount: 0,
                  applyScope: { scope: "all" } as ApplyScope,
                };
                createBudgetRule(nextRule);
                showToast(common("saved"), "teal");
              }}
            >
              {budgetText("addRule")}
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {budgetText("subtitle")}
          </Text>
          <Switch
            checked={includeBudgetRulesInProjection}
            label={budgetText("includeInProjection")}
            onChange={(event) =>
              updateScenarioAssumptions(scenario.id, {
                includeBudgetRulesInProjection: event.currentTarget.checked,
              })
            }
          />
          {includeBudgetRulesInProjection && (
            <Notification color="yellow" withCloseButton={false}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Text size="sm">{budgetText("projectionWarning")}</Text>
                {hasExpenseEvents && (
                  <Badge color="yellow" variant="light">
                    {budgetText("projectionWarningBadge")}
                  </Badge>
                )}
              </Group>
            </Notification>
          )}
          {hasHousingRules && (
            <Notification color="red" withCloseButton={false}>
              <Text size="sm">{budgetText("housingWarning")}</Text>
            </Notification>
          )}
          {budgetRules.length === 0 ? (
            <Text size="sm" c="dimmed">
              {budgetText("empty")}
            </Text>
          ) : (
            <Stack gap="sm">
              {budgetRules.map((rule) => {
                const preview = budgetRulePreviews.get(rule.id) ?? [];
                const previewSlice = preview.slice(0, 12);
                const previewTotal = preview.reduce(
                  (total, entry) => total + entry.amount,
                  0
                );

                return (
                  <Card key={rule.id} withBorder radius="md" padding="md">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text fw={600}>{rule.name}</Text>
                        <Group gap="sm">
                          <Switch
                            checked={rule.enabled}
                            label={budgetText("enabledLabel")}
                            onChange={(event) =>
                              updateBudgetRule(rule.id, {
                                enabled: event.currentTarget.checked,
                              })
                            }
                          />
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() => {
                              removeBudgetRule(rule.id);
                              showToast(common("saved"), "teal");
                            }}
                          >
                            {budgetText("removeRule")}
                          </Button>
                        </Group>
                      </Group>
                      <Group grow>
                        <TextInput
                          label={budgetText("nameLabel")}
                          value={rule.name}
                          onChange={(event) =>
                            updateBudgetRule(rule.id, {
                              name: event.currentTarget.value,
                            })
                          }
                        />
                        <Select
                          label={budgetText("memberLabel")}
                          data={[
                            { value: "household", label: budgetText("memberHousehold") },
                            ...members.map((member) => ({
                              value: member.id,
                              label: member.name,
                            })),
                          ]}
                          value={rule.memberId ?? "household"}
                          onChange={(value) =>
                            updateBudgetRule(rule.id, {
                              memberId:
                                value && value !== "household" ? value : undefined,
                            })
                          }
                        />
                      </Group>
                      <Group grow>
                        <Select
                          label={budgetText("categoryLabel")}
                          data={[
                            { value: "health", label: budgetText("categoryHealth") },
                            {
                              value: "childcare",
                              label: budgetText("categoryChildcare"),
                            },
                            {
                              value: "education",
                              label: budgetText("categoryEducation"),
                            },
                            {
                              value: "eldercare",
                              label: budgetText("categoryEldercare"),
                            },
                            { value: "petcare", label: budgetText("categoryPetcare") },
                          ]}
                          value={rule.category}
                          onChange={(value) => {
                            if (!value) {
                              return;
                            }
                            updateBudgetRule(rule.id, {
                              category: value as typeof rule.category,
                            });
                          }}
                        />
                        <NumberInput
                          label={budgetText("monthlyAmountLabel")}
                          value={rule.monthlyAmount}
                          min={0}
                          step={100}
                          thousandSeparator=","
                          onChange={(value) =>
                            updateBudgetRule(rule.id, {
                              monthlyAmount: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                      </Group>
                      <Group grow>
                        <NumberInput
                          label={budgetText("ageFromLabel")}
                          value={rule.ageBand.fromYears}
                          min={0}
                          step={0.5}
                          decimalScale={2}
                          onChange={(value) =>
                            updateBudgetRule(rule.id, {
                              ageBand: {
                                ...rule.ageBand,
                                fromYears: typeof value === "number" ? value : 0,
                              },
                            })
                          }
                        />
                        <NumberInput
                          label={budgetText("ageToLabel")}
                          value={rule.ageBand.toYears}
                          min={0}
                          step={0.5}
                          decimalScale={2}
                          onChange={(value) =>
                            updateBudgetRule(rule.id, {
                              ageBand: {
                                ...rule.ageBand,
                                toYears: typeof value === "number" ? value : 0,
                              },
                            })
                          }
                        />
                      </Group>
                      <Text size="xs" c="dimmed">
                        {budgetText("ageBandHelper")}
                      </Text>
                      <Group grow>
                        <NumberInput
                          label={budgetText("annualGrowthLabel")}
                          value={rule.annualGrowthPct ?? ""}
                          min={0}
                          step={0.1}
                          decimalScale={2}
                          onChange={(value) =>
                            updateBudgetRule(rule.id, {
                              annualGrowthPct:
                                typeof value === "number" ? value : undefined,
                            })
                          }
                        />
                        <TextInput
                          label={budgetText("startMonthLabel")}
                          placeholder={common("yearMonthOptionalPlaceholder")}
                          value={
                            budgetMonthInputs[rule.id]?.startMonth ??
                            rule.startMonth ??
                            ""
                          }
                          onChange={(event) =>
                            updateBudgetMonthInput(
                              rule.id,
                              "startMonth",
                              event.currentTarget.value
                            )
                          }
                          onBlur={() => validateBudgetMonth(rule.id, "startMonth")}
                          error={budgetMonthErrors[rule.id]?.startMonth}
                        />
                        <TextInput
                          label={budgetText("endMonthLabel")}
                          placeholder={common("yearMonthOptionalPlaceholder")}
                          value={
                            budgetMonthInputs[rule.id]?.endMonth ?? rule.endMonth ?? ""
                          }
                          onChange={(event) =>
                            updateBudgetMonthInput(
                              rule.id,
                              "endMonth",
                              event.currentTarget.value
                            )
                          }
                          onBlur={() => validateBudgetMonth(rule.id, "endMonth")}
                          error={budgetMonthErrors[rule.id]?.endMonth}
                        />
                      </Group>
                      <Stack gap="xs">
                        <Text fw={600}>{budgetText("applyScopeTitle")}</Text>
                        <Text size="xs" c="dimmed">
                          {budgetText("applyScopeHelper")}
                        </Text>
                        {renderApplyScope(
                          normalizeApplyScope(rule.applyScope),
                          (next) => updateBudgetRule(rule.id, { applyScope: next }),
                          budgetText("applyScopeHint")
                        )}
                      </Stack>
                      <Stack gap={4}>
                        <Group justify="space-between" align="center">
                          <Text fw={600} size="sm">
                            {budgetText("previewTitle")}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {budgetText("previewTotal", {
                              total: formatCurrency(previewTotal),
                            })}
                          </Text>
                        </Group>
                        {previewSlice.length === 0 ? (
                          <Text size="sm" c="dimmed">
                            {budgetText("previewEmpty")}
                          </Text>
                        ) : (
                          <Stack gap={2}>
                            {previewSlice.map((entry) => (
                              <Text key={`${rule.id}-${entry.month}`} size="sm">
                                {entry.month} · {formatCurrency(entry.amount)}
                              </Text>
                            ))}
                            {preview.length > previewSlice.length && (
                              <Text size="xs" c="dimmed">
                                {budgetText("previewMore", {
                                  count: preview.length - previewSlice.length,
                                })}
                              </Text>
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="other" pt="md">
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <NumberInput
                label={t("initialCash")}
                value={assumptions.initialCash}
                min={0}
                step={1000}
                thousandSeparator=","
                onChange={(value) => {
                  if (typeof value === "number") {
                    handleAssumptionChange({ initialCash: value });
                  }
                }}
              />

              <Group grow>
                <NumberInput
                  label={t("inflationRate")}
                  value={assumptions.inflationRate ?? ""}
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  onChange={(value) =>
                    handleAssumptionChange({
                      inflationRate: typeof value === "number" ? value : undefined,
                    })
                  }
                />
                <NumberInput
                  label={t("salaryGrowth")}
                  value={assumptions.salaryGrowthRate ?? ""}
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  onChange={(value) =>
                    handleAssumptionChange({
                      salaryGrowthRate: typeof value === "number" ? value : undefined,
                    })
                  }
                />
              </Group>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>{t("emergencyFundTarget")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("emergencyFundValue", {
                      months: assumptions.emergencyFundMonths ?? 6,
                    })}
                  </Text>
                </Group>
                <Slider
                  min={3}
                  max={12}
                  step={1}
                  value={assumptions.emergencyFundMonths ?? 6}
                  onChange={(value) =>
                    handleAssumptionChange({ emergencyFundMonths: value })
                  }
                />
              </Stack>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Group>
        <Button component={Link} href={buildScenarioUrl("/overview", scenario.id)}>
          {common("openOverview")}
        </Button>
        <Button
          component={Link}
          href={buildScenarioUrl("/timeline", scenario.id)}
          variant="light"
        >
          {common("openTimeline")}
        </Button>
      </Group>
    </Stack>
  );
}
