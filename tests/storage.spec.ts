import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function signIn(page: Page) {
  const password = process.env.BJJ_PASSWORD;
  if (!password) throw new Error("BJJ_PASSWORD is required.");
  await page.goto("/");
  await page.getByLabel("Your private journal password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.getByText("Select a day to view or add a journal entry.")).toBeVisible();
}

test("private access rejects anonymous, incorrect-password and cross-origin requests", async ({ page, request, baseURL }) => {
  expect((await request.get("/api/entries")).status()).toBe(401);
  expect((await request.put("/api/entries", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/entries/import", { data: {} })).status()).toBe(401);
  await page.goto("/");
  await page.getByLabel("Your private journal password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("didn’t match");
  await signIn(page);
  expect((await page.request.put("/api/entries", { headers: { Origin: "https://untrusted.example" }, data: {} })).status()).toBe(403);
  expect((await page.request.put("/api/entries", { headers: { Origin: baseURL! }, data: { date: "2026-02-30", entry: { text: "bad date", sessionTypes: [] } } })).status()).toBe(400);
  expect((await page.request.put("/api/entries", { headers: { Origin: baseURL! }, data: { date: "2026-01-01", entry: { text: "bad tags", sessionTypes: [42] } } })).status()).toBe(400);
  expect((await page.request.post("/api/entries/import", { headers: { Origin: baseURL! }, data: { "invalid-date": "legacy" } })).status()).toBe(400);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Your private journal password")).toBeVisible();
  expect((await page.request.get("/api/entries")).status()).toBe(401);
});

test("Neon saves, edits, persists across browsers, imports safely, and deletes", async ({ page, browser, baseURL }) => {
  await signIn(page);
  const initial = await (await page.request.get("/api/entries")).json();
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const available = Array.from({ length: 28 }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`).filter(date => !Object.hasOwn(initial, date));
  if (available.length < 2) throw new Error("Need two unused dates this month for non-destructive verification.");
  const [date, legacyDate] = available;
  const marker = `Storage verification ${Date.now()}`;
  const headers = { Origin: baseURL! };
  const clean = async (key: string) => {
    const response = await page.request.put("/api/entries", { headers, data: { date: key, entry: { text: "", sessionTypes: [] } } });
    expect(response.ok()).toBeTruthy();
  };
  try {
    await page.getByRole("button", { name: String(Number(date.slice(-2))), exact: true }).click();
    await page.getByRole("button", { name: "Add Entry", exact: true }).click();
    await page.getByLabel("Training notes").fill(marker);
    await page.getByRole("button", { name: "Class", exact: true }).click();
    await page.getByRole("button", { name: "Gi", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved to your journal");
    await page.reload();
    await page.getByRole("button", { name: String(Number(date.slice(-2))), exact: true }).click();
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    await expect(page.getByText("Gi", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Edit Entry", exact: true }).click();
    await page.getByLabel("Training notes").fill(`${marker} edited`);
    await page.route("**/api/entries", route => route.request().method() === "PUT" ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue());
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Could not save");
    await expect(page.getByLabel("Training notes")).toHaveValue(`${marker} edited`);
    await page.unroute("**/api/entries");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`${marker} edited`, { exact: true })).toBeVisible();

    const secondContext = await browser.newContext({ baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage);
      await secondPage.getByRole("button", { name: String(Number(date.slice(-2))), exact: true }).click();
      await expect(secondPage.getByText(`${marker} edited`, { exact: true })).toBeVisible();
      expect(await secondPage.evaluate(() => localStorage.getItem("bjj-log-entries"))).toBeNull();
    } finally { await secondContext.close(); }

    const legacy = { [date]: "Do not overwrite the cloud entry", [legacyDate]: `${marker} legacy` };
    await page.evaluate(value => localStorage.setItem("bjj-log-entries", JSON.stringify(value)), legacy);
    await page.reload();
    await page.getByRole("button", { name: "Import browser notes" }).click();
    await expect(page.getByRole("status")).toContainText("Imported 1 notes");
    const afterImport = await (await page.request.get("/api/entries")).json();
    expect(afterImport[date]).toEqual({ text: `${marker} edited`, sessionTypes: ["class"], attire: "gi" });
    // Legacy string notes predate the field, so they import as unrecorded rather than guessed.
    expect(afterImport[legacyDate]).toEqual({ text: `${marker} legacy`, sessionTypes: [], attire: null });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bjj-log-entries")!))).toEqual(legacy);
    const repeat = await page.request.post("/api/entries/import", { headers, data: legacy });
    expect(await repeat.json()).toEqual({ imported: 0 });

    await page.getByRole("button", { name: String(Number(date.slice(-2))), exact: true }).click();
    await page.getByRole("button", { name: "Edit Entry", exact: true }).click();
    await page.getByLabel("Training notes").fill("");
    await page.getByRole("button", { name: "Class", exact: true }).click();
    // Re-picking the active choice clears it; the day only disappears once attire is gone too.
    await page.getByRole("button", { name: "Gi", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("No entry for this day yet.")).toBeVisible();
    await page.reload();
    expect((await (await page.request.get("/api/entries")).json())[date]).toBeUndefined();
  } finally {
    await clean(date);
    await clean(legacyDate);
  }
  const final = await (await page.request.get("/api/entries")).json();
  expect(final).toEqual(initial);
});
