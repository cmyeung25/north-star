"use client";

import {
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { EventDefinition } from "../../../src/domain/events/types";
import type { BudgetRule, Scenario } from "../../../src/store/scenarioStore";
import {
  createBudgetRuleId,
  createCarPositionId,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { normalizeMonthStrict } from "../../../src/utils/month";
import { applyScenarioPatch, type ScenarioPatch } from "../../../src/domain/scenarios/applyScenarioPatch";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { createEventDefinitionFromTemplate } from "../../../components/timeline/utils";

type ScenarioComparisonWizardProps = {
  opened: boolean;
  onClose: () => void;
};

type TemplateBuildResult = {
  patches: ScenarioPatch[];
  budgetRules?: BudgetRule[];
  eventDefinitions?: EventDefinition[];
};

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const resolveBaseMonth = (scenario: Scenario) => {
  const normalized = normalizeMonthStrict(scenario.assumptions.baseMonth ?? "");
  return normalized.ok ? normalized.month : getCurrentMonth();
};

export default function ScenarioComparisonWizard({
  opened,
  onClose,
}: ScenarioComparisonWizardProps) {
  const t = useTranslations("scenarios");
  const timeline = useTranslations("timeline");
  const locale = useLocale();
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);
  const addEventDefinition = useScenarioStore((state) => state.addEventDefinition);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);

  const scenarioOptions = useMemo(
    () =>
      scenarios.map((scenario) => ({
        value: scenario.id,
        label: scenario.name,
      })),
    [scenarios]
  );

  const [baselineScenarioId, setBaselineScenarioId] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) {
      setSelectedTemplates([]);
      return;
    }

    setBaselineScenarioId(activeScenarioId ?? scenarios[0]?.id ?? null);
  }, [activeScenarioId, opened, scenarios]);

  const templates = useMemo(
    () => [
      {
        id: "buy-vs-rent",
        label: t("compareTemplateBuyVsRent"),
        description: t("compareTemplateBuyVsRentHint"),
      },
      {
        id: "education-budget",
        label: t("compareTemplateEducationBudget"),
        description: t("compareTemplateEducationBudgetHint"),
      },
      {
        id: "car-ownership",
        label: t("compareTemplateCarOwnership"),
        description: t("compareTemplateCarOwnershipHint"),
      },
    ],
    [t]
  );

  const buildTemplatePatches = (
    templateId: string,
    scenario: Scenario,
    scenarioId: string
  ): TemplateBuildResult => {
    const baseMonth = resolveBaseMonth(scenario);

    if (templateId === "buy-vs-rent") {
      const eventLookup = new Map(
        eventLibrary.map((definition) => [definition.id, definition])
      );
      const existingEventRefs = scenario.eventRefs ?? [];
      const filteredEventRefs = existingEventRefs.filter(
        (ref) => eventLookup.get(ref.refId)?.type !== "buy_home"
      );
      const hasRentEvent = filteredEventRefs.some(
        (ref) => eventLookup.get(ref.refId)?.type === "rent"
      );
      const rentMonthly = scenario.assumptions.rentMonthly ?? 1800;
      const rentGrowthPct = scenario.assumptions.rentAnnualGrowthPct ?? 3;
      const eventDefinitions: EventDefinition[] = [];
      const nextEventRefs = [...filteredEventRefs];

      if (!hasRentEvent) {
        const rentDefinition = createEventDefinitionFromTemplate("rent", timeline, {
          baseCurrency: scenario.baseCurrency,
          baseMonth,
        });
        rentDefinition.rule.monthlyAmount = rentMonthly;
        rentDefinition.rule.annualGrowthPct = rentGrowthPct;
        eventDefinitions.push(rentDefinition);
        nextEventRefs.push({ refId: rentDefinition.id, enabled: true });
      }

      const investmentHomes =
        scenario.positions?.homes?.filter(
          (home) => (home.usage ?? "primary") === "investment"
        ) ?? [];

      return {
        patches: [
          {
            type: "setScenario",
            patch: {
              assumptions: {
                rentMonthly,
                rentAnnualGrowthPct: rentGrowthPct,
              },
            },
          },
          {
            type: "setPositions",
            positions: {
              home: undefined,
              homes: investmentHomes,
            },
          },
          {
            type: "setEventRefs",
            eventRefs: nextEventRefs,
          },
        ],
        eventDefinitions,
      };
    }

    if (templateId === "education-budget") {
      const ruleIndex = budgetRules.length + 1;
      const educationRule: BudgetRule = {
        id: createBudgetRuleId(),
        name: t("compareTemplateEducationRuleName", { index: ruleIndex }),
        enabled: true,
        category: "education",
        ageBand: { fromYears: 6, toYears: 22 },
        monthlyAmount: 1500,
        annualGrowthPct: 3,
        startMonth: baseMonth,
        applyScope: { scope: "include", scenarioIds: [scenarioId] },
      };
      return {
        patches: [
          {
            type: "setScenario",
            patch: { assumptions: { includeBudgetRulesInProjection: true } },
          },
        ],
        budgetRules: [educationRule],
      };
    }

    if (templateId === "car-ownership") {
      return {
        patches: [
          {
            type: "upsertCar",
            car: {
              id: createCarPositionId(),
              purchaseMonth: baseMonth,
              purchasePrice: 30000,
              downPayment: 5000,
              annualDepreciationRatePct: 12,
              holdingCostMonthly: 350,
              holdingCostAnnualGrowthPct: 2,
              loan: {
                principal: 25000,
                annualInterestRatePct: 4,
                termYears: 5,
              },
            },
          },
        ],
      };
    }

    return { patches: [] };
  };

  const handleCreate = () => {
    if (!baselineScenarioId) {
      return;
    }
    const baselineScenario = scenarios.find(
      (scenario) => scenario.id === baselineScenarioId
    );
    if (!baselineScenario) {
      return;
    }

    const templatesToApply = templates.filter((template) =>
      selectedTemplates.includes(template.id)
    );
    if (templatesToApply.length === 0) {
      return;
    }

    setIsSubmitting(true);
    const createdScenarioIds: string[] = [];

    templatesToApply.forEach((template) => {
      const scenarioName = `${baselineScenario.name} · ${template.label}`;
      const seededScenario = createScenario(scenarioName, {
        baseCurrency: baselineScenario.baseCurrency,
        onboardingCompleted: baselineScenario.clientComputed?.onboardingCompleted,
      });
      const result = buildTemplatePatches(template.id, baselineScenario, seededScenario.id);
      const patchedScenario = applyScenarioPatch({
        scenario: baselineScenario,
        patches: [
          {
            type: "setScenario",
            patch: {
              name: scenarioName,
              baseCurrency: baselineScenario.baseCurrency,
            },
          },
          ...result.patches,
        ],
      });

      result.eventDefinitions?.forEach((definition) => addEventDefinition(definition));
      result.budgetRules?.forEach((rule) => createBudgetRule(rule));

      replaceScenario({
        ...patchedScenario,
        id: seededScenario.id,
      });
      createdScenarioIds.push(seededScenario.id);
    });

    const compareIds = [baselineScenario.id, ...createdScenarioIds];
    router.push(
      `/${locale}${buildScenarioUrl("/dashboard", baselineScenario.id)}&compareScenarioIds=${compareIds.join(",")}`
    );
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("compareWizardTitle")}
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("compareWizardSubtitle")}
        </Text>
        <Select
          label={t("compareWizardBaseline")}
          data={scenarioOptions}
          value={baselineScenarioId}
          onChange={setBaselineScenarioId}
          placeholder={t("compareWizardBaselinePlaceholder")}
        />
        <Stack gap="xs">
          <Text fw={600}>{t("compareWizardTemplates")}</Text>
          <Text size="sm" c="dimmed">
            {t("compareWizardTemplatesHint")}
          </Text>
          <Checkbox.Group
            value={selectedTemplates}
            onChange={setSelectedTemplates}
          >
            <Stack gap="sm">
              {templates.map((template) => (
                <Checkbox
                  key={template.id}
                  value={template.id}
                  label={
                    <Stack gap={2}>
                      <Text fw={600} size="sm">
                        {template.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {template.description}
                      </Text>
                    </Stack>
                  }
                />
              ))}
            </Stack>
          </Checkbox.Group>
        </Stack>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("compareWizardCancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!baselineScenarioId || selectedTemplates.length === 0}
            loading={isSubmitting}
          >
            {t("compareWizardCreate")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
