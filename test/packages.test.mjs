import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { choosePackage, vendorContacts } from "../plan-client.js";

const current = () => ({
  package: {
    name: "Silver",
    price: 18500000,
    groups: [],
    attachments: [
      {
        id: "quote",
        kind: "link",
        name: "Penawaran",
        url: "https://example.com/quote",
      },
    ],
  },
  packagePaid: 5000000,
  expenses: [{ id: "food", quantity: 330, unitPrice: 20000 }],
  wedding: { guestTarget: 300 },
});
const gold = {
  id: "gold",
  name: "Gold · In home",
  vendor: "Nikah Murah Karanganyar",
  price: 23500000,
  category: "Di rumah",
  location: "Di rumah",
  includesCatering: false,
  groups: [{ title: "Cinematic", items: ["Videografer dan video 2 menit"] }],
  notes: [],
  variants: [],
};

test("kontak vendor menggunakan nomor internasional WhatsApp dan tautan Instagram yang diberikan", () => {
  const instagram =
    "https://www.instagram.com/niscala_decoration?dlrf=cGpremR6bWFkNDQ2";
  assert.deepEqual(
    vendorContacts({ contacts: { whatsapp: "085925827004", instagram } }),
    {
      whatsapp: { phone: "085925827004", url: "https://wa.me/6285925827004" },
      instagram,
      link: null,
    },
  );
  assert.equal(
    vendorContacts({ contacts: { whatsapp: "+62 859-2582-7004" } }).whatsapp
      .url,
    "https://wa.me/6285925827004",
  );
  assert.deepEqual(vendorContacts({}), {
    whatsapp: null,
    instagram: null,
    link: null,
  });
  assert.deepEqual(
    vendorContacts({
      contacts: { whatsapp: "abc", instagram: "javascript:alert(1)" },
    }),
    { whatsapp: null, instagram: null, link: null },
  );
});

test("mengganti paket memperbarui harga dan fasilitas sambil mempertahankan pembayaran dan lampiran", () => {
  const original = current();
  const result = choosePackage(original, gold);
  assert.equal(result.package.catalogId, "gold");
  assert.equal(result.package.price, 23500000);
  assert.deepEqual(result.package.groups, gold.groups);
  assert.deepEqual(result.package.attachments, original.package.attachments);
  assert.deepEqual(result.expenses, original.expenses);
  assert.equal(result.packagePaid, 5000000);
  assert.equal(original.package.name, "Silver");
});

test("catatan pribadi anggaran tetap ada saat mengganti paket dan kontak mengikuti vendor baru", () => {
  const data = current();
  data.package.note = "Konfirmasi ongkir untuk alamat rumah";
  data.package.taskIds = ["confirm-vendor"];
  data.package.contacts = { whatsapp: "081234567890" };
  const result = choosePackage(data, {
    ...gold,
    contacts: { whatsapp: "085925827004" },
  });
  assert.equal(result.package.note, "Konfirmasi ongkir untuk alamat rumah");
  assert.deepEqual(result.package.taskIds, ["confirm-vendor"]);
  assert.equal(result.package.contacts.whatsapp, "085925827004");
});

test("varian harga mengikuti brosur dan pembayaran yang melebihi paket baru tidak dihapus", () => {
  const offer = {
    ...gold,
    variants: [
      {
        id: "weekday",
        label: "Senin–Kamis",
        price: 20500000,
        note: "Harga hari kerja",
      },
    ],
  };
  const chosen = choosePackage(current(), offer, "weekday");
  assert.equal(chosen.package.price, 20500000);
  assert.equal(chosen.package.variantId, "weekday");
  assert.match(chosen.package.name, /Senin–Kamis/);
  assert.throws(
    () => choosePackage(current(), { ...gold, price: 1000000 }),
    /pembayaran/i,
  );
  assert.throws(() => choosePackage(current(), offer, "invalid"), /varian/i);
});

test("katalog memuat paket brosur dan dua pilihan Niscala sesuai sumbernya", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../data/packages.json", import.meta.url), "utf8"),
  );
  assert.equal(catalog.packages.length, 24);
  assert.equal(new Set(catalog.packages.map((p) => p.id)).size, 24);
  const niscala = catalog.packages
    .filter((p) => p.vendor === "Niscala Decoration")
    .sort((a, b) => a.price - b.price);
  assert.deepEqual(
    niscala.map((p) => p.price),
    [600000, 850000],
  );
  assert.ok(
    niscala.every(
      (p) =>
        p.category === "Lamaran" &&
        p.source.url.startsWith("/vendors/") &&
        p.notes.some((n) => n.includes("ongkir")),
    ),
  );
  assert.ok(
    niscala[0].groups.some((g) =>
      g.items.includes("Ukuran dekorasi 3 × 3 meter"),
    ),
  );
  assert.ok(
    niscala[1].groups.some((g) => g.items.includes("Panjang papan 2,4 meter")),
  );
  for (const p of catalog.packages) {
    assert.ok(p.groups.length > 0);
    assert.ok(p.groups.every((g) => g.items.length > 0));
  }
  const silver = catalog.packages.find((p) => p.id === "silver");
  const platinum = catalog.packages.find((p) => p.id === "platinum");
  assert.equal(silver.price, 18500000);
  assert.equal(silver.includesCatering, false);
  assert.ok(platinum.groups.find((g) => g.title === "Video cinematic"));
  const wanita = catalog.packages.find((p) => p.id === "gedung-wanita");
  assert.equal(wanita.capacity, 1000);
  assert.equal(wanita.cateringPax, 500);
  assert.ok(wanita.notes.some((n) => n.includes("500")));
});
