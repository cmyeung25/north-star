const getRequiredEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Missing Supabase environment variable: ${name}`);
  }

  return value;
};

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value && process.env.NODE_ENV === "development") {
    console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL is not set.");
  }

  return getRequiredEnv(value, "NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!value && process.env.NODE_ENV === "development") {
    console.warn(
      "[supabase] Missing publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (preferred), NEXT_PUBLIC_SUPABASE_ANON_KEY, or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return getRequiredEnv(
    value,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
}
