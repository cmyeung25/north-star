import { memberCasesPath } from "../routes/canonicalRoutes";
import { defaultLocale, locales, type Locale } from "../../src/i18n/routing";

export const E2E_SECRET_HEADER = "x-ns-e2e-secret";

const UNAUTHORIZED_ERROR = "E2EAuthUnauthorizedError";

const resolveRequiredEnv = (name: "E2E_AUTH_EMAIL" | "E2E_AUTH_PASSWORD" | "E2E_AUTH_SECRET") => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required E2E auth environment variable: ${name}`);
  }
  return value;
};

const normalizeLocale = (value?: string | null): Locale =>
  locales.includes(value as Locale) ? (value as Locale) : defaultLocale;

export function isE2EBootstrapEnabled() {
  return process.env.NODE_ENV === "development" && process.env.E2E_AUTH_BOOTSTRAP === "1";
}

export function assertValidE2ESecret(request: Request) {
  const expectedSecret = resolveRequiredEnv("E2E_AUTH_SECRET");
  const actualSecret = request.headers.get(E2E_SECRET_HEADER);

  if (!actualSecret || actualSecret !== expectedSecret) {
    const error = new Error("Invalid E2E auth secret.");
    error.name = UNAUTHORIZED_ERROR;
    throw error;
  }
}

export function isE2EUnauthorizedError(error: unknown) {
  return error instanceof Error && error.name === UNAUTHORIZED_ERROR;
}

export function resolveE2ERedirect(locale?: string | null) {
  return memberCasesPath(normalizeLocale(locale));
}

export function getE2EBootstrapCredentials() {
  return {
    email: resolveRequiredEnv("E2E_AUTH_EMAIL"),
    password: resolveRequiredEnv("E2E_AUTH_PASSWORD"),
  };
}