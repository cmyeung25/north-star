import { describe, expect, it } from "vitest";
import {
  E2E_SECRET_HEADER,
  assertValidE2ESecret,
  getE2EBootstrapCredentials,
  isE2EBootstrapEnabled,
  resolveE2ERedirect,
} from "./authBootstrap";

const withEnv = (entries: Record<string, string | undefined>, run: () => void) => {
  const previous = new Map<string, string | undefined>();

  Object.entries(entries).forEach(([key, value]) => {
    previous.set(key, process.env[key]);
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  try {
    run();
  } finally {
    previous.forEach((value, key) => {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
};

describe("authBootstrap", () => {
  it("enables bootstrap only in development when the flag is set", () => {
    withEnv({ NODE_ENV: "development", E2E_AUTH_BOOTSTRAP: "1" }, () => {
      expect(isE2EBootstrapEnabled()).toBe(true);
    });

    withEnv({ NODE_ENV: "test", E2E_AUTH_BOOTSTRAP: "1" }, () => {
      expect(isE2EBootstrapEnabled()).toBe(false);
    });
  });

  it("validates the shared secret header", () => {
    withEnv({ E2E_AUTH_SECRET: "top-secret" }, () => {
      expect(() =>
        assertValidE2ESecret(
          new Request("http://localhost/api/e2e/auth/bootstrap", {
            headers: { [E2E_SECRET_HEADER]: "top-secret" },
          }),
        ),
      ).not.toThrow();

      expect(() =>
        assertValidE2ESecret(
          new Request("http://localhost/api/e2e/auth/bootstrap", {
            headers: { [E2E_SECRET_HEADER]: "wrong" },
          }),
        ),
      ).toThrow("Invalid E2E auth secret.");
    });
  });

  it("builds a localized member-cases redirect", () => {
    expect(resolveE2ERedirect("en")).toBe("/en/member/cases");
    expect(resolveE2ERedirect()).toBe("/member/cases");
  });

  it("reads the configured E2E credentials", () => {
    withEnv({ E2E_AUTH_EMAIL: "e2e@example.com", E2E_AUTH_PASSWORD: "secret" }, () => {
      expect(getE2EBootstrapCredentials()).toEqual({
        email: "e2e@example.com",
        password: "secret",
      });
    });
  });
});