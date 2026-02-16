import type { ReactNode } from "react";
import { Container, Group, Stack, Text, Title } from "@mantine/core";

type MemberShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function MemberShell({ title, description, actions, children }: MemberShellProps) {
  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="end">
          <div>
            <Title order={2}>{title}</Title>
            {description ? <Text c="dimmed">{description}</Text> : null}
          </div>
          {actions}
        </Group>
        {children}
      </Stack>
    </Container>
  );
}
