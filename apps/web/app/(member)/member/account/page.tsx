"use client";

import { Button, Card, Container, Group, Notification, Stack, Tabs, Text, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import DataManagementSection from "../../../../components/DataManagementSection";
import { signInWithGoogle, signOutUser } from "../../../../lib/authActions";
import { isFirebaseConfigured } from "../../../../lib/firebaseClient";
import {
  downloadCloudStateToLocal,
  fetchCloudSummary,
  requiresSchemaUpgrade,
  uploadLocalStateToCloud,
  type CloudSummary,
} from "../../../../lib/sync/firestoreSync";
import { useAuthState } from "../../../../src/hooks/useAuthState";
import { useSettingsStore } from "../../../../src/store/settingsStore";

const sectionValues = ["profile", "security", "connected", "data", "billing"] as const;

export default function MemberAccountPage() {
  const t = useTranslations("member.account");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const authState = useAuthState();
  const autoSyncEnabled = useSettingsStore((state) => state.autoSyncEnabled);
  const setAutoSyncEnabled = useSettingsStore((state) => state.setAutoSyncEnabled);

  const [cloudSummary, setCloudSummary] = useState<CloudSummary | null>(null);
  const [syncingAction, setSyncingAction] = useState<null | "upload" | "download">(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isSignedIn = authState.status === "signed-in" && authState.user;
  const schemaUpgradeRequired = requiresSchemaUpgrade(cloudSummary);

  useEffect(() => {
    let mounted = true;
    const loadSummary = async () => {
      if (!isSignedIn) {
        setCloudSummary(null);
        return;
      }
      try {
        const uid = authState.user?.uid;
        if (!uid) return;
        const summary = await fetchCloudSummary(uid);
        if (mounted) {
          setCloudSummary(summary);
          setSyncError(null);
        }
      } catch (error) {
        if (mounted) {
          setSyncError(error instanceof Error ? error.message : errors("syncStatusLoadFailed"));
        }
      }
    };
    void loadSummary();
    return () => {
      mounted = false;
    };
  }, [authState.user, errors, isSignedIn]);

  const sections = sectionValues.map((value) => ({
    value,
    label: t(`tabs.${value}`),
    description: t(`sections.${value}.description`),
  }));

  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed">{t("subtitle")}</Text>
        </div>

        <Tabs defaultValue="profile" keepMounted={false}>
          <Tabs.List>
            {sections.map((section) => (
              <Tabs.Tab key={section.value} value={section.value}>
                {section.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {sections.map((section) => (
            <Tabs.Panel key={section.value} value={section.value} pt="md">
              <Card withBorder radius="md" p="lg">
                <Stack gap="sm">
                  <Text fw={600}>{section.label}</Text>
                  <Text size="sm" c="dimmed">
                    {section.description}
                  </Text>

                  {section.value === "profile" ? (
                    <Text size="sm">{t("profile.signedInAs", { email: authState.user?.email ?? "member@example.com" })}</Text>
                  ) : null}

                  {section.value === "connected" ? (
                    <>
                      {syncError ? <Notification color="red">{syncError}</Notification> : null}
                      {!isFirebaseConfigured && !isSignedIn ? (
                        <Notification color="yellow">{common("firebaseNotConfigured")}</Notification>
                      ) : null}
                      {schemaUpgradeRequired ? (
                        <Notification color="yellow">{errors("syncUpgradeRequired")}</Notification>
                      ) : null}
                      {!isSignedIn ? (
                        <Button
                          variant="light"
                          onClick={async () => {
                            try {
                              await signInWithGoogle();
                            } catch (error) {
                              setSyncError(error instanceof Error ? error.message : errors("signInFailed"));
                            }
                          }}
                          disabled={!isFirebaseConfigured}
                        >
                          {common("signInToSync")}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="light"
                            onClick={async () => {
                              setSyncingAction("upload");
                              try {
                                const uid = authState.user?.uid;
                                if (!uid) return;
                                await uploadLocalStateToCloud(uid);
                              } finally {
                                setSyncingAction(null);
                              }
                            }}
                            loading={syncingAction === "upload"}
                          >
                            {common("uploadLocalToCloud")}
                          </Button>
                          <Button
                            variant="light"
                            onClick={async () => {
                              setSyncingAction("download");
                              try {
                                const uid = authState.user?.uid;
                                if (!uid) return;
                                await downloadCloudStateToLocal(uid);
                              } finally {
                                setSyncingAction(null);
                              }
                            }}
                            loading={syncingAction === "download"}
                          >
                            {common("downloadCloudToLocal")}
                          </Button>
                          <Button variant="subtle" onClick={async () => signOutUser()}>
                            {common("signOut")}
                          </Button>
                        </>
                      )}
                      <Text size="xs" c="dimmed">
                        {isSignedIn
                          ? common("lastSyncAt", {
                              time: cloudSummary?.lastSyncedAt
                                ? new Date(cloudSummary.lastSyncedAt).toLocaleString(locale)
                                : common("notSyncedYet"),
                            })
                          : common("localModeStatus")}
                      </Text>
                      <Button
                        variant="default"
                        onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                        disabled={!isSignedIn}
                      >
                        {autoSyncEnabled ? common("autoSyncOff") : common("autoSyncOn")}
                      </Button>
                    </>
                  ) : null}

                  {section.value === "data" ? (
                    <DataManagementSection onNotify={() => undefined} />
                  ) : null}

                  <Group>
                    {section.value === "security" ? (
                      <Button variant="light" color="red">
                        {t("security.logout")}
                      </Button>
                    ) : section.value === "connected" || section.value === "data" ? null : (
                      <Button variant="light">{t("common.comingSoon")}</Button>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
