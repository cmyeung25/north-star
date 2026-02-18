"use client";

import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { aurinTheme } from "../../theme/aurinTheme";

type MarketingProvidersProps = {
  children: ReactNode;
};

export default function MarketingProviders({ children }: MarketingProvidersProps) {
  return <MantineProvider theme={aurinTheme}>{children}</MantineProvider>;
}
