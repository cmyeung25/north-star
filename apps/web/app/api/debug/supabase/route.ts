import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    const { data: cases, error: casesError } = await supabase
      .from("cases")
      .select("id,name,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      authedUserId: user?.id ?? null,
      authedEmail: user?.email ?? null,
      userError: userError?.message ?? null,
      cases: cases ?? [],
      casesError: casesError?.message ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase debug error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
