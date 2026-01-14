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
import Link from "next/link";
import { signInWithGoogle, signOutUser } from "../../lib/authActions";
import { isFirebaseConfigured } from "../../lib/firebaseClient";
import {
  downloadCloudStateToLocal,
  fetchCloudSummary,
  requiresSchemaUpgrade,
  uploadLocalStateToCloud,
  type CloudSummary,
} from "../../lib/sync/firestoreSync";
import { useAuthState } from "../../src/hooks/useAuthState";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { useSettingsStore } from "../../src/store/settingsStore";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";

type SettingsClientProps = {
  scenarioId?: string;
};

type ToastState = {
  message: string;
  color?: string;
};

const horizonOptions = [
  { value: "120", label: "10y" },
  { value: "240", label: "20y" },
  { value: "360", label: "30y" },
];

const baseMonthHelper = "Leave empty to auto-use the earliest event start month.";

const isValidBaseMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);

export default function SettingsClient({ scenarioId }: SettingsClientProps) {
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
              : "Unable to load cloud sync status."
          );
        }
      }
    };

    void loadCloudSummary();

    return () => {
      active = false;
    };
  }, [authState.status, authState.user]);

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
      ? "Auto-sync: On"
      : "Auto-sync: Off"
    : "Auto-sync: Sign in to enable";
  const autoSyncDetails = isSignedIn && autoSyncEnabled
    ? isOnline
      ? lastAutoSyncAt
        ? `Last sync: ${new Date(lastAutoSyncAt).toLocaleString()}`
        : "Last sync: not yet"
      : "Offline: changes saved locally and will sync when online."
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
      setSyncError("App update required before syncing.");
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
        `Uploaded ${result.scenarioCount} scenarios to cloud.`,
        "teal"
      );
      await refreshCloudSummary();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Upload failed. Try again."
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
      setSyncError("App update required before syncing.");
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
        `Replaced local data with ${result.scenarioCount} cloud scenarios.`,
        "teal"
      );
      await refreshCloudSummary();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Download failed. Try again."
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
    showToast("Saved", "teal");
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

  const syncStatusLabel = isSignedIn
    ? `Signed in · ${
        cloudSummary?.lastSyncedAt
          ? `Last synced: ${new Date(cloudSummary.lastSyncedAt).toLocaleString()}`
          : "Not synced yet"
      }`
    : "Local mode · Data stored on this device";

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Settings</Title>
        <Text c="dimmed" size="sm">
          Customize assumptions for {scenario.name}.
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
            <Text fw={600}>Sync & Account</Text>
            <Text size="xs" c="dimmed">
              {syncStatusLabel}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            Local-first planning keeps your data on this device. Sign in only if
            you want to back up or sync across devices.
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
              Firebase is not configured yet. Add environment variables to enable
              sign-in and cloud sync.
            </Notification>
          )}

          {schemaUpgradeRequired && (
            <Notification color="yellow">
              App update required before syncing.
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
                        : "Sign-in failed. Try again."
                    );
                  }
                }}
                disabled={!isFirebaseConfigured}
              >
                Sign in to sync
              </Button>
              <Text size="xs" c="dimmed">
                You can keep using the app without signing in.
              </Text>
            </Group>
          )}

          <Stack gap="sm">
            {hasConflict && (
              <Notification color="orange">
                Cloud data already exists. Choose which data to keep before
                syncing.
              </Notification>
            )}
            <Stack gap={4}>
              <Switch
                label="Auto-sync when signed in"
                checked={autoSyncEnabled}
                disabled={!isSignedIn}
                onChange={(event) =>
                  setAutoSyncEnabled(event.currentTarget.checked)
                }
                description="Uses last-write-wins at the scenario level (newer updatedAt wins; revision breaks ties)."
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
                    Upload local data to cloud
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={() => void handleDownload()}
                    loading={syncingAction === "download"}
                    disabled={schemaUpgradeRequired}
                  >
                    Replace local data with cloud data
                  </Button>
                </Group>
                <Divider />
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Signed in as {authState.user?.email ?? "Google user"}.
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={async () => {
                      await signOutUser();
                      setCloudSummary(null);
                    }}
                  >
                    Sign out
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
        title="Resolve sync conflict"
        centered
      >
        <Stack>
          <Text size="sm">
            Both local and cloud data exist. Choose which data source to keep.
          </Text>
          <Group grow>
            <Button
              onClick={async () => {
                setConflictModalOpen(false);
                await handleUpload(true);
              }}
            >
              Use local data
            </Button>
            <Button
              variant="light"
              onClick={async () => {
                setConflictModalOpen(false);
                await handleDownload(true);
              }}
            >
              Use cloud data
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={6}>
            <Text fw={600}>Planning horizon</Text>
            <SegmentedControl
              data={horizonOptions}
              value={horizonValue}
              onChange={(value) =>
                handleAssumptionChange({ horizonMonths: Number(value) })
              }
            />
          </Stack>

          <NumberInput
            label="Initial cash"
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
              label="Base month"
              placeholder="YYYY-MM"
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
                Auto
              </Button>
            </Group>
          </Stack>

          <Group grow>
            <NumberInput
              label="Inflation rate (%)"
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
              label="Salary growth (%)"
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
              <Text fw={600}>Emergency fund target</Text>
              <Text size="sm" c="dimmed">
                {assumptions.emergencyFundMonths ?? 6} months
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
          Open Overview
        </Button>
        <Button
          component={Link}
          href={buildScenarioUrl("/timeline", scenario.id)}
          variant="light"
        >
          Open Timeline
        </Button>
      </Group>
    </Stack>
  );
}
