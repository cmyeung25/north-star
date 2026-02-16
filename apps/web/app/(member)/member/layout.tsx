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
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #e5e7eb", padding: "1rem" }}>
        <h2>Member</h2>
        <nav style={{ display: "grid", gap: "0.5rem" }}>
          <Link href="/member/cases">Cases</Link>
          <Link href="/account">Account settings</Link>
          <Link href="/auth/logout">Logout</Link>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}
