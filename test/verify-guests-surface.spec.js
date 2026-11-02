import { test, expect } from "@playwright/test";

test("verifikasi visual dan interaksi rendered surface daftar tamu pada desktop dan mobile", async ({
  page,
}) => {
  // 1. Desktop surface check (1440 x 900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#guests");
  await expect(page.locator(".guest-summary")).toBeVisible();

  // Verifikasi 3 kartu metrik ringkasan awal
  const summaryCards = page.locator(".guest-summary > div");
  await expect(summaryCards).toHaveCount(3);
  await expect(summaryCards.nth(0)).toContainText("total 0 undangan masuk");
  await expect(summaryCards.nth(1)).toContainText(
    "tamu dari Fadel (0 undangan)",
  );
  await expect(summaryCards.nth(2)).toContainText(
    "tamu dari Diah (0 undangan)",
  );

  // Verifikasi tab filter tidak lagi ada opsi konfirmasi hadir
  const tabs = page.locator(".list-toolbar .filter-tabs button");
  await expect(page.getByText("Belum konfirmasi")).toHaveCount(0);
  await expect(page.getByText("Hadir")).toHaveCount(0);
  await expect(page.getByText("Tidak hadir")).toHaveCount(0);
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveText("Semua tamu");
  await expect(tabs.nth(1)).toHaveText("Tamu Fadel");
  await expect(tabs.nth(2)).toHaveText("Tamu Diah");

  // Tambah tamu 1: Pihak Fadel
  await page.getByRole("button", { name: "Tambah tamu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Nama tamu / keluarga").fill("Keluarga Om Anton");
  await page.getByLabel("Jumlah orang").fill("4");
  // Cek bahwa dropdown pihak keluarga memiliki Tamu Fadel & Tamu Diah
  await expect(page.getByLabel("Pihak keluarga")).toHaveValue("Fadel");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Tambah tamu 2: Pihak Diah
  await page.getByRole("button", { name: "Tambah tamu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Nama tamu / keluarga").fill("Keluarga Bude Siti");
  await page.getByLabel("Pihak keluarga").selectOption("Diah");
  await page.getByLabel("Jumlah orang").fill("3");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Verifikasi pembaruan metrik ringkasan
  await expect(summaryCards.nth(0).locator("strong")).toContainText("7");
  await expect(summaryCards.nth(0)).toContainText("total 2 undangan masuk");
  await expect(summaryCards.nth(1).locator("strong")).toContainText("4");
  await expect(summaryCards.nth(1)).toContainText(
    "tamu dari Fadel (1 undangan)",
  );
  await expect(summaryCards.nth(2).locator("strong")).toContainText("3");
  await expect(summaryCards.nth(2)).toContainText(
    "tamu dari Diah (1 undangan)",
  );

  // Verifikasi kolom tabel (tidak ada RSVP, ada Pihak / Tamu dari)
  const headers = page.locator("table thead th");
  await expect(headers.nth(0)).toHaveText("Nama tamu");
  await expect(headers.nth(1)).toHaveText("Pihak / Tamu dari");
  await expect(headers.nth(2)).toHaveText("Jumlah orang");
  await expect(page.getByText("RSVP")).toHaveCount(0);

  // Verifikasi badge pihak keluarga
  const badgeFadel = page.locator(".side-badge.fadel");
  await expect(badgeFadel).toHaveText("Tamu Fadel");
  const badgeDiah = page.locator(".side-badge.diah");
  await expect(badgeDiah).toHaveText("Tamu Diah");

  // Tangkap screenshot Desktop
  await page.screenshot({
    path: "test-results/guests-desktop.png",
    fullPage: true,
  });

  // Verifikasi interaksi filtering Tab Tamu Fadel
  await tabs.nth(1).click();
  await expect(page.getByText("Keluarga Om Anton")).toBeVisible();
  await expect(page.getByText("Keluarga Bude Siti")).toHaveCount(0);

  // Verifikasi interaksi filtering Tab Tamu Diah
  await tabs.nth(2).click();
  await expect(page.getByText("Keluarga Om Anton")).toHaveCount(0);
  await expect(page.getByText("Keluarga Bude Siti")).toBeVisible();

  // Kembali ke semua tamu
  await tabs.nth(0).click();
  await expect(page.getByText("Keluarga Om Anton")).toBeVisible();
  await expect(page.getByText("Keluarga Bude Siti")).toBeVisible();

  // 2. Mobile surface check (390 x 844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".guest-summary")).toBeVisible();
  await expect(page.getByText("Keluarga Om Anton")).toBeVisible();

  // Cek overflow horizontal pada mobile viewport
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  const clientWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  // Tangkap screenshot Mobile
  await page.screenshot({
    path: "test-results/guests-mobile.png",
    fullPage: true,
  });
});
