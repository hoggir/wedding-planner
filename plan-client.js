export function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function vendorContacts(offer) {
  const contacts = offer.contacts || {};
  const phone =
    typeof contacts.whatsapp === "string" ? contacts.whatsapp.trim() : "";
  const number = phone.replace(/\D/g, "").replace(/^0/, "62");
  const whatsapp = /^\d{8,15}$/.test(number)
    ? { phone, url: `https://wa.me/${number}` }
    : null;
  let instagram = null;
  if (typeof contacts.instagram === "string") {
    try {
      const url = new URL(contacts.instagram.trim());
      if (["http:", "https:"].includes(url.protocol))
        instagram = contacts.instagram.trim();
    } catch {}
  }
  let link = null;
  if (typeof contacts.link === "string") {
    try {
      const url = new URL(contacts.link.trim());
      if (["http:", "https:"].includes(url.protocol)) link = url.href;
    } catch {}
  }
  return { whatsapp, instagram, link };
}

export function reorderTasks(tasks, taskId, targetId) {
  const from = tasks.findIndex((task) => task.id === taskId);
  const to = tasks.findIndex((task) => task.id === targetId);
  if (from < 0 || to < 0 || from === to) return tasks;
  const reordered = [...tasks];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  return reordered;
}

export function summarize(data) {
  const estimated =
    data.package.price +
    data.expenses.reduce((sum, e) => sum + e.quantity * e.unitPrice, 0);
  const paid =
    data.packagePaid + data.expenses.reduce((sum, e) => sum + e.paid, 0);
  return {
    estimated,
    paid,
    remaining: estimated - paid,
    invited: data.guests.reduce((sum, g) => sum + g.count, 0),
    confirmed: data.guests
      .filter((g) => g.status === "confirmed")
      .reduce((sum, g) => sum + g.count, 0),
    tasksDone: data.tasks.filter((t) => t.done).length,
    tasksTotal: data.tasks.length,
  };
}

export function budgetEntries(data) {
  return [
    {
      kind: "package",
      id: "package",
      item: data.package,
      category: "Paket utama",
      total: data.package.price,
      paid: data.packagePaid,
    },
    ...data.expenses.map((item) => ({
      kind: "expense",
      id: item.id,
      item,
      category: item.category,
      total: item.quantity * item.unitPrice,
      paid: item.paid,
    })),
  ].map((entry) => ({ ...entry, remaining: entry.total - entry.paid }));
}

export function paymentState(total, paid) {
  return total === 0
    ? "unset"
    : paid === total
      ? "paid"
      : paid > 0
        ? "partial"
        : "unpaid";
}

export function choosePackage(data, offer, variantId = "standard") {
  const variant =
    variantId === "standard"
      ? null
      : offer.variants.find((v) => v.id === variantId);
  if (variantId !== "standard" && !variant)
    throw new Error("Varian paket tidak ditemukan.");
  const price = variant?.price ?? offer.price;
  if (data.packagePaid > price)
    throw new Error(
      "Pembayaran yang tercatat melebihi harga paket baru. Periksa pembayaran paket sebelum mengganti pilihan.",
    );
  const { id, variants, ...details } = structuredClone(offer);
  return {
    ...data,
    package: {
      ...details,
      catalogId: id,
      variantId,
      name: variant ? `${offer.name} · ${variant.label}` : offer.name,
      price,
      notes: [...offer.notes, ...(variant?.note ? [variant.note] : [])],
      attachments: data.package.attachments || [],
      note: data.package.note || "",
      taskIds: [...(data.package.taskIds || [])],
    },
  };
}
