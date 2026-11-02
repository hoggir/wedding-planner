import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  writeFile,
  rename,
  mkdir,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { validateAttachments } from "./attachments.mjs";
import { eventDetails } from "./events.js";
import { vendorContacts } from "./plan-client.js";
export { summarize } from "./plan-client.js";

const money = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
const text = (v, max = 2000) => typeof v === "string" && v.length <= max;
const date = (v) =>
  v === "" ||
  (typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v);
const fail = (message) => {
  throw new Error(message);
};

function validateVendor(item) {
  if (item.vendor !== undefined && !text(item.vendor, 300))
    fail("Nama vendor tidak valid.");
  if (item.note !== undefined && !text(item.note))
    fail("Deskripsi atau catatan maksimal 2.000 karakter.");
  if (item.contacts === undefined) return;
  if (
    !item.contacts ||
    typeof item.contacts !== "object" ||
    Array.isArray(item.contacts)
  )
    fail("Kontak vendor tidak valid.");
  const parsed = vendorContacts(item);
  for (const key of ["whatsapp", "instagram", "link"]) {
    const value = item.contacts[key];
    if (value === undefined) continue;
    if (
      !text(value, key === "whatsapp" ? 100 : 2000) ||
      (value.trim() && !parsed[key])
    )
      fail(
        "Kontak vendor tidak valid. Gunakan nomor WhatsApp atau tautan http/https.",
      );
  }
}

export function validatePlan(data) {
  if (
    !data ||
    typeof data !== "object" ||
    data.schemaVersion !== 1 ||
    !eventDetails(data) ||
    !data.package
  )
    fail(
      "Data harus menggunakan schemaVersion 1 serta memiliki detail event atau wedding dan package.",
    );
  if (
    data.eventType !== undefined &&
    !["wedding", "engagement"].includes(data.eventType)
  )
    fail("Jenis rencana tidak valid.");
  if (data.event && data.wedding)
    fail("Gunakan satu field detail acara: event atau wedding.");
  if (
    data.scenario !== undefined &&
    (!["home", "hall"].includes(data.scenario) ||
      data.eventType === "engagement")
  )
    fail("Skenario rencana tidak valid.");
  const w = eventDetails(data);
  validateVendor(data.package);
  validateAttachments(data.package.attachments);
  if (
    ![w.partnerOne, w.partnerTwo, w.location].every((v) => text(v, 300)) ||
    !Number.isInteger(w.guestTarget) ||
    w.guestTarget < 0 ||
    w.guestTarget > 100000 ||
    !money(w.budgetTarget)
  )
    fail("Data acara atau target anggaran tidak valid.");
  if (!date(w.date)) fail("Tanggal acara tidak valid.");
  if (
    !text(data.package.name, 200) ||
    !text(data.package.vendor, 300) ||
    !money(data.package.price) ||
    !money(data.packagePaid) ||
    data.packagePaid > data.package.price
  )
    fail("Harga atau pembayaran paket tidak valid.");
  if (
    !Array.isArray(data.package.groups) ||
    data.package.groups.length > 30 ||
    data.package.groups.some(
      (g) =>
        !text(g.title, 200) ||
        !Array.isArray(g.items) ||
        g.items.length > 100 ||
        g.items.some((i) => !text(i)),
    )
  )
    fail("Rincian paket tidak valid.");
  for (const key of ["tasks", "expenses", "guests", "timeline", "notes"]) {
    if (!Array.isArray(data[key]) || data[key].length > 10000)
      fail(`Data ${key} harus berupa array, maksimal 10.000 baris.`);
    const ids = new Set();
    for (const item of data[key]) {
      if (!item || !text(item.id, 100) || !item.id || ids.has(item.id))
        fail(`ID kosong atau duplikat pada ${key}.`);
      ids.add(item.id);
      if (
        Object.values(item).some(
          (v) => typeof v === "string" && v.length > 10000,
        )
      )
        fail(`Teks pada ${key} terlalu panjang.`);
    }
  }
  for (const e of data.expenses) {
    validateVendor(e);
    validateAttachments(e.attachments);
    if (
      !text(e.name, 300) ||
      !e.name.trim() ||
      !text(e.category, 100) ||
      !text(e.note) ||
      !Number.isInteger(e.quantity) ||
      e.quantity < 1 ||
      !money(e.unitPrice) ||
      !money(e.quantity * e.unitPrice) ||
      !money(e.paid) ||
      e.paid > e.quantity * e.unitPrice ||
      !["estimate", "confirmed"].includes(e.status)
    )
      fail(
        "Data biaya tidak valid. Jumlah, harga, dan pembayaran harus valid.",
      );
  }
  const taskIds = new Set(data.tasks.map((task) => task.id));
  for (const item of [data.package, ...data.expenses]) {
    if (item.taskIds === undefined) continue;
    if (
      !Array.isArray(item.taskIds) ||
      item.taskIds.length > 1 ||
      new Set(item.taskIds).size !== item.taskIds.length ||
      item.taskIds.some((id) => !text(id, 100) || !taskIds.has(id))
    )
      fail(
        "Checklist terkait tidak valid. Pilih maksimal satu ID tugas yang ada dalam rencana ini.",
      );
  }
  for (const t of data.tasks) {
    if (t.conclusion !== undefined && !text(t.conclusion))
      fail(
        "Jawaban / kesimpulan tugas harus berupa teks, maksimal 2.000 karakter.",
      );
    if (
      !text(t.title, 300) ||
      !t.title.trim() ||
      !text(t.category, 100) ||
      !text(t.owner, 100) ||
      !date(t.dueDate) ||
      typeof t.done !== "boolean" ||
      !["high", "normal", "low"].includes(t.priority)
    )
      fail("Data tugas atau tanggal tugas tidak valid.");
  }
  for (const g of data.guests) {
    if (
      !text(g.name, 300) ||
      !g.name.trim() ||
      !text(g.side, 100) ||
      !Number.isInteger(g.count) ||
      g.count < 1 ||
      g.count > 10000 ||
      !["pending", "confirmed", "declined"].includes(g.status) ||
      !text(g.phone, 100) ||
      !text(g.note)
    )
      fail("Data tamu tidak valid.");
  }
  for (const t of data.timeline) {
    if (
      !text(t.title, 300) ||
      !t.title.trim() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) ||
      !text(t.owner, 100) ||
      !text(t.note)
    )
      fail("Data rundown atau waktu tidak valid.");
  }
  for (const n of data.notes) {
    if (
      !text(n.title, 300) ||
      !n.title.trim() ||
      !text(n.body, 10000) ||
      !text(n.author, 100)
    )
      fail("Data catatan tidak valid.");
  }
  return data;
}

export async function readPlan(file) {
  const raw = await readFile(file, "utf8");
  const data = validatePlan(JSON.parse(raw.replace(/^\uFEFF/, "")));
  return { data, revision: createHash("sha256").update(raw).digest("hex") };
}

let queue = Promise.resolve();
export function savePlan(file, data, revision) {
  const operation = queue.then(async () => {
    validatePlan(data);
    const current = await readPlan(file);
    if (revision !== current.revision) {
      const error = new Error(
        "Ada perubahan yang lebih baru. Muat data terbaru sebelum menyimpan lagi.",
      );
      error.code = "CONFLICT";
      throw error;
    }
    const backupDir = path.join(
      path.dirname(file),
      "backups",
      path.parse(file).name,
    );
    await mkdir(backupDir, { recursive: true });
    await writeFile(
      path.join(backupDir, `plan-${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(current.data, null, 2) + "\n",
    );
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", {
        flag: "wx",
      });
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    const backups = (await readdir(backupDir))
      .filter((f) => /^plan-\d+-[a-f0-9-]+\.json$/.test(f))
      .sort();
    await Promise.all(
      backups.slice(0, -20).map((f) => unlink(path.join(backupDir, f))),
    );
    return readPlan(file);
  });
  queue = operation.catch(() => {});
  return operation;
}
