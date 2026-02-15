import { createSupabaseServerClient } from "../../../src/lib/supabase/server";

export default async function AccountPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section>
      <h1>Account Settings</h1>
      <p>Signed in as: {user?.email ?? "Unknown user"}</p>
    </section>
  );
}
