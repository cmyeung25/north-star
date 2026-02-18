import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "../../../src/lib/supabase/server";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/member");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--aur-surface-50)" }}>
      <aside
        style={{
          width: 240,
          borderRight: "1px solid var(--aur-border-200)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Member</h2>
        <p style={{ margin: 0, color: "var(--aur-text-muted)", fontSize: "0.875rem" }}>
          Case / scenario management
        </p>
        <Link href="/member/cases">Cases</Link>
        <Link href="/account">Account settings</Link>
        <Link href="/auth/logout">Logout</Link>
      </aside>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
