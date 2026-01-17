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
  Select,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "../../../src/store/scenarioStore";
import { useSettingsStore } from "../../../src/store/settingsStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";
import { buildMonthRange } from "@north-star/engine";
import { getMemberAgeYears } from "../../../src/domain/members/age";
// import { isValidMonthStr } from "../../../src/utils/month";
import {
  compileBudgetRuleToMonthlySeries,
  type BudgetRuleMonthlyEntry,
} from "../../../src/domain/budget/compileBudgetRules";
import DataManagementSection from "../../../components/DataManagementSection";
import { buildScenarioTimelineEvents } from "../../../src/domain/events/utils";
import { getEventMeta } from "../../../src/events/eventCatalog";

type SettingsClientProps = {
  scenarioId?: string;
};

type ToastState = {
  message: string;
  color?: string;
};

const isValidBaseMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);
const isHousingCategory = (category: string) => category === "housing";

export default function SettingsClient({ scenarioId }: SettingsClientProps) {
  const locale = useLocale();
  const t = useTranslations("assumptions");
  const membersText = useTranslations("members");
  const budgetText = useTranslations("budgetRules");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
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
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const addScenarioMember = useScenarioStore((state) => state.addScenarioMember);
  const updateScenarioMember = useScenarioStore(
    (state) => state.updateScenarioMember
  );
  const removeScenarioMember = useScenarioStore(
    (state) => state.removeScenarioMember
  );
  const addBudgetRule = useScenarioStore((state) => state.addBudgetRule);
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
  const hasExpenseEvents = useMemo(() => {
    if (!scenario) {
      return false;
    }
    const events = buildScenarioTimelineEvents(scenario, eventLibrary);
    return events.some(
      (event) => event.enabled && getEventMeta(event.type).group === "expense"
    );
  }, [eventLibrary, scenario]);

  useEffect(() => {
    if (!scenario) {
      return;
    }
    setBaseMonthInput(scenario.assumptions.baseMonth ?? "");
  }, [scenario]);

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
  const members = scenario.members ?? [];
  const budgetRules = scenario.budgetRules ?? [];
  const hasHousingRules = budgetRules.some((rule) => isHousingCategory(rule.category));
  const horizonValue = horizonOptions.some(
    (option) => Number(option.value) === assumptions.horizonMonths
  )
    ? String(assumptions.horizonMonths)
    : "240";
  const horizonEndMonth =
    assumptions.baseMonth && assumptions.horizonMonths > 0
      ? buildMonthRange(assumptions.baseMonth, assumptions.horizonMonths).at(-1) ??
        null
      : null;
  const formatAgeYears = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  const formatCurrency = (value: number) => {
    if (!scenario.baseCurrency) {
      return value.toLocaleString(locale);
    }
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: scenario.baseCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  };
  const buildZeroPreview = (rule: (typeof budgetRules)[number]): BudgetRuleMonthlyEntry[] => {
    if (!assumptions.baseMonth || assumptions.horizonMonths <= 0) {
      return [];
    }
    return buildMonthRange(assumptions.baseMonth, assumptions.horizonMonths).map(
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
        ? compileBudgetRuleToMonthlySeries(rule, scenario)
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

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={6}>
            <Text fw={600}>{t("planningHorizon")}</Text>
            <SegmentedControl
              data={horizonOptions}
              value={horizonValue}
              onChange={(value) =>
                handleAssumptionChange({ horizonMonths: Number(value) })
              }
            />
          </Stack>

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

          <Stack gap={6}>
            <TextInput
              label={t("baseMonth")}
              placeholder={common("yearMonthPlaceholder")}
              value={baseMonthInput}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setBaseMonthInput(nextValue);
                if (nextValue.trim() === "") {
                  handleAssumptionChange({ baseMonth: null });
                } else if (isValidBaseMonth(nextValue)) {
                  handleAssumptionChange({ baseMonth: nextValue });
                }
              }}
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
                  handleAssumptionChange({ baseMonth: null });
                }}
              >
                {common("actionAuto")}
              </Button>
            </Group>
          </Stack>

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

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{membersText("title")}</Text>
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                addScenarioMember(scenario.id, {
                  id: createMemberId(),
                  name: membersText("defaultName"),
                  kind: "person",
                  ageAtBaseMonth: 0,
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
            {members.map((member, index) => {
              const hasBirthMonth =
                typeof member.birthMonth === "string" &&
                isValidBaseMonth(member.birthMonth);
              const hasAgeAtBase = typeof member.ageAtBaseMonth === "number";
              const baseMonthValue = assumptions.baseMonth;
              const validBaseMonth =
                baseMonthValue && isValidBaseMonth(baseMonthValue)
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
                          removeScenarioMember(scenario.id, member.id);
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
                          updateScenarioMember(scenario.id, member.id, {
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
                          updateScenarioMember(scenario.id, member.id, {
                            kind: value as typeof member.kind,
                          });
                        }}
                      />
                    </Group>
                    <Group grow>
                      <TextInput
                        label={membersText("birthMonthLabel")}
                        placeholder={common("yearMonthPlaceholder")}
                        value={member.birthMonth ?? ""}
                        type="month"
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value.trim();
                          updateScenarioMember(scenario.id, member.id, {
                            birthMonth: nextValue === "" ? undefined : nextValue,
                          });
                        }}
                      />
                      <NumberInput
                        label={membersText("ageAtBaseLabel")}
                        value={member.ageAtBaseMonth ?? ""}
                        min={0}
                        step={0.5}
                        decimalScale={2}
                        onChange={(value) =>
                          updateScenarioMember(scenario.id, member.id, {
                            ageAtBaseMonth: typeof value === "number" ? value : undefined,
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
                        {baseAge === null ? t("notAvailable") : formatAgeYears(baseAge)}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {membersText("endAgeLabel")}:{" "}
                        {endAge === null ? t("notAvailable") : formatAgeYears(endAge)}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </Card>

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
                };
                addBudgetRule(scenario.id, nextRule);
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
                              updateBudgetRule(scenario.id, rule.id, {
                                enabled: event.currentTarget.checked,
                              })
                            }
                          />
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() => {
                              removeBudgetRule(scenario.id, rule.id);
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
                            updateBudgetRule(scenario.id, rule.id, {
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
                            updateBudgetRule(scenario.id, rule.id, {
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
                            updateBudgetRule(scenario.id, rule.id, {
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
                            updateBudgetRule(scenario.id, rule.id, {
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
                            updateBudgetRule(scenario.id, rule.id, {
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
                            updateBudgetRule(scenario.id, rule.id, {
                              ageBand: {
                                ...rule.ageBand,
                                toYears: typeof value === "number" ? value : 0,
                              },
                            })
                          }
                        />
                      </Group>
                      <Group grow>
                        <NumberInput
                          label={budgetText("annualGrowthLabel")}
                          value={rule.annualGrowthPct ?? ""}
                          min={0}
                          step={0.1}
                          decimalScale={2}
                          onChange={(value) =>
                            updateBudgetRule(scenario.id, rule.id, {
                              annualGrowthPct:
                                typeof value === "number" ? value : undefined,
                            })
                          }
                        />
                        <TextInput
                          label={budgetText("startMonthLabel")}
                          placeholder={common("yearMonthOptionalPlaceholder")}
                          value={rule.startMonth ?? ""}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value.trim();
                            if (nextValue === "" || isValidBaseMonth(nextValue)) {
                              updateBudgetRule(scenario.id, rule.id, {
                                startMonth: nextValue === "" ? undefined : nextValue,
                              });
                            }
                          }}
                        />
                        <TextInput
                          label={budgetText("endMonthLabel")}
                          placeholder={common("yearMonthOptionalPlaceholder")}
                          value={rule.endMonth ?? ""}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value.trim();
                            if (nextValue === "" || isValidBaseMonth(nextValue)) {
                              updateBudgetRule(scenario.id, rule.id, {
                                endMonth: nextValue === "" ? undefined : nextValue,
                              });
                            }
                          }}
                        />
                      </Group>
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
