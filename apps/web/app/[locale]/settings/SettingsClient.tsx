"use client";

import {
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Notification,
  NumberInput,
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
} from "../../../src/store/scenarioStore";
import { useSettingsStore } from "../../../src/store/settingsStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";

type SettingsClientProps = {
  scenarioId?: string;
};

type ToastState = {
  message: string;
  color?: string;
};

const isValidBaseMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);

export default function SettingsClient({ scenarioId }: SettingsClientProps) {
  const locale = useLocale();
  const t = useTranslations("assumptions");
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
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
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
    return null;
  }

  const { assumptions } = scenario;
  const horizonValue = horizonOptions.some(
    (option) => Number(option.value) === assumptions.horizonMonths
  )
    ? String(assumptions.horizonMonths)
    : "240";

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
