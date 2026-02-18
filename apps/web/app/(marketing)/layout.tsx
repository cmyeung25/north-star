import type { ReactNode } from "react";
import MarketingProviders from "./_components/MarketingProviders";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingProviders>{children}</MarketingProviders>;
}
