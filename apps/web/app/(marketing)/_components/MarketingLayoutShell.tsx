"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Box, Container, Stack } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import AuthModal from "../../(auth)/_components/AuthModal";
import MarketingFooter from "../../../components/marketing/MarketingFooter";
import MarketingHeader from "../../../components/marketing/MarketingHeader";
import { AuthModalProvider, type AuthModalTab } from "./AuthModalController";

export default function MarketingLayoutShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [opened, setOpened] = useState(false);
  const [initialTab, setInitialTab] = useState<AuthModalTab>("login");

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login" || auth === "register") {
      setInitialTab(auth);
      setOpened(true);
    }
  }, [searchParams]);

  const openAuthModal = (tab: AuthModalTab) => {
    setInitialTab(tab);
    setOpened(true);
  };

  return (
    <AuthModalProvider value={{ openAuthModal }}>
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
      <AuthModal opened={opened} initialTab={initialTab} onClose={() => setOpened(false)} />
    </AuthModalProvider>
  );
}
