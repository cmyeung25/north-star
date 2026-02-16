import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "../../../src/lib/supabase/server";

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/app");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #ddd", padding: "1rem" }}>
        <h2>North Star</h2>
        <nav style={{ display: "grid", gap: "0.5rem" }}>
          <Link href="/app">Dashboard</Link>
          <Link href="/account">Account</Link>
          <Link href="/auth/logout">Logout</Link>
        </nav>
      </aside>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
