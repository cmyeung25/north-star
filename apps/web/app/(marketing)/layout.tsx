import type { ReactNode } from "react";
import MarketingLayoutShell from "./_components/MarketingLayoutShell";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingLayoutShell>{children}</MarketingLayoutShell>;
}
