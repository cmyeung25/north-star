import type { ReactNode } from "react";
import RootProviders from "../root-providers";

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <RootProviders>{children}</RootProviders>;
}
