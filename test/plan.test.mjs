import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validatePlan, summarize, savePlan, readPlan } from "../plan.mjs";
import { reorderTasks } from "../plan-client.js";

const fixture = () => ({
  schemaVersion: 1,
  wedding: {
    partnerOne: "Kamu",
    partnerTwo: "Pasanganmu",
    date: "",
    location: "Di rumah",
    guestTarget: 300,
    budgetTarget: 0,
  },
  package: {
    name: "Silver",
    price: 18500000,
    vendor: "Nikah Murah Karanganyar",
    groups: [],
  },
  expenses: [
    {
      id: "catering",
      name: "Katering",
      category: "Konsumsi",
      quantity: 330,
      unitPrice: 20000,
      paid: 0,
      status: "estimate",
      note: "",
    },
  ],
  packagePaid: 0,
  tasks: [
    {
      id: "task1",
      title: "Konfirmasi vendor",
      category: "Vendor",
      owner: "Bersama",
      dueDate: "",
      done: false,
      priority: "high",
    },
  ],
  guests: [],
  timeline: [],
  notes: [],
});

test("menghitung paket, katering, pembayaran, dan RSVP tanpa menghitung paket dua kali", () => {
  const data = fixture();
  data.packagePaid = 5000000;
  data.guests = [
    {
      id: "g1",
      name: "Keluarga",
      side: "Bersama",
      count: 3,
      status: "confirmed",
      phone: "",
      note: "",
    },
  ];
  assert.deepEqual(summarize(data), {
    estimated: 25100000,
    paid: 5000000,
    remaining: 20100000,
    invited: 3,
    confirmed: 3,
    tasksDone: 0,
    tasksTotal: 1,
  });
});

test("mengubah urutan tugas mempertahankan data, tidak memutasi sumber, dan mengabaikan ID yang hilang", () => {
  const tasks = [
    { id: "a", done: false, conclusion: "Keputusan A" },
    { id: "hidden", done: true },
    { id: "b", done: false },
  ];
  const moved = reorderTasks(tasks, "b", "a");
  assert.deepEqual(
    moved.map((task) => task.id),
    ["b", "hidden", "a"],
  );
  assert.deepEqual(
    tasks.map((task) => task.id),
    ["a", "hidden", "b"],
  );
  assert.equal(moved[2].conclusion, "Keputusan A");
  assert.equal(moved[1], tasks[1]);
  assert.equal(reorderTasks(tasks, "missing", "a"), tasks);
  assert.equal(reorderTasks(tasks, "a", "missing"), tasks);
  assert.equal(reorderTasks(tasks, "a", "a"), tasks);
});

test("menolak JSON rusak, angka negatif, ID duplikat, dan tanggal tidak valid", () => {
  assert.throws(() => validatePlan({}), /Data/);
  const data = fixture();
  assert.equal(validatePlan(data), data);
  data.expenses[0].unitPrice = -1;
  assert.throws(() => validatePlan(data), /biaya/i);
  data.expenses[0].unitPrice = 20000;
  data.tasks.push({ ...data.tasks[0] });
  assert.throws(() => validatePlan(data), /duplikat/i);
  data.tasks.pop();
  data.wedding.date = "2027-02-31";
  assert.throws(() => validatePlan(data), /tanggal/i);
});

test("kontak dan deskripsi anggaran opsional, tetapi menolak tautan tidak aman dan teks berlebih", () => {
  assert.doesNotThrow(() => validatePlan(fixture()));
  for (const target of ["package", "expense"]) {
    const data = fixture();
    const item = target === "package" ? data.package : data.expenses[0];
    item.vendor = "Niscala Decoration";
    item.note = "Kain putih, bunga emerald, kursi sepasang";
    item.contacts = {
      whatsapp: "085925827004",
      instagram: "https://www.instagram.com/niscala_decoration",
      link: "https://example.com/penawaran",
    };
    assert.doesNotThrow(() => validatePlan(data));
    item.contacts.link = "javascript:alert(1)";
    assert.throws(() => validatePlan(data), /kontak|tautan/i);
    item.contacts.link = "";
    item.contacts.whatsapp = "abc";
    assert.throws(() => validatePlan(data), /kontak|whatsapp/i);
    item.contacts.whatsapp = "";
    item.note = "x".repeat(2001);
    assert.throws(() => validatePlan(data), /deskripsi|catatan|biaya/i);
  }
});

test("satu checklist per anggaran dapat dibagikan dan menolak ID hilang, duplikat, atau tipe keliru", () => {
  const data = fixture();
  data.tasks.push({ ...data.tasks[0], id: "task2" });
  data.package.taskIds = ["task1"];
  data.expenses[0].taskIds = ["task1"];
  assert.doesNotThrow(() => validatePlan(data));
  for (const item of [data.package, data.expenses[0]]) {
    for (const invalid of [
      ["missing"],
      ["task1", "task1"],
      ["task1", "task2"],
      [123],
      "task1",
      null,
    ]) {
      item.taskIds = invalid;
      assert.throws(() => validatePlan(data), /checklist/i);
    }
    item.taskIds = [];
    assert.doesNotThrow(() => validatePlan(data));
    delete item.taskIds;
    assert.doesNotThrow(() => validatePlan(data));
  }
});

test("jawaban tugas opsional, menerima beberapa baris, dan membatasi panjang serta tipe teks", () => {
  const data = fixture();
  assert.doesNotThrow(() => validatePlan(data));
  for (const conclusion of [
    "",
    "Batas anggaran Rp35.000.000.\nCadangan Rp2.000.000.",
    "x".repeat(2000),
  ]) {
    data.tasks[0].conclusion = conclusion;
    assert.doesNotThrow(() => validatePlan(data));
  }
  for (const conclusion of ["x".repeat(2001), 123, {}, null]) {
    data.tasks[0].conclusion = conclusion;
    assert.throws(() => validatePlan(data), /jawaban|kesimpulan/i);
  }
});

test("menyimpan JSON secara atomik dan menolak perubahan dari revisi lama", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "wedding-plan-test-"));
  const file = path.join(dir, "plan.json");
  try {
    await writeFile(file, JSON.stringify(fixture()));
    const first = await readPlan(file);
    const changed = structuredClone(first.data);
    changed.wedding.guestTarget = 320;
    const saved = await savePlan(file, changed, first.revision);
    assert.equal(saved.data.wedding.guestTarget, 320);
    await assert.rejects(savePlan(file, fixture(), first.revision), {
      code: "CONFLICT",
    });
    assert.equal(
      JSON.parse(await readFile(file, "utf8")).wedding.guestTarget,
      320,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
