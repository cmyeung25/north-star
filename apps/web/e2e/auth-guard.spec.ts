import { expect, test } from "@playwright/test";

test.use({
  storageState: { cookies: [], origins: [] },
});

test("member cases still redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/en/member/cases");
  await page.waitForURL((url) => url.pathname.includes("/auth/login"));
  expect(new URL(page.url()).pathname).toContain("/auth/login");
});
