"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultCurrency } from "../../../lib/i18n";
import MonthField from "../../../components/MonthField";
import { getCurrentMonth } from "./utils";
import { normalizeMonthStrict } from "../../utils/month";
import { isValidMonthKey } from "../../utils/monthKey";
import {
  getActiveScenario,
  useScenarioStore,
} from "../../store/scenarioStore";
import { buildScenarioUrl } from "../../utils/scenarioContext";
import OnboardingV2WizardShell from "./v2/OnboardingV2WizardShell";
import {
  type OnboardingV2Draft,
  type OnboardingV2DraftMember,
  type OnboardingV2MemberRole,
  mapOnboardingV2DraftToScenario,
} from "../../domain/onboarding/v2/mapOnboardingV2DraftToScenario";

const steps = ["profile", "household", "result"] as const;

const DRAFT_STORAGE_KEY = "onboarding:v2:draft";

type HorizonYears = 3 | 5 | 10;

type DraftProfileState = {
  baseCurrency: string;
  startMonth: string;
  horizonYears: HorizonYears;
};

type DraftHouseholdState = {
  hasPartner: boolean;
  childCount: number;
  petCount: number;
  members: OnboardingV2DraftMember[];
};

type DraftStorageState = {
  step: number;
  profile: DraftProfileState;
  household: DraftHouseholdState;
};

const clampCount = (value: number | null | undefined) =>
  Math.max(0, Math.floor(value ?? 0));

const buildMember = (
  id: string,
  role: OnboardingV2MemberRole,
  existing?: OnboardingV2DraftMember
): OnboardingV2DraftMember => ({
  id,
  role,
  name: existing?.name ?? "",
  birthMonth: existing?.birthMonth ?? "",
});

const buildHouseholdMembers = ({
  hasPartner,
  childCount,
  petCount,
  existingMembers,
}: {
  hasPartner: boolean;
  childCount: number;
  petCount: number;
  existingMembers: OnboardingV2DraftMember[];
}): OnboardingV2DraftMember[] => {
  const existingById = new Map(
    existingMembers.map((member) => [member.id, member])
  );
  const members: OnboardingV2DraftMember[] = [];

  members.push(buildMember("self", "self", existingById.get("self")));

  if (hasPartner) {
    members.push(buildMember("partner", "partner", existingById.get("partner")));
  }

  for (let index = 1; index <= childCount; index += 1) {
    const id = `child-${index}`;
    members.push(buildMember(id, "child", existingById.get(id)));
  }

  for (let index = 1; index <= petCount; index += 1) {
    const id = `pet-${index}`;
    members.push(buildMember(id, "pet", existingById.get(id)));
  }

  return members;
};

const getInitialDraftState = ({
  baseCurrency,
}: {
  baseCurrency: string;
}): DraftStorageState => {
  const fallback: DraftStorageState = {
    step: 0,
    profile: {
      baseCurrency,
      startMonth: "",
      horizonYears: 5,
    },
    household: {
      hasPartner: false,
      childCount: 0,
      petCount: 0,
      members: buildHouseholdMembers({
        hasPartner: false,
        childCount: 0,
        petCount: 0,
        existingMembers: [],
      }),
    },
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    const parsed = JSON.parse(stored) as Partial<DraftStorageState>;
    const profile: DraftProfileState = {
      baseCurrency:
        parsed.profile?.baseCurrency?.trim() || fallback.profile.baseCurrency,
      startMonth: parsed.profile?.startMonth ?? fallback.profile.startMonth,
      horizonYears:
        parsed.profile?.horizonYears === 3 ||
        parsed.profile?.horizonYears === 5 ||
        parsed.profile?.horizonYears === 10
          ? parsed.profile.horizonYears
          : fallback.profile.horizonYears,
    };
    const household: DraftHouseholdState = {
      hasPartner: parsed.household?.hasPartner ?? fallback.household.hasPartner,
      childCount: clampCount(parsed.household?.childCount),
      petCount: clampCount(parsed.household?.petCount),
      members: buildHouseholdMembers({
        hasPartner: parsed.household?.hasPartner ?? false,
        childCount: clampCount(parsed.household?.childCount),
        petCount: clampCount(parsed.household?.petCount),
        existingMembers: parsed.household?.members ?? [],
      }),
    };

    return {
      step: typeof parsed.step === "number" ? parsed.step : fallback.step,
      profile,
      household,
    };
  } catch (error) {
    console.warn("Failed to parse onboarding draft state", error);
    return fallback;
  }
};

const getMemberLabel = (
  t: (key: string, values?: Record<string, number>) => string,
  member: OnboardingV2DraftMember
) => {
  if (member.role === "self") {
    return t("memberRoleSelf");
  }
  if (member.role === "partner") {
    return t("memberRolePartner");
  }
  if (member.role === "child") {
    const index = Number(member.id.split("-")[1] ?? 0);
    return t("memberRoleChild", { index });
  }
  const index = Number(member.id.split("-")[1] ?? 0);
  return t("memberRolePet", { index });
};

const normalizeHouseholdCounts = (
  current: DraftHouseholdState,
  patch: Partial<Pick<DraftHouseholdState, "hasPartner" | "childCount" | "petCount">>
): DraftHouseholdState => {
  const hasPartner = patch.hasPartner ?? current.hasPartner;
  const childCount =
    patch.childCount !== undefined ? clampCount(patch.childCount) : current.childCount;
  const petCount =
    patch.petCount !== undefined ? clampCount(patch.petCount) : current.petCount;

  return {
    hasPartner,
    childCount,
    petCount,
    members: buildHouseholdMembers({
      hasPartner,
      childCount,
      petCount,
      existingMembers: current.members,
    }),
  };
};

export default function OnboardingDraftWizard() {
  const t = useTranslations("onboardingDraft");
  const locale = useLocale();
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const membersStore = useScenarioStore((state) => state.members);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const updateScenarioClientComputed = useScenarioStore(
    (state) => state.updateScenarioClientComputed
  );
  const updateScenarioMeta = useScenarioStore((state) => state.updateScenarioMeta);
  const updateScenarioBaseCurrency = useScenarioStore(
    (state) => state.updateScenarioBaseCurrency
  );
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const deleteMember = useScenarioStore((state) => state.deleteMember);
  const scenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );
  const initialState = useMemo(
    () =>
      getInitialDraftState({
        baseCurrency: scenario?.baseCurrency ?? defaultCurrency,
      }),
    [scenario?.baseCurrency]
  );
  const [step, setStep] = useState(
    Math.min(initialState.step, steps.length - 1)
  );
  const [profile, setProfile] = useState<DraftProfileState>(
    initialState.profile
  );
  const [household, setHousehold] = useState<DraftHouseholdState>(
    initialState.household
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload: DraftStorageState = {
      step,
      profile,
      household,
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [household, profile, step]);

  const resolvedBaseMonth = useMemo(() => {
    const raw = appSettings.globalBaseMonth ?? getCurrentMonth();
    const normalized = normalizeMonthStrict(raw);
    return normalized.ok ? normalized.month : getCurrentMonth();
  }, [appSettings.globalBaseMonth]);

  const scenarioId = scenario?.id ?? "";
  const currencyOptions = useMemo(() => {
    const options = new Set(
      [
        profile.baseCurrency,
        scenario?.baseCurrency,
        defaultCurrency,
        "USD",
        "HKD",
        "CNY",
        "EUR",
        "GBP",
        "JPY",
        "SGD",
        "AUD",
      ].filter(Boolean)
    );

    return Array.from(options).map((value) => ({ value, label: value }));
  }, [profile.baseCurrency, scenario?.baseCurrency]);

  const selfMember = household.members.find((member) => member.id === "self");
  const selfBirthMonth = selfMember?.birthMonth ?? "";

  const profileErrors = {
    birthMonth: !selfBirthMonth
      ? t("requiredField")
      : isValidMonthKey(selfBirthMonth)
        ? ""
        : t("monthInvalid"),
    startMonth:
      profile.startMonth && !isValidMonthKey(profile.startMonth)
        ? t("monthInvalid")
        : "",
    baseCurrency: profile.baseCurrency.trim()
      ? ""
      : t("requiredField"),
  };

  const hasProfileError = Object.values(profileErrors).some((value) => value);

  const memberMonthErrors = household.members.reduce<Record<string, string>>(
    (acc, member) => {
      if (member.birthMonth && !isValidMonthKey(member.birthMonth)) {
        acc[member.id] = t("monthInvalid");
      }
      return acc;
    },
    {}
  );
  const hasMemberMonthErrors = Object.keys(memberMonthErrors).length > 0;

  const canProceed = !hasProfileError && !hasMemberMonthErrors;

  const draft = useMemo<OnboardingV2Draft>(
    () => ({
      profile,
      household: {
        members: household.members,
      },
    }),
    [household.members, profile]
  );

  const handleNext = () => {
    if (step === 0 && hasProfileError) {
      return;
    }
    if (step === 1 && hasMemberMonthErrors) {
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSave = () => {
    if (!scenarioId || !canProceed) {
      return;
    }

    const mapping = mapOnboardingV2DraftToScenario({
      draft,
      scenarioId,
      existingMembers: membersStore,
    });

    mapping.memberIdsToDelete.forEach((memberId) => {
      deleteMember(memberId);
    });

    mapping.membersToUpsert.forEach((member) => {
      const existing = membersStore.find((entry) => entry.id === member.id);
      if (existing) {
        updateMember(member.id, member);
      } else {
        createMember(member);
      }
    });

    if (mapping.settingsPatch.baseCurrency) {
      updateScenarioBaseCurrency(scenarioId, mapping.settingsPatch.baseCurrency);
    }

    if (typeof mapping.settingsPatch.horizonMonths === "number") {
      updateScenarioAssumptions(scenarioId, {
        horizonMonths: mapping.settingsPatch.horizonMonths,
      });
    }

    if (mapping.settingsPatch.startMonth) {
      updateScenarioAssumptions(scenarioId, {
        baseMonth: mapping.settingsPatch.startMonth,
      });
    }

    updateScenarioMeta(scenarioId, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    router.push(`/${locale}${buildScenarioUrl("/money", scenarioId)}`);
  };

  const handleLater = () => {
    if (!scenarioId) {
      return;
    }
    updateScenarioMeta(scenarioId, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    router.push(`/${locale}${buildScenarioUrl("/dashboard", scenarioId)}`);
  };

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text size="sm" c="dimmed">
          {t("subtitle")}
        </Text>
        <Group justify="space-between" wrap="wrap">
          <Text size="xs" c="dimmed">
            {t("baseMonthLabel", { month: resolvedBaseMonth })}
          </Text>
          <Badge color="orange" variant="light">
            {t("draftBadge")}
          </Badge>
        </Group>
      </Stack>

      <OnboardingV2WizardShell
        activeStep={step}
        onStepChange={setStep}
        steps={[
          {
            id: "profile",
            title: t("step.profile"),
            content: (
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Title order={4}>{t("profileTitle")}</Title>
                  <Text size="sm" c="dimmed">
                    {t("profileHint")}
                  </Text>
                  <MonthField
                    label={t("birthMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={selfBirthMonth}
                    error={profileErrors.birthMonth || undefined}
                    onChange={(value) =>
                      setHousehold((current) => ({
                        ...current,
                        members: current.members.map((member) =>
                          member.id === "self"
                            ? { ...member, birthMonth: value }
                            : member
                        ),
                      }))
                    }
                  />
                  <Select
                    label={t("baseCurrency")}
                    data={currencyOptions}
                    searchable
                    value={profile.baseCurrency}
                    error={profileErrors.baseCurrency || undefined}
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        baseCurrency: value ?? "",
                      }))
                    }
                  />
                  <SegmentedControl
                    value={String(profile.horizonYears)}
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        horizonYears: Number(value) as HorizonYears,
                      }))
                    }
                    data={[
                      { label: t("horizonYears3"), value: "3" },
                      { label: t("horizonYears5"), value: "5" },
                      { label: t("horizonYears10"), value: "10" },
                    ]}
                  />
                  <MonthField
                    label={t("startMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={profile.startMonth}
                    error={profileErrors.startMonth || undefined}
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        startMonth: value,
                      }))
                    }
                  />
                  <Text size="xs" c="dimmed">
                    {t("startMonthHint")}
                  </Text>
                </Stack>
              </Card>
            ),
          },
          {
            id: "household",
            title: t("step.household"),
            content: (
              <Stack gap="md">
                <Card withBorder radius="md" padding="md">
                  <Stack gap="md">
                    <Title order={4}>{t("householdTitle")}</Title>
                    <Text size="sm" c="dimmed">
                      {t("householdHint")}
                    </Text>
                    <Switch
                      label={t("includePartner")}
                      checked={household.hasPartner}
                      onChange={(event) =>
                        setHousehold((current) =>
                          normalizeHouseholdCounts(current, {
                            hasPartner: event.currentTarget.checked,
                          })
                        )
                      }
                    />
                    <Group grow align="flex-start">
                      <NumberInput
                        label={t("childrenCount")}
                        min={0}
                        value={household.childCount}
                        onChange={(value) =>
                          setHousehold((current) =>
                            normalizeHouseholdCounts(current, {
                              childCount: typeof value === "number" ? value : 0,
                            })
                          )
                        }
                      />
                      <NumberInput
                        label={t("petsCount")}
                        min={0}
                        value={household.petCount}
                        onChange={(value) =>
                          setHousehold((current) =>
                            normalizeHouseholdCounts(current, {
                              petCount: typeof value === "number" ? value : 0,
                            })
                          )
                        }
                      />
                    </Group>
                  </Stack>
                </Card>

                <Card withBorder radius="md" padding="md">
                  <Stack gap="md">
                    <Title order={5}>{t("memberListTitle")}</Title>
                    <Text size="sm" c="dimmed">
                      {t("memberListHint")}
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      {household.members.map((member) => (
                        <Card key={member.id} withBorder radius="md" padding="md">
                          <Stack gap="sm">
                            <Text fw={600}>{getMemberLabel(t, member)}</Text>
                            <TextInput
                              label={t("memberName")}
                              placeholder={t("memberNamePlaceholder")}
                              value={member.name}
                              onChange={(event) =>
                                setHousehold((current) => ({
                                  ...current,
                                  members: current.members.map((entry) =>
                                    entry.id === member.id
                                      ? {
                                          ...entry,
                                          name: event.currentTarget.value,
                                        }
                                      : entry
                                  ),
                                }))
                              }
                            />
                            <MonthField
                              label={t("memberBirthMonth")}
                              placeholder={t("monthPlaceholder")}
                              value={member.birthMonth}
                              error={memberMonthErrors[member.id]}
                              onChange={(value) =>
                                setHousehold((current) => ({
                                  ...current,
                                  members: current.members.map((entry) =>
                                    entry.id === member.id
                                      ? { ...entry, birthMonth: value }
                                      : entry
                                  ),
                                }))
                              }
                            />
                          </Stack>
                        </Card>
                      ))}
                    </SimpleGrid>
                  </Stack>
                </Card>
              </Stack>
            ),
          },
          {
            id: "result",
            title: t("step.result"),
            content: (
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Title order={4}>{t("resultTitle")}</Title>
                  <Text size="sm" c="dimmed">
                    {t("resultHint")}
                  </Text>
                  <Group align="center" wrap="wrap">
                    <Button onClick={handleSave} disabled={!canProceed}>
                      {t("saveCta")}
                    </Button>
                    <Button variant="default" onClick={handleLater}>
                      {t("laterCta")}
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t("saveHint")}
                  </Text>
                </Stack>
              </Card>
            ),
          },
        ]}
        navigation={
          <>
            <Button variant="default" onClick={handleBack} disabled={step === 0}>
              {t("back")}
            </Button>
            <Button
              onClick={handleNext}
              disabled={
                step === steps.length - 1 ||
                (step === 0 && hasProfileError) ||
                (step === 1 && hasMemberMonthErrors)
              }
            >
              {t("next")}
            </Button>
          </>
        }
      />
    </Stack>
  );
}
