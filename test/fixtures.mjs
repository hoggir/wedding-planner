import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(new URL("../data/packages.json", import.meta.url), "utf8"),
);
const silver = catalog.packages.find((p) => p.id === "silver");
const details = (guestTarget, location) => ({
  partnerOne: "Kamu",
  partnerTwo: "Pasanganmu",
  date: "",
  location,
  guestTarget,
  budgetTarget: 0,
});
const tasks = (prefix, titles, firstDone = false) =>
  titles.map((title, index) => ({
    id: `${prefix}-${index}`,
    title,
    category: "Acara",
    owner: "Bersama",
    dueDate: "",
    done: firstDone && index === 0,
    priority: index < 3 ? "high" : "normal",
  }));
const empty = {
  schemaVersion: 1,
  packagePaid: 0,
  expenses: [],
  guests: [],
  timeline: [],
  notes: [],
};

export const fixturePlans = {
  wedding: {
    ...structuredClone(empty),
    wedding: details(300, "Di rumah"),
    package: {
      name: silver.name,
      vendor: silver.vendor,
      price: silver.price,
      groups: structuredClone(silver.groups),
    },
    expenses: [
      {
        id: "catering",
        name: "Katering tamu",
        category: "Konsumsi",
        quantity: 330,
        unitPrice: 20000,
        paid: 0,
        status: "estimate",
        note: "",
      },
    ],
    tasks: tasks(
      "wedding",
      [
        "Pilih paket Silver untuk acara di rumah",
        "Sepakati tanggal pernikahan",
        "Konfirmasi vendor",
        "Tentukan anggaran",
        "Susun daftar tamu",
        "Pilih katering",
        "Survei lokasi",
        "Siapkan perlengkapan",
        "Urus administrasi",
        "Susun rundown",
        "Fitting busana",
        "Koordinasi keluarga",
      ],
      true,
    ),
  },
  engagement: {
    ...structuredClone(empty),
    eventType: "engagement",
    event: details(0, ""),
    package: {
      name: "Belum memilih paket lamaran",
      vendor: "",
      price: 0,
      groups: [],
    },
    tasks: tasks("engagement", [
      "Sepakati tanggal lamaran dengan kedua keluarga",
      "Tentukan lokasi lamaran",
      "Tentukan anggaran lamaran",
      "Susun prosesi lamaran",
      "Siapkan cincin",
      "Pilih busana",
      "Pilih dekorasi",
      "Tentukan konsumsi",
      "Undang keluarga",
      "Bagi tugas acara",
    ]),
  },
  hall: {
    ...structuredClone(empty),
    eventType: "wedding",
    scenario: "hall",
    event: details(300, "Di gedung"),
    package: {
      name: "Belum memilih paket gedung",
      vendor: "",
      price: 0,
      groups: [],
    },
    tasks: tasks("hall", [
      "Cari gedung untuk 300 tamu",
      "Konfirmasi tanggal gedung",
      "Pilih paket gedung",
      "Tentukan anggaran",
      "Survei fasilitas",
      "Periksa kontrak sewa",
      "Pilih menu",
      "Susun daftar tamu",
      "Urus administrasi",
      "Fitting busana",
      "Susun rundown",
      "Bagi tugas keluarga",
    ]),
  },
};
