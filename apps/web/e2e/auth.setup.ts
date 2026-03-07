import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const locale = process.env.E2E_LOCALE ?? "en";
const memberCasesPath = locale === "zh-HK" ? "/member/cases" : "/" + locale + "/member/cases";
const authFile = path.join(__dirname, ".auth", "e2e-user.json");
const secret = process.env.E2E_AUTH_SECRET;

const callJsonEndpoint = async (
  page: import("@playwright/test").Page,
  input: {
    url: string;
    method: "POST";
    body?: Record<string, unknown>;
  },
) =>
  page.evaluate(
    async ({ url, method, body, secretHeader, requestSecret }) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };

      if (requestSecret) {
        headers[secretHeader] = requestSecret;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        body: text ? JSON.parse(text) : null,
      };
    },
    {
      url: input.url,
      method: input.method,
      body: input.body,
      secretHeader: "x-ns-e2e-secret",
      requestSecret: secret,
    },
  );

test("bootstrap authenticated storage state", async ({ page }) => {
  expect(
    secret,
    "Missing E2E_AUTH_SECRET for Playwright bootstrap. Set E2E_AUTH_BOOTSTRAP, E2E_AUTH_SECRET, E2E_AUTH_EMAIL, and E2E_AUTH_PASSWORD in apps/web/.env.local.",
  ).toBeTruthy();

  await page.goto("/" + locale);

  const bootstrap = await callJsonEndpoint(page, {
    url: "/api/e2e/auth/bootstrap",
    method: "POST",
    body: { locale },
  });

  expect(bootstrap.ok, JSON.stringify(bootstrap.body)).toBe(true);
  expect(bootstrap.body?.redirectTo).toBe(memberCasesPath);

  const reset = await callJsonEndpoint(page, {
    url: "/api/e2e/auth/reset",
    method: "POST",
  });

  expect(reset.ok, JSON.stringify(reset.body)).toBe(true);
  expect(typeof reset.body?.deletedCaseCount).toBe("number");

  await page.goto(bootstrap.body?.redirectTo ?? memberCasesPath);
  await page.waitForURL((url) => url.pathname === memberCasesPath);
  expect(new URL(page.url()).pathname).toBe(memberCasesPath);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});