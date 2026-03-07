import { NextResponse } from "next/server";
import {
  assertValidE2ESecret,
  getE2EBootstrapCredentials,
  isE2EBootstrapEnabled,
  isE2EUnauthorizedError,
  resolveE2ERedirect,
} from "../../../../../lib/e2e/authBootstrap";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";

type BootstrapRequestBody = {
  locale?: string | null;
};

export type BootstrapRouteDeps = {
  assertValidE2ESecret: typeof assertValidE2ESecret;
  createSupabaseServerClient: typeof createSupabaseServerClient;
  getE2EBootstrapCredentials: typeof getE2EBootstrapCredentials;
  isE2EBootstrapEnabled: typeof isE2EBootstrapEnabled;
  isE2EUnauthorizedError: typeof isE2EUnauthorizedError;
  resolveE2ERedirect: typeof resolveE2ERedirect;
};

const bootstrapRouteDeps: BootstrapRouteDeps = {
  assertValidE2ESecret,
  createSupabaseServerClient,
  getE2EBootstrapCredentials,
  isE2EBootstrapEnabled,
  isE2EUnauthorizedError,
  resolveE2ERedirect,
};

export async function postBootstrap(request: Request, deps: BootstrapRouteDeps = bootstrapRouteDeps) {
  if (!deps.isE2EBootstrapEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    deps.assertValidE2ESecret(request);
  } catch (error) {
    if (deps.isE2EUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Unknown E2E auth error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const payload = (await request.json().catch(() => ({}))) as BootstrapRequestBody;
  const locale = typeof payload.locale === "string" ? payload.locale : null;
  const supabase = deps.createSupabaseServerClient();
  const credentials = deps.getE2EBootstrapCredentials();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    redirectTo: deps.resolveE2ERedirect(locale),
  });
}
