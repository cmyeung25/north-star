"use client";

import { Card, Grid, Skeleton, Stack } from "@mantine/core";

export function AppSkeleton() {
  return (
    <Stack gap="md">
      <Grid>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid.Col key={index} span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder radius="md" p="md">
              <Stack gap="xs">
                <Skeleton height={10} width="44%" />
                <Skeleton height={24} width="68%" />
                <Skeleton height={8} width="52%" />
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      <Card withBorder radius="md" p="md">
        <Skeleton height={18} width={160} mb="sm" />
        <Skeleton height={280} radius="sm" />
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Skeleton height={16} width={180} />
              <Skeleton height={12} />
              <Skeleton height={12} width="86%" />
              <Skeleton height={12} width="72%" />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Skeleton height={16} width={150} />
              <Skeleton height={12} />
              <Skeleton height={12} width="80%" />
              <Skeleton height={12} width="64%" />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
