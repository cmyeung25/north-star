"use client";

import {
  AppShell,
  Container,
  Group,
  MantineProvider,
  Text,
  createTheme,
} from "@mantine/core";
import type { ReactNode } from "react";

const theme = createTheme({
  primaryColor: "indigo",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
  },
  defaultRadius: "md",
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <AppShell header={{ height: 64 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md">
            <Text fw={600} size="lg">
              North Star
            </Text>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <Container size="sm" px="md" py="xl">
            {children}
          </Container>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
