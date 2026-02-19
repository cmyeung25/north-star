import type { ReactNode } from "react";
import MarketingLayoutShell from "../../(marketing)/_components/MarketingLayoutShell";

export default function LocaleMarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingLayoutShell>{children}</MarketingLayoutShell>;
}
