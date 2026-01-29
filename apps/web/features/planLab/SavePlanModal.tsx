"use client";

import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { PlanSnapshot } from "../../src/domain/planLab/types";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

type SavePlanModalProps = {
  opened: boolean;
  onClose: () => void;
  snapshot: PlanSnapshot;
  defaultName: string;
  warnings: string[];
  translate: TranslateFn;
  onSave: (name: string) => void;
};

const countBaselinePatches = (snapshot: PlanSnapshot) => {
  const baseline = snapshot.baselinePatches ?? {};
  const eventCount = Object.keys(baseline.eventPatches ?? {}).length;
  const ruleCount = Object.keys(baseline.rulePatches ?? {}).length;
  const positionCount = Object.keys(baseline.positionPatches ?? {}).length;
  const smartInvestCount = baseline.smartInvestPatch ? 1 : 0;
  return eventCount + ruleCount + positionCount + smartInvestCount;
};

export const SavePlanModal = ({
  opened,
  onClose,
  snapshot,
  defaultName,
  warnings,
  translate,
  onSave,
}: SavePlanModalProps) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (opened) {
      setName(defaultName);
    }
  }, [defaultName, opened]);

  const baselineCount = useMemo(() => countBaselinePatches(snapshot), [snapshot]);
  const experimentCount = snapshot.experiments?.length ?? 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={translate("planLabSavePlanTitle", "Save Plan")}
    >
      <Stack gap="sm">
        <TextInput
          label={translate("planLabSavePlanNameLabel", "Plan name")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group gap="md">
          <Text size="sm">
            {translate("planLabSavePlanBaselineCount", "Baseline edits: {count}", {
              count: baselineCount,
            })}
          </Text>
          <Text size="sm">
            {translate("planLabSavePlanExperimentCount", "Experiments: {count}", {
              count: experimentCount,
            })}
          </Text>
        </Group>
        {warnings.length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {translate("planLabSavePlanWarningsTitle", "Warnings")}
            </Text>
            {warnings.map((warning) => (
              <Text key={warning} size="sm" c="orange">
                {warning}
              </Text>
            ))}
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {translate("planLabSavePlanCancel", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              if (name.trim().length > 0) {
                onSave(name.trim());
              }
            }}
          >
            {translate("planLabSavePlanConfirm", "Save plan")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
