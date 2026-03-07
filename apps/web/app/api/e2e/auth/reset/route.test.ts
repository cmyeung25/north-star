import { describe, expect, it } from "vitest";
import { postReset } from "./handler";

type ResetDeps = NonNullable<Parameters<typeof postReset>[1]>;

const buildDeps = () => {
  const deleteCaseCalls: Array<Array<string>> = [];
  let enabled = true;
  let unauthorizedError: Error | null = null;
  let userEmail = "e2e@example.com";
  let listedCases = [{ id: "case-1" }, { id: "case-2" }];
  let listCasesCallCount = 0;
  let createRepoCalls = 0;
  let supabaseClientRef: ReturnType<ResetDeps["createSupabaseServerClient"]> | null | undefined = null;

  const deps: ResetDeps = {
    assertValidE2ESecret() {
      if (unauthorizedError) {
        throw unauthorizedError;
      }
    },
    createCaseScenarioRepo(input) {
      createRepoCalls += 1;
      supabaseClientRef = input.supabaseClient;
      return {
        async listCases() {
          listCasesCallCount += 1;
          return listedCases;
        },
        async deleteCase(caseId: string) {
          deleteCaseCalls.push([caseId]);
        },
      } as ReturnType<ResetDeps["createCaseScenarioRepo"]>;
    },
    createSupabaseServerClient() {
      return {
        auth: {
          async getUser() {
            return {
              data: {
                user: userEmail ? { email: userEmail } : null,
              },
              error: null,
            };
          },
        },
      } as ReturnType<ResetDeps["createSupabaseServerClient"]>;
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
  };

  return {
    deps,
    deleteCaseCalls,
    get createRepoCalls() {
      return createRepoCalls;
    },
    get listCasesCallCount() {
      return listCasesCallCount;
    },
    get supabaseClientRef() {
      return supabaseClientRef;
    },
    setEnabled(value: boolean) {
      enabled = value;
    },
    setListedCases(value: Array<{ id: string }>) {
      listedCases = value;
    },
    setUnauthorizedError(message: string) {
      unauthorizedError = new Error(message);
      unauthorizedError.name = "E2EAuthUnauthorizedError";
    },
    setUserEmail(value: string) {
      userEmail = value;
    },
  };
};

describe("POST /api/e2e/auth/reset", () => {
  it("returns 404 when the bootstrap is disabled", async () => {
    const harness = buildDeps();
    harness.setEnabled(false);

    const response = await postReset(new Request("http://localhost/api/e2e/auth/reset", { method: "POST" }), harness.deps);

    expect(response.status).toBe(404);
  });

  it("returns 401 when the secret is invalid", async () => {
    const harness = buildDeps();
    harness.setUnauthorizedError("Invalid E2E auth secret.");

    const response = await postReset(new Request("http://localhost/api/e2e/auth/reset", { method: "POST" }), harness.deps);

    expect(response.status).toBe(401);
  });

  it("deletes only the authenticated E2E user's cases", async () => {
    const harness = buildDeps();
    harness.setListedCases([{ id: "case-1" }, { id: "case-2" }]);

    const response = await postReset(new Request("http://localhost/api/e2e/auth/reset", { method: "POST" }), harness.deps);

    expect(harness.createRepoCalls).toBe(1);
    expect(Boolean(harness.supabaseClientRef)).toBe(true);
    expect(harness.listCasesCallCount).toBe(1);
    expect(harness.deleteCaseCalls).toEqual([["case-1"], ["case-2"]]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedCaseCount: 2 });
  });

  it("refuses to reset data for a different authenticated user", async () => {
    const harness = buildDeps();
    harness.setUserEmail("member@example.com");

    const response = await postReset(new Request("http://localhost/api/e2e/auth/reset", { method: "POST" }), harness.deps);

    expect(response.status).toBe(403);
    expect(harness.listCasesCallCount).toBe(0);
  });
});