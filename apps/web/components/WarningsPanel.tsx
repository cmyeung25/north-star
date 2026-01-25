"use client";

import { Accordion, Badge, Group, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CompilerWarning } from "../src/domain/warnings/types";

type WarningsPanelProps = {
  warnings?: CompilerWarning[];
  title?: string;
  defaultOpen?: boolean;
};

const severityOrder: Record<string, number> = {
  warning: 0,
  info: 1,
};

export default function WarningsPanel({
  warnings = [],
  title,
  defaultOpen = false,
}: WarningsPanelProps) {
  const t = useTranslations();
  const groupedWarnings = useMemo(() => {
    const grouped = warnings.reduce<Record<string, Record<string, CompilerWarning[]>>>(
      (acc, warning) => {
        const severityGroup = acc[warning.severity] ?? {};
        severityGroup[warning.code] = [...(severityGroup[warning.code] ?? []), warning];
        acc[warning.severity] = severityGroup;
        return acc;
      },
      {}
    );
    return Object.entries(grouped).sort(
      ([severityA], [severityB]) =>
        (severityOrder[severityA] ?? 99) - (severityOrder[severityB] ?? 99)
    );
  }, [warnings]);

  if (warnings.length === 0) {
    return null;
  }

  const panelTitle =
    title ??
    (t.has("warnings.panelTitle") ? t("warnings.panelTitle") : "Warnings");

  const resolveMessage = (warning: CompilerWarning) =>
    warning.messageKey && t.has(warning.messageKey)
      ? t(warning.messageKey)
      : warning.defaultMessage;

  const resolveSeverityLabel = (severity: string) =>
    t.has(`warnings.severity.${severity}`)
      ? t(`warnings.severity.${severity}`)
      : severity;

  const resolveCodeLabel = (code: string) =>
    t.has(`warnings.codes.${code}`) ? t(`warnings.codes.${code}`) : code;

  return (
    <Accordion defaultValue={defaultOpen ? "warnings" : null}>
      <Accordion.Item value="warnings">
        <Accordion.Control>
          <Group justify="space-between" align="center" wrap="wrap">
            <Text fw={600}>{panelTitle}</Text>
            <Badge color="orange" variant="light">
              {warnings.length}
            </Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            {groupedWarnings.map(([severity, codeGroups]) => (
              <Stack key={severity} gap="xs">
                <Group gap="xs">
                  <Badge color={severity === "warning" ? "orange" : "blue"} variant="light">
                    {resolveSeverityLabel(severity)}
                  </Badge>
                </Group>
                {Object.entries(codeGroups).map(([code, entries]) => (
                  <Stack key={code} gap={4}>
                    <Group gap="xs">
                      <Badge color="gray" variant="light">
                        {resolveCodeLabel(code)}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {entries.length}
                      </Text>
                    </Group>
                    {entries.map((warning, index) => (
                      <Text key={`${code}-${index}`} size="sm">
                        • {resolveMessage(warning)}
                      </Text>
                    ))}
                  </Stack>
                ))}
              </Stack>
            ))}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
