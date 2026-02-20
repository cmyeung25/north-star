"use client";

import { Button, Card, Container, Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";

const sectionValues = ["profile", "security", "connected", "data", "billing"] as const;

export default function MemberAccountPage() {
  const t = useTranslations("member.account");

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
                    <Text size="sm">{t("profile.signedInAs", { email: "member@example.com" })}</Text>
                  ) : null}

                  <Group>
                    {section.value === "security" ? (
                      <Button variant="light" color="red">
                        {t("security.logout")}
                      </Button>
                    ) : (
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
