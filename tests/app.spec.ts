import { test, expect } from "@playwright/test";

test.describe("AlienBuster Web App", () => {
  test("loads home page with proper title, brand headers and action controls", async ({ page }) => {
    await page.goto("/");

    // Verify page title
    await expect(page).toHaveTitle(/AlienBuster \| Invasive Species Early Warning System/);

    // Verify brand header elements
    const brandButton = page.locator("header").getByRole("button", { name: "Go to home" });
    await expect(brandButton).toBeVisible();
    await expect(brandButton).toContainText("AlienBuster");

    // Verify hero tagline
    const heroTitle = page.getByRole("heading", { name: /Calm signals/i });
    await expect(heroTitle).toBeVisible();

    // Verify header action button exists
    const newReportBtn = page.locator("header").getByRole("button", { name: /New Report/i });
    await expect(newReportBtn).toBeVisible();
  });

  test("verifies favicon and manifest metadata", async ({ page }) => {
    await page.goto("/");

    const faviconSvg = page.locator('link[rel="icon"][type="image/svg+xml"]');
    await expect(faviconSvg).toHaveAttribute("href", /\/favicon\.svg/);

    const faviconIco = page.locator('link[rel="icon"]:not([type])');
    await expect(faviconIco).toHaveAttribute("href", /\/favicon\.ico/);

    const responseSvg = await page.request.get("/favicon.svg");
    expect(responseSvg.status()).toBe(200);

    const responseIco = await page.request.get("/favicon.ico");
    expect(responseIco.status()).toBe(200);
  });

  test("navigates across all key operational sections", async ({ page }) => {
    // 1. How it works
    await page.goto("/how-it-works");
    await expect(page).toHaveURL(/.*how-it-works/);
    await expect(page.getByText(/How AlienBuster Works/i)).toBeVisible();

    // 2. Hotspots
    await page.goto("/hotspots");
    await expect(page).toHaveURL(/.*hotspots/);
    await expect(page.getByText(/Hotspots & Clusters/i)).toBeVisible();

    // 3. Outbreaks
    await page.goto("/outbreaks");
    await expect(page).toHaveURL(/.*outbreaks/);
    await expect(page.getByText(/Outbreak map/i)).toBeVisible();

    // 4. Satellite Intel & Correlation
    await page.goto("/intel");
    await expect(page).toHaveURL(/.*intel/);
    await expect(page.getByText(/Satellite & Correlation/i)).toBeVisible();

    // 5. Submit page & BioCLIP upload form
    await page.goto("/submit");
    await expect(page).toHaveURL(/.*submit/);
    await expect(page.getByText(/Report Sighting/i)).toBeVisible();
    await expect(page.getByText(/BioCLIP species identification/i)).toBeVisible();

    // 6. Test specimen detection without requiring local Python server
    const sampleBtn = page.getByRole("button", { name: /Use Sample Specimen/i });
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Verify detection results render
    await expect(page.getByText(/Invasive Threat/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/neural confidence/i)).toBeVisible();
  });
});
