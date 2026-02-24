"use client";

import { Grid } from "@mantine/core";
import type { ReactNode } from "react";

type TwoPaneLayoutProps = {
  left: ReactNode;
  right: ReactNode;
};

export default function TwoPaneLayout({ left, right }: TwoPaneLayoutProps) {
  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, sm: 8 }}>{left}</Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>{right}</Grid.Col>
    </Grid>
  );
}
