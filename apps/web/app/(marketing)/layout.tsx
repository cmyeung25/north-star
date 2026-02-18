import type { ReactNode } from "react";
import { Box, Container, Stack } from "@mantine/core";
import MarketingFooter from "../../components/marketing/MarketingFooter";
import MarketingHeader from "../../components/marketing/MarketingHeader";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 10% 5%, rgba(35, 213, 171, 0.2), transparent 35%), radial-gradient(circle at 90% 0%, rgba(74, 116, 255, 0.24), transparent 30%), #0B1B3A",
      }}
    >
      <Container size="lg" py={{ base: 32, sm: 48 }}>
        <Stack gap={32}>
          <MarketingHeader />
          {children}
          <MarketingFooter />
        </Stack>
      </Container>
    </Box>
  );
}
