"use client";

import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { aurinTheme } from "./theme/aurinTheme";

type RootProvidersProps = {
  children: ReactNode;
};

export default function RootProviders({ children }: RootProvidersProps) {
  return <MantineProvider theme={aurinTheme}>{children}</MantineProvider>;
}
