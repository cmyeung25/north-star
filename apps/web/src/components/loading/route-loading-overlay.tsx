"use client";

import { Center, Loader, Overlay, Paper, Stack, Text } from "@mantine/core";

type RouteLoadingOverlayProps = {
  opened: boolean;
  title: string;
  description?: string;
};

export function RouteLoadingOverlay({ opened, title, description }: RouteLoadingOverlayProps) {
  if (!opened) {
    return null;
  }

  return (
    <Overlay fixed zIndex={400} color="#061b33" backgroundOpacity={0.64} blur={2}>
      <Center h="100%" px="md">
        <Paper radius="md" p={{ base: "md", sm: "lg" }} miw={{ base: 280, sm: 420 }} withBorder>
          <Stack gap="xs">
            <Text fw={700} size="lg">
              {title}
            </Text>
            {description ? (
              <Text c="dimmed" size="sm">
                {description}
              </Text>
            ) : null}
            <Center pt="xs">
              <Loader color="aurora" type="dots" />
            </Center>
          </Stack>
        </Paper>
      </Center>
    </Overlay>
  );
}
