import { NextResponse } from "next/server";
import { createCaseScenarioRepo } from "@north-star/adapters";
import {
  assertValidE2ESecret,
  getE2EBootstrapCredentials,
  isE2EBootstrapEnabled,
  isE2EUnauthorizedError,
} from "../../../../../lib/e2e/authBootstrap";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";

export type ResetRouteDeps = {
  assertValidE2ESecret: typeof assertValidE2ESecret;
  createCaseScenarioRepo: typeof createCaseScenarioRepo;
  createSupabaseServerClient: typeof createSupabaseServerClient;
  getE2EBootstrapCredentials: typeof getE2EBootstrapCredentials;
  isE2EBootstrapEnabled: typeof isE2EBootstrapEnabled;
  isE2EUnauthorizedError: typeof isE2EUnauthorizedError;
};

const resetRouteDeps: ResetRouteDeps = {
  assertValidE2ESecret,
  createCaseScenarioRepo,
  createSupabaseServerClient,
  getE2EBootstrapCredentials,
  isE2EBootstrapEnabled,
  isE2EUnauthorizedError,
};

export async function postReset(request: Request, deps: ResetRouteDeps = resetRouteDeps) {
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

  const supabase = deps.createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authenticated E2E session required." }, { status: 401 });
  }

  const { email: expectedEmail } = deps.getE2EBootstrapCredentials();

  if ((user.email ?? "").toLowerCase() !== expectedEmail.toLowerCase()) {
    return NextResponse.json({ error: "Authenticated user is not the configured E2E account." }, { status: 403 });
  }

  const repo = deps.createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: supabase,
  });
  const cases = await repo.listCases();

  await Promise.all(cases.map((entry) => repo.deleteCase(entry.id)));

  return NextResponse.json({
    deletedCaseCount: cases.length,
  });
}
