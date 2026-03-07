import { describe, expect, it } from "vitest";
import { postBootstrap } from "./handler";

type BootstrapDeps = NonNullable<Parameters<typeof postBootstrap>[1]>;

const buildDeps = () => {
  const signInCalls: Array<Array<{ email: string; password: string }>> = [];
  const redirectCalls: Array<Array<string | null>> = [];
  let enabled = true;
  let unauthorizedError: Error | null = null;

  const deps: BootstrapDeps = {
    assertValidE2ESecret() {
      if (unauthorizedError) {
        throw unauthorizedError;
      }
    },
    createSupabaseServerClient() {
      return {
        auth: {
          async signInWithPassword(credentials: { email: string; password: string }) {
            signInCalls.push([credentials]);
            return { error: null };
          },
        },
      } as ReturnType<BootstrapDeps["createSupabaseServerClient"]>;
    },
    getE2EBootstrapCredentials() {
      return {
        email: "e2e@example.com",
        password: "secret",
      };
    },
    isE2EBootstrapEnabled() {
      return enabled;
    },
    isE2EUnauthorizedError(error: unknown) {
      return error instanceof Error && error.name === "E2EAuthUnauthorizedError";
    },
    resolveE2ERedirect(locale?: string | null) {
      redirectCalls.push([locale ?? null]);
      return "/en/member/cases";
    },
  };

  return {
    deps,
    redirectCalls,
    signInCalls,
    setEnabled(value: boolean) {
      enabled = value;
    },
    setUnauthorizedError(message: string) {
      unauthorizedError = new Error(message);
      unauthorizedError.name = "E2EAuthUnauthorizedError";
    },
  };
};

describe("POST /api/e2e/auth/bootstrap", () => {
  it("returns 404 when the bootstrap is disabled", async () => {
    const harness = buildDeps();
    harness.setEnabled(false);

    const response = await postBootstrap(new Request("http://localhost/api/e2e/auth/bootstrap", { method: "POST" }), harness.deps);

    expect(response.status).toBe(404);
  });

  it("returns 401 when the secret is invalid", async () => {
    const harness = buildDeps();
    harness.setUnauthorizedError("Invalid E2E auth secret.");

    const response = await postBootstrap(new Request("http://localhost/api/e2e/auth/bootstrap", { method: "POST" }), harness.deps);

    expect(response.status).toBe(401);
  });

  it("signs in with the configured credentials and returns the member redirect", async () => {
    const harness = buildDeps();

    const response = await postBootstrap(
      new Request("http://localhost/api/e2e/auth/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: "en" }),
      }),
      harness.deps,
    );

    expect(harness.signInCalls).toEqual([[{ email: "e2e@example.com", password: "secret" }]]);
    expect(harness.redirectCalls).toEqual([["en"]]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: "/en/member/cases" });
  });
});