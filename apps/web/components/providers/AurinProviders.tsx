"use client";

import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { aurinTheme } from "../../lib/theme/aurinTheme";

type AurinProvidersProps = {
  children: ReactNode;
};

export default function AurinProviders({ children }: AurinProvidersProps) {
  return <MantineProvider theme={aurinTheme}>{children}</MantineProvider>;
}

