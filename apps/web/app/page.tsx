import { Button, Card, Stack, Text, Title } from "@mantine/core";
import { t } from "../lib/i18n";

export default function HomePage() {
  return (
    <Stack gap="md">
      <Title order={1}>{t("homeTitle")}</Title>
      <Card withBorder shadow="sm" padding="lg" radius="md">
        <Text>{t("homeIntro")}</Text>
      </Card>
      <Button size="md">{t("homeCta")}</Button>
    </Stack>
  );
}
