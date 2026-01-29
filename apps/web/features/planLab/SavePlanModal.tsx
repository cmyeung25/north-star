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

  const patchCount = useMemo(() => snapshot.patches.length, [snapshot.patches.length]);
  const addCount = useMemo(
    () => snapshot.patches.filter((patch) => patch.op === "add").length,
    [snapshot.patches]
  );

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
            {translate("planLabSavePlanPatchCount", "Edits: {count}", {
              count: patchCount,
            })}
          </Text>
          <Text size="sm">
            {translate("planLabSavePlanAddCount", "Adds: {count}", {
              count: addCount,
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
