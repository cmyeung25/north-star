"use client";

import { Card, Container, Stack, Tabs, Text, Title } from "@mantine/core";

const sections = [
  { value: "profile", label: "Profile", description: "Manage your personal and contact details." },
  { value: "security", label: "Security", description: "Update password, MFA, and session controls." },
  { value: "connected", label: "Connected", description: "Manage connected apps and integrations." },
  { value: "data", label: "Data", description: "Review export, retention, and privacy controls." },
  { value: "billing", label: "Billing", description: "Manage plans, invoices, and payment methods." },
] as const;

export default function MemberAccountPage() {
  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        <div>
          <Title order={2}>Account</Title>
          <Text c="dimmed">Centralized account management for member settings.</Text>
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
                <Stack gap="xs">
                  <Text fw={600}>{section.label}</Text>
                  <Text size="sm" c="dimmed">
                    {section.description}
                  </Text>
                </Stack>
              </Card>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
