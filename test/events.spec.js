import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

import { fixturePlans } from "./fixtures.mjs";

const originals = fixturePlans;
const planApis = {
  wedding: "/api/plan",
  engagement: "/api/plan?event=engagement",
  hall: "/api/plan?event=wedding&scenario=hall",
};
const getPlan = async (request, type = "wedding") =>
  (await request.get(planApis[type])).json();
test.beforeEach(async ({ request }) => {
  for (const type of ["wedding", "engagement", "hall"]) {
    const current = await getPlan(request, type);
    expect(
      (
        await request.put(planApis[type], {
          data: { data: originals[type], revision: current.revision },
        })
      ).status(),
    ).toBe(200);
  }
});

test("rencana lamaran memiliki data tersendiri", async ({ request }) => {
  const wedding = await (await request.get("/api/plan")).json();
  const engagement = await (
    await request.get("/api/plan?event=engagement")
  ).json();
  expect(engagement.data.eventType).toBe("engagement");
  expect(engagement.data.event.guestTarget).toBe(0);
  expect(engagement.data.tasks.map((t) => t.title).join(" ")).toContain(
    "lamaran",
  );
  expect(engagement.revision).not.toBe(wedding.revision);
});

test("kartu target tamu membuka pengaturan dan menyimpan target lamaran tanpa mengubah pernikahan", async ({
  page,
  request,
}) => {
  const homeBefore = await getPlan(request);
  const hallBefore = await getPlan(request, "hall");
  await page.goto("/#lamaran/overview");
  const card = page.getByRole("button", { name: /Target tamu/ });
  await expect(card).toContainText("Klik untuk mengisi target tamu");
  await card.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Target tamu (orang)")).toHaveValue("0");
  await page.getByLabel("Target tamu (orang)").fill("55");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toContainText("55");
  await page.reload();
  await expect(card).toContainText("55");
  expect((await getPlan(request, "engagement")).data.event.guestTarget).toBe(
    55,
  );
  expect((await getPlan(request)).revision).toBe(homeBefore.revision);
  expect((await getPlan(request, "hall")).revision).toBe(hallBefore.revision);
});

test("rencana gedung adalah skenario pernikahan yang terpisah", async ({
  request,
}) => {
  const home = await getPlan(request);
  const response = await request.get("/api/plan?event=wedding&scenario=hall");
  expect(response.status()).toBe(200);
  const hall = await response.json();
  expect(hall.data.scenario).toBe("hall");
  expect(hall.data.eventType).toBe("wedding");
  expect(hall.data.event.guestTarget).toBe(300);
  expect(hall.data.package.price).toBe(0);
  expect(hall.revision).not.toBe(home.revision);
});

test("skenario gedung dapat memilih paket dan biaya sendiri tanpa menimpa rumah atau lamaran", async ({
  page,
  request,
}) => {
  const homeBefore = await getPlan(request);
  const engagementBefore = await getPlan(request, "engagement");
  await page.goto("/#budget");
  await page
    .getByRole("button", { name: "Skenario di gedung", exact: true })
    .click();
  await expect(page).toHaveURL(/#gedung\/budget$/);
  await expect(
    page.getByRole("combobox", { name: "Pilih rencana" }),
  ).toHaveValue("weddingHall");
  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Biaya tambahan gedung");
  await page.getByLabel("Harga satuan (Rp)").fill("1000000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Lihat detail Biaya tambahan gedung",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Lampiran Biaya tambahan gedung",
      exact: true,
    })
    .click();
  await page.getByLabel("Nama tautan (opsional)").fill("Penawaran gedung");
  await page.getByLabel("Alamat tautan").fill("https://example.com/gedung");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Paket & vendor", exact: true }).click();
  const selector = page.getByRole("combobox", { name: /Pilih paket/ });
  await expect(selector).toHaveValue("masjid-fatimah");
  await expect(selector.locator("option")).toHaveCount(14);
  await page
    .getByRole("button", { name: "Gunakan paket ini", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Paket digunakan", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Anggaran", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Total estimasi/ }),
  ).toContainText("40.500.000");
  await page
    .getByRole("button", { name: "Skenario di rumah", exact: true })
    .click();
  await expect(page).toHaveURL(/#budget$/);
  await expect(
    page.getByRole("button", { name: /Total estimasi/ }),
  ).toContainText("25.100.000");
  await expect(
    page.getByText("Biaya tambahan gedung", { exact: true }),
  ).not.toBeVisible();
  expect((await getPlan(request)).revision).toBe(homeBefore.revision);
  expect((await getPlan(request, "engagement")).revision).toBe(
    engagementBefore.revision,
  );
  const hall = await getPlan(request, "hall");
  expect(hall.data).toMatchObject({
    scenario: "hall",
    package: { catalogId: "masjid-fatimah", price: 39500000 },
  });
  expect(hall.data.expenses[0].attachments[0].name).toBe("Penawaran gedung");
  await page
    .getByRole("button", { name: "Skenario di gedung", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Total estimasi/ }),
  ).toContainText("40.500.000");
});

test("ekspor gedung diberi nama sendiri dan impor skenario lain ditolak", async ({
  page,
  request,
}) => {
  await page.goto("/#gedung/data");
  await expect(
    page.getByText("data/wedding-gedung.json", { exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain("pernikahan-gedung");
  expect(JSON.parse(readFileSync(await download.path(), "utf8")).scenario).toBe(
    "hall",
  );
  await page.getByRole("button", { name: "Buka editor JSON" }).click();
  await page
    .getByRole("textbox", { name: "Data JSON", exact: true })
    .fill(JSON.stringify(originals.wedding));
  await page.getByRole("button", { name: "Terapkan JSON" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Skenario JSON tidak sesuai",
  );
  const home = await getPlan(request);
  expect(
    (
      await request.put(planApis.wedding, {
        data: { data: originals.hall, revision: home.revision },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.get("/api/plan?event=wedding&scenario=invalid")).status(),
  ).toBe(400);
});

test("ponsel dapat berpindah skenario dan membuka paket gedung", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Skenario di gedung", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Skenario di gedung", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".package-summary")).toContainText(
    "Belum memilih paket gedung",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/gedung-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/gedung-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Paket & vendor", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dengan venue", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("berpindah acara menyimpan checklist lamaran tanpa mengubah pernikahan", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Pilih rencana" })
    .selectOption("engagement");
  await expect(
    page.getByRole("heading", {
      name: "Rencana lamaran, kita siapkan bersama.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Target tamu/ })).toContainText(
    "belum diatur",
  );
  await page.getByRole("link", { name: /Checklist/ }).click();
  await expect(page).toHaveURL(/#lamaran\/tasks$/);
  await page.getByRole("button", { name: "Tambah tugas", exact: true }).click();
  await page
    .getByLabel("Apa yang perlu disiapkan?")
    .fill("Hubungi keluarga untuk lamaran");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Pilih rencana" })
    .selectOption("wedding");
  await expect(
    page.getByRole("heading", { name: "Rencana kita, hari bahagia kita." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Target tamu/ })).toContainText(
    "300",
  );
  expect(
    (await getPlan(request)).data.tasks.some(
      (t) => t.title === "Hubungi keluarga untuk lamaran",
    ),
  ).toBe(false);
  await page
    .getByRole("combobox", { name: "Pilih rencana" })
    .selectOption("engagement");
  await page.getByRole("link", { name: /Checklist/ }).click();
  await page.reload();
  await expect(
    page.getByText("Hubungi keluarga untuk lamaran", { exact: true }),
  ).toBeVisible();
});

test("tanggal, tamu, anggaran, lampiran dan rundown lamaran disimpan sendiri", async ({
  page,
  request,
}) => {
  const weddingBefore = await getPlan(request);
  await page.goto("/#lamaran/overview");
  await page.getByRole("button", { name: "Atur hari kita" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Tanggal lamaran")
    .fill("2027-03-14");
  await page.getByLabel("Target tamu (orang)").fill("40");
  await page.getByLabel("Lokasi", { exact: true }).fill("Rumah keluarga");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Anggaran", exact: true }).click();
  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Konsumsi keluarga lamaran");
  await page.getByLabel("Jumlah", { exact: true }).fill("40");
  await page.getByLabel("Harga satuan (Rp)").fill("30000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Lihat detail Konsumsi keluarga lamaran",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Lampiran Konsumsi keluarga lamaran",
      exact: true,
    })
    .click();
  await page.getByLabel("Unggah dokumen atau gambar").setInputFiles({
    name: "menu-lamaran.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Menu keluarga"),
  });
  await expect(
    page.getByRole("dialog").getByText("menu-lamaran.txt", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Daftar tamu", exact: true }).click();
  await page.getByRole("button", { name: "Tambah tamu", exact: true }).click();
  await page.getByLabel("Nama tamu / keluarga").fill("Keluarga untuk lamaran");
  await page.getByLabel("Jumlah orang").fill("5");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Rundown", exact: true }).click();
  await expect(page.getByText(/prosesi lamaran/)).toBeVisible();
  await page
    .getByRole("button", { name: "Tambah kegiatan", exact: true })
    .click();
  await page.getByLabel("Nama kegiatan").fill("Sambutan lamaran");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const engagement = await getPlan(request, "engagement");
  expect(engagement.data.event).toMatchObject({
    date: "2027-03-14",
    guestTarget: 40,
    location: "Rumah keluarga",
  });
  expect(engagement.data.expenses[0]).toMatchObject({
    name: "Konsumsi keluarga lamaran",
    quantity: 40,
    unitPrice: 30000,
  });
  expect(engagement.data.expenses[0].attachments[0].name).toBe(
    "menu-lamaran.txt",
  );
  expect(engagement.data.guests[0].count).toBe(5);
  expect(engagement.data.timeline[0].title).toBe("Sambutan lamaran");
  expect((await getPlan(request)).revision).toBe(weddingBefore.revision);
});

test("pilihan Niscala di lamaran mengikuti flyer dan tetap urut harga", async ({
  page,
  request,
}) => {
  const homeBefore = await getPlan(request);
  const hallBefore = await getPlan(request, "hall");
  await page.goto("/#lamaran/package");
  const selector = page.getByRole("combobox", { name: /Pilih paket/ });
  await expect(selector).toHaveValue("niscala-drapery");
  const whatsapp = page.getByRole("link", {
    name: /WhatsApp Niscala Decoration/,
  });
  const instagram = page.getByRole("link", {
    name: "Instagram Niscala Decoration",
    exact: true,
  });
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/6285925827004");
  await expect(whatsapp).toContainText("085925827004");
  await expect(instagram).toHaveAttribute(
    "href",
    "https://www.instagram.com/niscala_decoration?dlrf=cGpremR6bWFkNDQ2",
  );
  expect(
    await selector
      .locator("option")
      .evaluateAll((options) => options.map((o) => o.value)),
  ).toEqual(["niscala-drapery", "niscala-plywood", "engagement"]);
  await expect(
    page.getByText("Ukuran dekorasi 3 × 3 meter", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Harga Rp600.000 belum termasuk ongkir.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Lihat flyer vendor" }),
  ).toHaveAttribute("href", "/vendors/niscala-kain-drapery.jpg");
  const draperyFlyer = page.getByRole("img", {
    name: "Flyer Niscala Decoration · Kain Drapery",
  });
  await expect
    .poll(() => draperyFlyer.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  await selector.selectOption("niscala-plywood");
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/6285925827004");
  await expect(instagram).toBeVisible();
  await expect(
    page.getByText("Panjang papan 2,4 meter", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Model papan bisa direquest", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Harga Rp850.000 belum termasuk ongkir.", { exact: true }),
  ).toBeVisible();
  const flyer = await request.get("/vendors/niscala-papan-plywood.jpg");
  expect(flyer.status()).toBe(200);
  expect(flyer.headers()["content-type"]).toBe("image/jpeg");
  await page.screenshot({
    path: "test-results/niscala-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/niscala-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Gunakan paket ini", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Paket digunakan", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(selector).toHaveValue("niscala-plywood");
  expect((await getPlan(request, "engagement")).data.package).toMatchObject({
    catalogId: "niscala-plywood",
    vendor: "Niscala Decoration",
    price: 850000,
  });
  expect((await getPlan(request)).revision).toBe(homeBefore.revision);
  expect((await getPlan(request, "hall")).revision).toBe(hallBefore.revision);
  const legacy = await getPlan(request, "engagement");
  delete legacy.data.package.contacts;
  const legacySaved = await request.put("/api/plan?event=engagement", {
    data: legacy,
  });
  expect(legacySaved.status()).toBe(200);
  await page.goto("/#lamaran/budget");
  await page.reload();
  await expect(
    page.getByRole("link", { name: /WhatsApp Niscala/ }),
  ).toHaveAttribute("href", "https://wa.me/6285925827004");
  await page.getByRole("button", { name: "Edit pembayaran paket" }).click();
  await expect(page.getByLabel("WhatsApp vendor")).toHaveValue("085925827004");
  await page.getByLabel("WhatsApp vendor").fill("081234567890");
  await page
    .getByLabel("Deskripsi / varian / catatan")
    .fill("Papan putih, bunga maroon");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#lamaran/package");
  await expect(
    page.getByText("Papan putih, bunga maroon", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /WhatsApp Niscala/ }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
  await selector.selectOption("engagement");
  await expect(whatsapp).toHaveCount(0);
  await expect(instagram).toHaveCount(0);
});

test("lamaran dapat memilih paket Engagement dan mengekspor JSON sendiri", async ({
  page,
  request,
}) => {
  await page.goto("/#lamaran/package");
  await page
    .getByRole("combobox", { name: /Pilih paket/ })
    .selectOption("engagement");
  await expect(
    page.getByRole("button", { name: "Lamaran", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Engagement", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gunakan paket ini" }).click();
  await expect(
    page.getByRole("button", { name: "Paket digunakan" }),
  ).toBeDisabled();
  expect((await getPlan(request, "engagement")).data.package.price).toBe(
    1499000,
  );
  expect((await getPlan(request)).data.package.price).toBe(18500000);
  await page.getByRole("link", { name: "Pengaturan & data" }).click();
  await expect(
    page.getByText("data/lamaran.json", { exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain("lamaran");
  expect(
    JSON.parse(readFileSync(await download.path(), "utf8")).eventType,
  ).toBe("engagement");
});

test("JSON acara lain dan parameter acara tidak valid ditolak", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/plan?event=invalid")).status()).toBe(400);
  const engagement = await getPlan(request, "engagement");
  expect(
    (
      await request.put("/api/plan?event=engagement", {
        data: { data: originals.wedding, revision: engagement.revision },
      })
    ).status(),
  ).toBe(400);
  await page.goto("/#lamaran/data");
  await page.getByRole("button", { name: "Buka editor JSON" }).click();
  await page
    .getByRole("textbox", { name: "Data JSON", exact: true })
    .fill(JSON.stringify(originals.wedding));
  await page.getByRole("button", { name: "Terapkan JSON" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Jenis JSON tidak sesuai",
  );
  expect((await getPlan(request, "engagement")).revision).toBe(
    engagement.revision,
  );
});

test("rencana lamaran dapat diakses dan diganti dari ponsel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Buka menu" }).click();
  await page
    .getByRole("combobox", { name: "Pilih rencana" })
    .selectOption("engagement");
  await expect(
    page.getByRole("heading", {
      name: "Rencana lamaran, kita siapkan bersama.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/lamaran-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/lamaran-desktop.png",
    fullPage: true,
  });
});
