import { Card, SimpleGrid, Skeleton, Stack } from "@mantine/core";

export default function ScenarioOnboardingLoading() {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
      <Stack visibleFrom="md" h="calc(100vh - 140px)" style={{ position: "sticky", top: 70 }}>
        <Skeleton radius="md" h="100%" />
      </Stack>

      <Stack gap="lg">
        <Skeleton height={24} width="45%" />
        <Skeleton height={14} width="70%" />
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Skeleton height={18} width="35%" />
            <Skeleton height={12} width="82%" />
            <Skeleton height={12} width="76%" />
            <Skeleton height={12} width="68%" />
          </Stack>
        </Card>
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Skeleton height={18} width="30%" />
            <Skeleton height={52} radius="md" />
            <Skeleton height={52} radius="md" />
            <Skeleton height={52} radius="md" />
          </Stack>
        </Card>
        <SimpleGrid cols={2}>
          <Skeleton height={36} radius="md" />
          <Skeleton height={36} radius="md" />
        </SimpleGrid>
      </Stack>
    </SimpleGrid>
  );
}
