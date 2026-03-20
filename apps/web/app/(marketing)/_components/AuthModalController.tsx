"use client";

import type { MemberCasesEntryIntent } from "../../../src/features/member/createCaseEntry";
import { createContext, useContext, type ReactNode } from "react";

export type AuthModalTab = "login" | "register";

type AuthModalContextValue = {
  openAuthModal: (tab: AuthModalTab, entryIntent?: MemberCasesEntryIntent) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({
  value,
  children,
}: {
  value: AuthModalContextValue;
  children: ReactNode;
}) {
  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }

  return context;
}
