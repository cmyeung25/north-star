import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MemberShell } from "../_components/MemberShell";
import { createSupabaseServerClient } from "../../../src/lib/supabase/server";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/member");
  }

  return <MemberShell userEmail={user.email}>{children}</MemberShell>;
}
