import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

import { fixturePlans } from "./fixtures.mjs";

const original = fixturePlans.wedding;
const currentPlan = async (request) => (await request.get("/api/plan")).json();

test.beforeEach(async ({ request }) => {
  const current = await currentPlan(request);
  const response = await request.put("/api/plan", {
    data: { data: original, revision: current.revision },
  });
  expect(response.status()).toBe(200);
});

test("ringkasan menampilkan data nyata dan tidak memiliki error browser", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Rencana kita, hari bahagia kita." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Estimasi anggaran/ }),
  ).toContainText("25.100.000");
  await expect(page.getByRole("button", { name: /Target tamu/ })).toContainText(
    "300",
  );
  await expect(page.locator(".progress-ring")).toContainText("8");
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("checklist dapat ditambah, diselesaikan, diedit, dan dihapus", async ({
  page,
  request,
}) => {
  await page.goto("/#tasks");
  await page.getByRole("button", { name: "Tambah tugas", exact: true }).click();
  await page.getByLabel("Apa yang perlu disiapkan?").fill("Pesan souvenir");
  await page
    .getByRole("dialog")
    .getByLabel("Penanggung jawab")
    .selectOption("Kamu");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Selesaikan: Pesan souvenir" })
    .click();
  await expect(
    page.getByRole("button", { name: "Buka kembali: Pesan souvenir" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Edit tugas Pesan souvenir" }).click();
  await page.getByLabel("Apa yang perlu disiapkan?").fill("Pesan 150 souvenir");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(
    page.getByText("Pesan 150 souvenir", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hapus tugas Pesan 150 souvenir" })
    .click();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(
    page.getByText("Pesan 150 souvenir", { exact: true }),
  ).not.toBeVisible();
  expect((await currentPlan(request)).data.tasks).toHaveLength(
    original.tasks.length,
  );
});

test("urutan checklist tersimpan dan ringkasan mengikuti termasuk saat difilter", async ({
  page,
  request,
}) => {
  const engagementBefore = await (
    await request.get("/api/plan?event=engagement")
  ).json();
  const current = await currentPlan(request);
  const data = structuredClone(original);
  data.tasks = [
    { ...data.tasks[0], id: "done", title: "Tugas selesai", done: true },
    {
      ...data.tasks[1],
      id: "high",
      title: "Tugas prioritas",
      priority: "high",
      done: false,
    },
    {
      ...data.tasks[2],
      id: "normal",
      title: "Tugas biasa",
      priority: "normal",
      done: false,
      conclusion: "Pilihan sudah disepakati",
    },
    {
      ...data.tasks[3],
      id: "later",
      title: "Tugas belakangan",
      priority: "low",
      done: false,
    },
  ];
  data.expenses[0].taskIds = ["normal"];
  expect(
    (
      await request.put("/api/plan", {
        data: { data, revision: current.revision },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#tasks");
  await expect(
    page.getByRole("button", {
      name: "Naikkan tugas Tugas selesai",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Turunkan tugas Tugas belakangan",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Naikkan tugas Tugas biasa", exact: true })
    .click();
  await expect(page.locator(".full-task-list .task-name > strong")).toHaveText([
    "Tugas selesai",
    "Tugas biasa",
    "Tugas prioritas",
    "Tugas belakangan",
  ]);
  await page.reload();
  await expect(page.locator(".full-task-list .task-name > strong")).toHaveText([
    "Tugas selesai",
    "Tugas biasa",
    "Tugas prioritas",
    "Tugas belakangan",
  ]);
  await page.goto("/#overview");
  await expect(page.locator(".task-preview .task-name > strong")).toHaveText([
    "Tugas biasa",
    "Tugas prioritas",
    "Tugas belakangan",
  ]);
  await page.goto("/#tasks");
  await page
    .getByRole("button", { name: "Belum selesai", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Naikkan tugas Tugas biasa",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Turunkan tugas Tugas biasa", exact: true })
    .click();
  await expect(page.locator(".full-task-list .task-name > strong")).toHaveText([
    "Tugas prioritas",
    "Tugas biasa",
    "Tugas belakangan",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", {
      name: "Naikkan tugas Tugas belakangan",
      exact: true,
    })
    .click();
  await expect(page.locator(".full-task-list .task-name > strong")).toHaveText([
    "Tugas prioritas",
    "Tugas belakangan",
    "Tugas biasa",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Tutup notifikasi", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/checklist-order-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  const saved = (await currentPlan(request)).data;
  expect(saved.tasks.map((task) => task.id)).toEqual([
    "done",
    "high",
    "later",
    "normal",
  ]);
  expect(saved.tasks.find((task) => task.id === "normal").conclusion).toBe(
    "Pilihan sudah disepakati",
  );
  expect(saved.expenses[0].taskIds).toEqual(["normal"]);
  expect(
    (await (await request.get("/api/plan?event=engagement")).json()).revision,
  ).toBe(engagementBefore.revision);
  await page.goto("/#overview");
  await expect(page.locator(".task-preview .task-name > strong")).toHaveText([
    "Tugas prioritas",
    "Tugas belakangan",
    "Tugas biasa",
  ]);
});

test("anggaran memilih satu checklist, status dibagikan, dan penghapusan tugas membersihkan hubungan", async ({
  page,
  request,
}) => {
  const engagementBefore = await (
    await request.get("/api/plan?event=engagement")
  ).json();
  const hallBefore = await (
    await request.get("/api/plan?event=wedding&scenario=hall")
  ).json();
  await page.goto("/#budget");
  await page
    .getByRole("button", {
      name: "Hubungkan checklist untuk Katering tamu",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Checklist yang ada", { exact: true })
    .selectOption("wedding-5");
  await page
    .getByLabel("Checklist yang ada", { exact: true })
    .selectOption("wedding-2");
  await expect(
    page
      .getByLabel("Checklist yang ada", { exact: true })
      .locator("option")
      .filter({ hasText: /lamaran/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Edit pembayaran paket", exact: true })
    .click();
  await page
    .getByLabel("Checklist yang ada", { exact: true })
    .selectOption("wedding-2");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  const catering = page.getByRole("row").filter({ hasText: "Katering tamu" });
  const packageRow = page.getByRole("row").filter({ hasText: "Paket utama" });
  await expect(
    catering.getByRole("button", {
      name: "Buka tugas Konfirmasi vendor",
      exact: true,
    }),
  ).toBeVisible();
  await catering
    .getByRole("button", { name: "Selesaikan: Konfirmasi vendor", exact: true })
    .click();
  await expect(
    catering.getByRole("button", {
      name: "Buka kembali: Konfirmasi vendor",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    packageRow.getByRole("button", {
      name: "Buka kembali: Konfirmasi vendor",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(catering.locator(".budget-task-heading")).toContainText(
    "1 / 1 selesai",
  );
  await page
    .getByRole("button", { name: "Tutup notifikasi", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/checklist-budget-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/#tasks");
  const task = page.locator(".task-row").filter({
    has: page.getByRole("button", {
      name: "Edit tugas Konfirmasi vendor",
      exact: true,
    }),
  });
  await expect(
    task.getByRole("button", {
      name: "Buka anggaran Katering tamu",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    task.getByRole("button", {
      name: "Buka anggaran Silver · In home",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/checklist-linked-budgets-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await task
    .getByRole("button", { name: "Buka anggaran Katering tamu", exact: true })
    .click();
  await expect(page.getByLabel("Nama kebutuhan")).toHaveValue("Katering tamu");
  await page.getByLabel("Checklist yang ada", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Hapus tugas Konfirmasi vendor", exact: true })
    .click();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = (await currentPlan(request)).data;
  expect(saved.package.taskIds).toEqual([]);
  expect(saved.expenses[0].taskIds).toEqual([]);
  expect(saved.package.price).toBe(18500000);
  expect(saved.expenses[0].unitPrice).toBe(20000);
  expect(saved.packagePaid).toBe(0);
  expect(
    (await (await request.get("/api/plan?event=engagement")).json()).revision,
  ).toBe(engagementBefore.revision);
  expect(
    (await (await request.get("/api/plan?event=wedding&scenario=hall")).json())
      .revision,
  ).toBe(hallBefore.revision);
});

test("jawaban checklist lama dapat diisi, dibaca dari anggaran, diperbarui, dan dikosongkan", async ({
  page,
  request,
}) => {
  await page.goto("/#tasks");
  await page
    .getByRole("button", { name: "Edit tugas Tentukan anggaran", exact: true })
    .click();
  const answer = page.getByLabel("Jawaban / kesimpulan", { exact: true });
  await expect(answer).toHaveValue("");
  await answer.fill("Disepakati Rp35.000.000.\nCadangan Rp2.000.000.");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".task-conclusion")).toContainText(
    "Cadangan Rp2.000.000.",
  );
  await page
    .getByRole("button", { name: "Selesaikan: Tentukan anggaran", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Buka kembali: Tentukan anggaran",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#budget");
  await page
    .getByRole("button", { name: "Edit biaya Katering tamu", exact: true })
    .click();
  await page
    .getByLabel("Checklist yang ada", { exact: true })
    .selectOption("wedding-3");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(".budget-task-links .task-conclusion"),
  ).toContainText("Cadangan Rp2.000.000.");
  await page
    .getByRole("button", { name: "Buka tugas Tentukan anggaran", exact: true })
    .click();
  await expect(answer).toHaveValue(
    "Disepakati Rp35.000.000.\nCadangan Rp2.000.000.",
  );
  await answer.fill("Keputusan akhir Rp32.000.000.");
  await page.setViewportSize({ width: 390, height: 844 });
  await answer.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/task-conclusion-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await currentPlan(request)).data.tasks.find(
      (task) => task.id === "wedding-3",
    ),
  ).toMatchObject({ conclusion: "Keputusan akhir Rp32.000.000.", done: true });
  await page
    .getByRole("button", { name: "Buka tugas Tentukan anggaran", exact: true })
    .click();
  await answer.fill("");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".budget-task-links .task-conclusion")).toHaveCount(
    0,
  );
  expect(
    (await currentPlan(request)).data.tasks.find(
      (task) => task.id === "wedding-3",
    ).conclusion,
  ).toBe("");
});

test("anggaran dapat membuat checklist baru secara atomik, membatalkan, dan berpindah ke pilihan yang ada", async ({
  page,
  request,
}) => {
  const before = await currentPlan(request);
  await page.goto("/#budget");
  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Transport vendor");
  await page
    .getByRole("radio", { name: "Buat checklist baru", exact: true })
    .check();
  await page
    .getByLabel("Judul checklist baru", { exact: true })
    .fill("Jangan tersimpan");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  expect((await currentPlan(request)).revision).toBe(before.revision);

  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Transport vendor");
  await page.getByLabel("Harga satuan (Rp)").fill("500000");
  await page
    .getByRole("radio", { name: "Buat checklist baru", exact: true })
    .check();
  await expect(
    page.getByLabel("Judul checklist baru", { exact: true }),
  ).toHaveValue("Siapkan Transport vendor");
  await page.getByLabel("Judul checklist baru", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "tugas",
  );
  expect((await currentPlan(request)).revision).toBe(before.revision);
  await page
    .getByLabel("Judul checklist baru", { exact: true })
    .fill("Pesan kendaraan vendor");
  await page
    .getByLabel("Kategori checklist baru", { exact: true })
    .fill("Transportasi");
  await page
    .getByLabel("Penanggung jawab checklist baru", { exact: true })
    .selectOption("Kamu");
  await page
    .getByLabel("Target tanggal checklist baru", { exact: true })
    .fill("2027-01-02");
  await page
    .getByLabel("Prioritas checklist baru", { exact: true })
    .selectOption("high");
  await page
    .getByLabel("Jawaban / kesimpulan", { exact: true })
    .fill("Gunakan dua mobil keluarga.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("group", { name: "Checklist terkait", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/checklist-create-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  let saved = (await currentPlan(request)).data;
  const task = saved.tasks.find(
    (task) => task.title === "Pesan kendaraan vendor",
  );
  expect(task).toMatchObject({
    category: "Transportasi",
    owner: "Kamu",
    dueDate: "2027-01-02",
    priority: "high",
    done: false,
    conclusion: "Gunakan dua mobil keluarga.",
  });
  expect(saved.tasks).toHaveLength(original.tasks.length + 1);
  expect(
    saved.expenses.find((expense) => expense.name === "Transport vendor")
      .taskIds,
  ).toEqual([task.id]);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Buka tugas Pesan kendaraan vendor",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Edit pembayaran paket", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Buat checklist baru", exact: true })
    .check();
  await page
    .getByLabel("Judul checklist baru", { exact: true })
    .fill("Konfirmasi paket baru");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  saved = (await currentPlan(request)).data;
  const packageTask = saved.tasks.find(
    (task) => task.title === "Konfirmasi paket baru",
  );
  expect(saved.package.taskIds).toEqual([packageTask.id]);
  expect(saved.tasks).toHaveLength(original.tasks.length + 2);

  await page
    .getByRole("button", { name: "Edit biaya Transport vendor", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Buat checklist baru", exact: true })
    .check();
  await page
    .getByLabel("Judul checklist baru", { exact: true })
    .fill("Draft yang tidak dibuat");
  await page
    .getByRole("radio", { name: "Pilih checklist yang ada", exact: true })
    .check();
  await page
    .getByLabel("Checklist yang ada", { exact: true })
    .selectOption(packageTask.id);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  saved = (await currentPlan(request)).data;
  expect(saved.tasks).toHaveLength(original.tasks.length + 2);
  expect(
    saved.expenses.find((expense) => expense.name === "Transport vendor")
      .taskIds,
  ).toEqual([packageTask.id]);
});

test("tamu tersimpan setelah reload dan RSVP menghitung jumlah orang", async ({
  page,
  request,
}) => {
  await page.goto("/#guests");
  await page.getByRole("button", { name: "Tambah tamu", exact: true }).click();
  await page.getByLabel("Nama tamu / keluarga").fill("Keluarga Budi");
  await page.getByLabel("Jumlah orang").fill("4");
  await page.getByLabel("Konfirmasi kehadiran").selectOption("confirmed");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.getByText("Keluarga Budi", { exact: true })).toBeVisible();
  expect((await currentPlan(request)).data.guests[0]).toMatchObject({
    name: "Keluarga Budi",
    count: 4,
    status: "confirmed",
  });
  await expect(page.locator(".guest-summary")).toContainText("4");
});

test("biaya tambahan dan pembayaran mengubah total yang benar", async ({
  page,
  request,
}) => {
  await page.goto("/#budget");
  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Souvenir");
  await page.getByLabel("Jumlah", { exact: true }).fill("100");
  await page.getByLabel("Harga satuan (Rp)").fill("3000");
  await page.getByLabel("Sudah dibayar (Rp)").fill("100000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Total estimasi/ }),
  ).toContainText("25.400.000");
  await page.getByRole("button", { name: "Edit pembayaran paket" }).click();
  await page.getByLabel("Total dibayar (Rp)").fill("5000000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(
    page.getByRole("button", { name: /Pembayaran tercatat/ }),
  ).toContainText("5.100.000");
  expect((await currentPlan(request)).data.packagePaid).toBe(5000000);
});

test("anggaran dapat dicari, difilter, dibaca detailnya, dan diedit tanpa kehilangan konteks", async ({
  page,
  request,
}) => {
  const before = await currentPlan(request);
  const data = structuredClone(original);
  data.expenses.push({
    id: "rings-detail",
    name: "Cincin keluarga",
    category: "Seserahan",
    quantity: 2,
    unitPrice: 600000,
    paid: 300000,
    status: "confirmed",
    note: "Emas putih\nUkuran 12 dan 16",
    vendor: "Toko Emas",
    contacts: { whatsapp: "085925827004", link: "https://example.com/quote" },
    taskIds: ["wedding-2"],
    attachments: [
      {
        id: "quote-detail",
        kind: "link",
        name: "Penawaran cincin",
        url: "https://example.com/quote",
      },
    ],
  });
  expect(
    (
      await request.put("/api/plan", {
        data: { data, revision: before.revision },
      })
    ).ok(),
  ).toBe(true);
  const revision = (await currentPlan(request)).revision;
  await page.goto("/#budget");
  await page.getByLabel("Cari kebutuhan atau vendor").fill("Toko Emas");
  await expect(
    page
      .getByRole("table", { name: "Rincian kebutuhan anggaran" })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await page
    .getByLabel("Filter pembayaran", { exact: true })
    .selectOption("paid");
  await expect(
    page.getByText("Tidak ada kebutuhan yang cocok.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filter", exact: true }).click();
  await page
    .getByLabel("Filter kategori", { exact: true })
    .selectOption("Seserahan");
  await page
    .getByLabel("Filter pembayaran", { exact: true })
    .selectOption("partial");
  await page
    .getByRole("button", { name: "Lihat detail Cincin keluarga", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Cincin keluarga", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".budget-item-amounts")).toContainText(
    "1.200.000",
  );
  await expect(dialog.locator(".budget-item-amounts")).toContainText("900.000");
  await expect(dialog).toContainText("Ukuran 12 dan 16");
  await expect(dialog.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
    "href",
    "https://wa.me/6285925827004",
  );
  await expect(
    dialog.getByRole("link", { name: "Penawaran cincin", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Buka tugas Konfirmasi vendor",
      exact: true,
    }),
  ).toBeVisible();
  expect((await currentPlan(request)).revision).toBe(revision);
  await dialog
    .getByRole("button", { name: "Edit anggaran", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Kebutuhan & biaya", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Vendor & kontak", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Harga satuan (Rp)")).toHaveValue("600.000");
  await page.getByLabel("Sudah dibayar (Rp)").fill("500000");
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Lihat detail Cincin keluarga", exact: true })
    .click();
  await expect(dialog.locator(".budget-item-amounts")).toContainText("700.000");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/budget-item-detail-mobile.png",
    animations: "disabled",
  });
  await dialog
    .getByRole("button", { name: "Edit anggaran", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/budget-edit-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  const saved = (await currentPlan(request)).data.expenses.find(
    (expense) => expense.id === "rings-detail",
  );
  expect(saved).toMatchObject({
    paid: 500000,
    note: "Emas putih\nUkuran 12 dan 16",
    taskIds: ["wedding-2"],
    attachments: [{ id: "quote-detail" }],
  });
});

test("nominal otomatis memakai titik, kursor dapat diedit, dan JSON tetap menyimpan angka", async ({
  page,
  request,
}) => {
  await page.goto("/#budget");
  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Dekor format nominal");
  await page.getByLabel("Jumlah", { exact: true }).fill("2");
  const price = page.getByLabel("Harga satuan (Rp)");
  await price.fill("");
  await price.pressSequentially("1250000");
  await expect(price).toHaveValue("1.250.000");
  await expect(price).toHaveAttribute("inputmode", "numeric");
  await price.evaluate((element) => element.setSelectionRange(2, 2));
  await price.press("9");
  await expect(price).toHaveValue("19.250.000");
  expect(await price.evaluate((element) => element.selectionStart)).toBe(2);
  await price.fill("1.250.000");
  await price.evaluate((element) => element.setSelectionRange(2, 2));
  await price.press("Backspace");
  await expect(price).toHaveValue("250.000");
  await price.fill("1.250.000");
  await price.evaluate((element) => element.setSelectionRange(1, 1));
  await price.press("Delete");
  await expect(price).toHaveValue("150.000");
  await price.fill("Rp 1.250.000");
  await expect(price).toHaveValue("1.250.000");
  await page.getByLabel("Sudah dibayar (Rp)").fill("500000");
  await expect(page.getByLabel("Sudah dibayar (Rp)")).toHaveValue("500.000");
  await expect(page.locator(".form-subtotal")).toContainText("2.500.000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await currentPlan(request)).data.expenses.find(
      (expense) => expense.name === "Dekor format nominal",
    ),
  ).toMatchObject({ quantity: 2, unitPrice: 1250000, paid: 500000 });
  await page
    .getByRole("button", { name: "Edit pembayaran paket", exact: true })
    .click();
  await expect(page.getByLabel("Harga paket (Rp)")).toHaveValue("18.500.000");
  await page.getByLabel("Harga paket (Rp)").fill("19000000");
  await page.getByLabel("Total dibayar (Rp)").fill("1500000");
  await expect(page.getByLabel("Total dibayar (Rp)")).toHaveValue("1.500.000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: /Total estimasi/ }).click();
  await page.getByLabel("Batas anggaran (Rp)").fill("35000000");
  await expect(page.getByLabel("Batas anggaran (Rp)")).toHaveValue(
    "35.000.000",
  );
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  const saved = (await currentPlan(request)).data;
  expect(saved.package.price).toBe(19000000);
  expect(saved.packagePaid).toBe(1500000);
  expect(saved.wedding.budgetTarget).toBe(35000000);
});

test("format nominal tetap menolak kosong, nominal berlebih, dan pembayaran di atas subtotal", async ({
  page,
  request,
}) => {
  const before = await currentPlan(request);
  await page.goto("/#budget");
  await page
    .getByRole("button", { name: "Edit biaya Katering tamu", exact: true })
    .click();
  const price = page.getByLabel("Harga satuan (Rp)");
  const paid = page.getByLabel("Sudah dibayar (Rp)");
  await price.fill("");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  expect(await price.evaluate((element) => element.validity.valueMissing)).toBe(
    true,
  );
  await price.fill("1000000000001");
  await expect(price).toHaveValue("1.000.000.000.001");
  expect(await price.evaluate((element) => element.checkValidity())).toBe(
    false,
  );
  await price.fill("1000");
  await paid.fill("400000");
  expect(await paid.evaluate((element) => element.checkValidity())).toBe(false);
  await page.getByLabel("Jumlah", { exact: true }).fill("500");
  expect(await paid.evaluate((element) => element.checkValidity())).toBe(true);
  await page.getByLabel("Jumlah", { exact: true }).fill("1");
  expect(await paid.evaluate((element) => element.checkValidity())).toBe(false);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await currentPlan(request)).revision).toBe(before.revision);
});

test("kartu pembayaran dan sisa membuka rincian seluruh kebutuhan serta edit item yang tepat", async ({
  page,
  request,
}) => {
  const current = await currentPlan(request);
  const data = structuredClone(original);
  data.packagePaid = 5000000;
  data.expenses[0].paid = 600000;
  data.expenses.push(
    {
      id: "ring",
      name: "Cincin lamaran",
      category: "Seserahan",
      quantity: 1,
      unitPrice: 1200000,
      paid: 1200000,
      status: "confirmed",
      note: "Sudah diambil",
    },
    {
      id: "makeup",
      name: "Rias lamaran",
      category: "Penampilan",
      quantity: 1,
      unitPrice: 500000,
      paid: 0,
      status: "estimate",
      note: "Warna natural",
      vendor: "Rias Kita",
      contacts: { whatsapp: "085925827004" },
    },
  );
  expect(
    (
      await request.put("/api/plan", {
        data: { data, revision: current.revision },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#budget");
  const table = page.getByRole("table", { name: "Rincian kebutuhan anggaran" });
  await expect(
    table.getByRole("row").filter({ hasText: "Rias lamaran" }),
  ).toContainText("Penampilan");
  await expect(
    table.getByRole("columnheader", { name: "Sisa", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pembayaran tercatat/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Rincian pembayaran", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".budget-detail-total")).toContainText(
    "6.800.000",
  );
  await expect(
    dialog.getByRole("row").filter({ hasText: "Cincin lamaran" }),
  ).toContainText("Lunas");
  await expect(
    dialog.getByRole("row").filter({ hasText: "Rias lamaran" }),
  ).toContainText("Belum dibayar");
  await dialog
    .getByRole("button", { name: "Edit biaya Rias lamaran", exact: true })
    .click();
  await expect(page.getByLabel("Nama kebutuhan")).toHaveValue("Rias lamaran");
  await page.getByLabel("Sudah dibayar (Rp)").fill("200000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Tutup notifikasi", exact: true })
    .click();
  await page.getByRole("button", { name: /Sisa estimasi pembayaran/ }).click();
  await expect(
    dialog.getByRole("heading", {
      name: "Rincian sisa pembayaran",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.locator(".budget-detail-total")).toContainText(
    "19.800.000",
  );
  await expect(
    dialog.getByRole("row").filter({ hasText: "Cincin lamaran" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("row").filter({ hasText: "Rias lamaran" }),
  ).toContainText("300.000");
  await dialog
    .getByRole("button", { name: "Edit pembayaran paket", exact: true })
    .click();
  await expect(page.getByLabel("Total dibayar (Rp)")).toHaveValue("5.000.000");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Sisa estimasi pembayaran/ }).click();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await dialog
      .locator(".budget-detail-context dd")
      .evaluateAll((elements) =>
        elements.every(
          (element) =>
            element.getBoundingClientRect().height < 28 &&
            element.scrollWidth <= element.clientWidth,
        ),
      ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/budget-remaining-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Tutup dialog", exact: true }).click();
  await page.screenshot({
    path: "test-results/budget-list-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("rincian pembayaran menangani belum bayar, lunas, dan anggaran kosong", async ({
  page,
  request,
}) => {
  await page.goto("/#budget");
  await page.getByRole("button", { name: /Pembayaran tercatat/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Belum ada pembayaran yang dicatat.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tutup dialog", exact: true }).click();
  let current = await currentPlan(request);
  current.data.packagePaid = current.data.package.price;
  current.data.expenses[0].paid = 6600000;
  expect((await request.put("/api/plan", { data: current })).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /Sisa estimasi pembayaran/ }).click();
  await expect(
    dialog.getByText("Semua kebutuhan yang dianggarkan sudah lunas.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tutup dialog", exact: true }).click();
  current = await currentPlan(request);
  current.data.package.price = 0;
  current.data.packagePaid = 0;
  current.data.expenses = [];
  expect((await request.put("/api/plan", { data: current })).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /Sisa estimasi pembayaran/ }).click();
  await expect(
    dialog.getByText("Belum ada biaya yang dianggarkan.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Semua kebutuhan yang dianggarkan sudah lunas.", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("kontak vendor dan deskripsi biaya serta paket tersimpan setelah reload", async ({
  page,
  request,
}) => {
  await page.goto("/#budget");
  await page.getByRole("button", { name: "Tambah biaya", exact: true }).click();
  await page.getByLabel("Nama kebutuhan").fill("Dekor tambahan");
  await page.getByLabel("Nama vendor").fill("Dekor Kita");
  await page.getByLabel("WhatsApp vendor").fill("085925827004");
  await page.getByLabel("Tautan vendor").fill("https://example.com/dekor");
  await page
    .getByLabel("Deskripsi / varian / catatan")
    .fill("Kain putih\nBunga emerald");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "Dekor tambahan" });
  await expect(row).toContainText("Dekor Kita");
  await expect(row).toContainText("Bunga emerald");
  await expect(row.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
    "href",
    "https://wa.me/6285925827004",
  );
  await expect(
    row.getByRole("link", { name: /Tautan vendor/ }),
  ).toHaveAttribute("href", "https://example.com/dekor");
  await page.getByRole("button", { name: "Edit pembayaran paket" }).click();
  await page.getByLabel("WhatsApp vendor").fill("081234567890");
  await page
    .getByLabel("Instagram vendor")
    .fill("https://instagram.com/vendor");
  await page
    .getByLabel("Deskripsi / varian / catatan")
    .fill("Varian akad pagi, warna putih");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  const packageRow = page.getByRole("row").filter({ hasText: "Paket utama" });
  await expect(packageRow).toContainText("Varian akad pagi, warna putih");
  await expect(
    packageRow.getByRole("link", { name: /WhatsApp/ }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/budget-vendor-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  const saved = (await currentPlan(request)).data;
  expect(saved.package.note).toBe("Varian akad pagi, warna putih");
  expect(saved.expenses.find((e) => e.name === "Dekor tambahan")).toMatchObject(
    {
      vendor: "Dekor Kita",
      note: "Kain putih\nBunga emerald",
      contacts: { link: "https://example.com/dekor" },
    },
  );
});

test("catatan dan rundown dapat dibuat lewat formulir", async ({
  page,
  request,
}) => {
  await page.goto("/#notes");
  await page.getByRole("button", { name: "Tulis catatan" }).click();
  await page.getByLabel("Judul catatan").fill("Pilihan warna");
  await page
    .getByLabel("Isi catatan")
    .fill("Hijau dan putih, diskusikan dengan keluarga.");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(
    page.getByRole("heading", { name: "Pilihan warna" }),
  ).toBeVisible();
  await page.goto("/#timeline");
  await page.getByRole("button", { name: "Tambah kegiatan" }).click();
  await page.getByLabel("Nama kegiatan").fill("Akad nikah");
  await page.getByLabel("Waktu", { exact: true }).fill("08:30");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("heading", { name: "Akad nikah" })).toBeVisible();
  expect((await currentPlan(request)).data.timeline[0].time).toBe("08:30");
});

test("detail pernikahan dapat diperbarui dan JSON dapat diekspor", async ({
  page,
}) => {
  await page.goto("/#data");
  await page.getByRole("button", { name: "Edit detail", exact: true }).click();
  await page.getByLabel("Nama kamu").fill("Alya");
  await page.getByLabel("Nama pasangan").fill("Raka");
  await page.getByLabel("Tanggal pernikahan").fill("2027-06-12");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Alya & Raka", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON" }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(exported.wedding.partnerOne).toBe("Alya");
  expect(exported.wedding.date).toBe("2027-06-12");
});

test("JSON tidak valid ditolak dengan pesan di dalam dialog", async ({
  page,
  request,
}) => {
  await page.goto("/#data");
  await page.getByRole("button", { name: "Buka editor JSON" }).click();
  await page
    .getByRole("textbox", { name: "Data JSON", exact: true })
    .fill('{"schemaVersion": 1}');
  await page.getByRole("button", { name: "Terapkan JSON" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Data harus",
  );
  expect((await currentPlan(request)).data.wedding.guestTarget).toBe(300);
});

test("impor JSON menerapkan hasil edit ke file bersama", async ({
  page,
  request,
}) => {
  await page.goto("/#data");
  await page.getByRole("button", { name: "Impor JSON" }).click();
  const imported = structuredClone(original);
  imported.wedding.guestTarget = 320;
  await page.locator("input[type=file]").setInputFiles({
    name: "rencana-bersama.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Terapkan JSON" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("320 orang", { exact: true })).toBeVisible();
  expect((await currentPlan(request)).data.wedding.guestTarget).toBe(320);
});

test("edit dari revisi lama tidak menimpa perubahan pasangan", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Atur hari kita" }).click();
  await page.getByLabel("Nama kamu").fill("Draft belum tersimpan");
  const latest = await currentPlan(request);
  latest.data.wedding.partnerTwo = "Edit dari pasangan";
  expect(
    (
      await request.put("/api/plan", {
        data: { data: latest.data, revision: latest.revision },
      })
    ).ok(),
  ).toBe(true);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Ada perubahan yang lebih baru",
  );
  await expect(page.getByLabel("Nama kamu")).toHaveValue(
    "Draft belum tersimpan",
  );
  const saved = await currentPlan(request);
  expect(saved.data.wedding.partnerOne).toBe("Kamu");
  expect(saved.data.wedding.partnerTwo).toBe("Edit dari pasangan");
});

test("lampiran anggaran menyimpan dokumen, gambar, dan tautan setelah reload", async ({
  page,
  request,
}) => {
  await page.goto("/#budget");
  await expect(page.getByRole("button", { name: /^Lampiran / })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Lihat detail Katering tamu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lampiran Katering tamu", exact: true })
    .click();
  const pdf = Buffer.from("%PDF-1.7\nPenawaran katering\n%%EOF");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5x8AAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByLabel("Unggah dokumen atau gambar").setInputFiles([
    {
      name: "Penawaran katering.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    },
    { name: "Referensi menu.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(
    page
      .getByRole("dialog")
      .getByText("Penawaran katering.pdf", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Pratinjau Referensi menu.png" }),
  ).toBeVisible();
  await page.getByLabel("Nama tautan (opsional)").fill("Daftar menu vendor");
  await page.getByLabel("Alamat tautan").fill("https://example.com/menu");
  await page
    .getByRole("button", { name: "Tambahkan tautan", exact: true })
    .click();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  const saved = (await currentPlan(request)).data.expenses.find(
    (e) => e.id === "catering",
  );
  expect(saved.attachments).toHaveLength(3);
  expect(saved.attachments[2]).toMatchObject({
    kind: "link",
    name: "Daftar menu vendor",
    url: "https://example.com/menu",
  });
  const document = await request.get(saved.attachments[0].url);
  expect(document.status()).toBe(200);
  expect(document.headers()["content-disposition"]).toContain("attachment;");
  expect(await document.body()).toEqual(pdf);
  const image = await request.get(saved.attachments[1].url);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(await image.body()).toEqual(png);
  await expect(
    page.getByRole("link", { name: "Daftar menu vendor" }),
  ).toHaveAttribute("href", "https://example.com/menu");
  await page
    .getByRole("button", { name: "Lampiran Katering tamu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hapus lampiran Daftar menu vendor" })
    .click();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await currentPlan(request)).data.expenses.find((e) => e.id === "catering")
      .attachments,
  ).toHaveLength(2);
  await page
    .getByRole("button", { name: "Lampiran Katering tamu", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Hapus lampiran Penawaran katering.pdf",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Hapus lampiran Referensi menu.png",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Lampiran / })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Lihat detail Katering tamu", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Lampiran Katering tamu", exact: true }),
  ).toBeVisible();
});

test("paket utama mendukung tautan dan format unggahan tidak valid ditolak", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", { value: undefined });
  });
  await page.goto("/#budget");
  await page
    .getByRole("button", { name: "Lihat detail Silver · In home", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lampiran Silver · In home", exact: true })
    .click();
  await page.getByLabel("Unggah dokumen atau gambar").setInputFiles({
    name: "halaman.html",
    mimeType: "text/html",
    buffer: Buffer.from("<script>alert(1)</script>"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Format belum didukung",
  );
  await page.getByLabel("Nama tautan (opsional)").fill("Brosur vendor");
  await page.getByLabel("Alamat tautan").fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Tambahkan tautan", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "http atau https",
  );
  await page.getByLabel("Alamat tautan").fill("https://example.com/brosur");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await currentPlan(request)).data.package.attachments[0],
  ).toMatchObject({ name: "Brosur vendor", kind: "link" });
});

test("pilihan paket menampilkan fasilitas sesuai brosur tanpa langsung mengganti rencana", async ({
  page,
  request,
}) => {
  await page.goto("/#package");
  const selector = page.getByRole("combobox", { name: /Pilih paket/ });
  await expect(selector).toHaveValue("silver");
  await page.getByRole("button", { name: "Semua", exact: true }).click();
  await expect(selector.locator("option")).toHaveCount(24);
  await selector.selectOption("gold");
  await expect(
    page.getByRole("heading", { name: "Video cinematic", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3 set tenda atau kajang", { exact: true }),
  ).toBeVisible();
  expect((await currentPlan(request)).data.package.price).toBe(18500000);
  await page.screenshot({
    path: "test-results/packages-desktop.png",
    fullPage: true,
  });
  await selector.selectOption("platinum");
  await expect(
    page.getByText("Dokumentasi midodareni dan resepsi", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Lamaran", exact: true }).click();
  await selector.selectOption("engagement");
  await expect(selector).toHaveValue("engagement");
  await expect(
    page.getByRole("heading", { name: "Engagement", exact: true }),
  ).toBeVisible();
});

test("menerapkan paket memperbarui ringkasan dan anggaran, pembayaran dan lampiran tetap tercatat", async ({
  page,
  request,
}) => {
  const current = await currentPlan(request);
  current.data.packagePaid = 5000000;
  current.data.package.attachments = [
    {
      id: "quote",
      kind: "link",
      name: "Penawaran lama",
      url: "https://example.com/quote",
    },
  ];
  expect((await request.put("/api/plan", { data: current })).ok()).toBe(true);
  await page.goto("/#package");
  await page
    .getByRole("combobox", { name: /Pilih paket/ })
    .selectOption("gold");
  await page
    .getByRole("button", { name: "Gunakan paket ini", exact: true })
    .click();
  await expect(page.locator(".current-package-strip")).toContainText(
    "Gold · In home",
  );
  const saved = (await currentPlan(request)).data;
  expect(saved.package).toMatchObject({ catalogId: "gold", price: 23500000 });
  expect(saved.package.groups.some((g) => g.title === "Video cinematic")).toBe(
    true,
  );
  expect(saved.packagePaid).toBe(5000000);
  expect(saved.package.attachments[0].name).toBe("Penawaran lama");
  await page.reload();
  await expect(page.getByRole("combobox", { name: /Pilih paket/ })).toHaveValue(
    "gold",
  );
  await page.goto("/#overview");
  await expect(page.locator(".package-summary")).toContainText(
    "Gold · In home",
  );
  await page.goto("/#budget");
  await expect(
    page.getByRole("button", { name: /Total estimasi/ }),
  ).toContainText("30.100.000");
  await expect(
    page.getByText("Gold · In home", { exact: true }).first(),
  ).toBeVisible();
});

test("varian hari kerja dan perbedaan data brosur tampil untuk paket gedung", async ({
  page,
  request,
}) => {
  await page.goto("/#package");
  const selector = page.getByRole("combobox", { name: /Pilih paket/ });
  await page.getByRole("button", { name: "Semua", exact: true }).click();
  await selector.selectOption("gedung-wanita");
  await expect(
    page.getByText(
      /Judul paket menyebut 1.000 pax, tetapi bagian katering tertulis 500 pax/,
    ),
  ).toBeVisible();
  await selector.selectOption("mcc");
  await expect(
    page.getByText(/Judul halaman menyebut Gedung MCC/),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /Opsi paket/ })
    .selectOption("weekday");
  await expect(page.locator(".catalog-feature .feature-price")).toContainText(
    "60.500.000",
  );
  await page
    .getByRole("button", { name: "Gunakan paket ini", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Paket digunakan", exact: true }),
  ).toBeDisabled();
  expect((await currentPlan(request)).data.package).toMatchObject({
    catalogId: "mcc",
    variantId: "weekday",
    price: 60500000,
  });
  await expect(
    page.getByText(/konsumsi tidak dihitung dua kali/),
  ).toBeVisible();
  await selector.selectOption("masjid-madaniyah");
  await page
    .getByRole("combobox", { name: /Opsi paket/ })
    .selectOption("without-akad");
  await expect(
    page.getByRole("heading", { name: "Fasilitas paket dasar dalam brosur" }),
  ).toBeVisible();
  await expect(page.locator(".catalog-feature .feature-price")).toContainText(
    "43.500.000",
  );
});

test("opsi paket dan fasilitas nyaman dibaca di ponsel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#package");
  await page
    .getByRole("combobox", { name: /Pilih paket/ })
    .selectOption("platinum");
  await expect(
    page.getByRole("heading", { name: "Video cinematic", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/packages-mobile.png",
    fullPage: true,
  });
});

test("semua halaman muat pada ponsel tanpa overflow horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of [
    "overview",
    "tasks",
    "budget",
    "guests",
    "timeline",
    "package",
    "notes",
    "data",
  ]) {
    await page.goto(`/#${tab}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Buka menu" }).click();
  await expect(
    page.getByRole("link", { name: "Daftar tamu", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Daftar tamu", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daftar tamu", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
});
