import { ArrowUpRight, PencilSimple, Trash, Tray } from "@phosphor-icons/react";
import { budgetEntries } from "../plan-client.js";
import { PaymentStatus } from "./BudgetDetails.jsx";
import VendorContactLinks from "./VendorContactLinks.jsx";
import { BudgetTaskLinks } from "./TaskConnections.jsx";
import { AttachmentSummary } from "./Attachments.jsx";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const attachmentItem = (entry, item) => ({
  ...item,
  id: entry.id,
  target: entry.kind,
  attachments: item.attachments || [],
});

export function BudgetList({
  entries,
  data,
  packageDetails,
  edit,
  remove,
  onToggle,
  saving,
  filtered,
  onReset,
}) {
  if (!entries.length)
    return (
      <div className="budget-empty">
        <Tray size={30} weight="light" />
        <h3>Tidak ada kebutuhan yang cocok.</h3>
        <p>Coba kata kunci atau kategori lain untuk menemukan anggaranmu.</p>
        <button type="button" className="button secondary" onClick={onReset}>
          Reset filter
        </button>
      </div>
    );
  const totals = entries.reduce(
    (sum, entry) => ({
      total: sum.total + entry.total,
      paid: sum.paid + entry.paid,
      remaining: sum.remaining + entry.remaining,
    }),
    { total: 0, paid: 0, remaining: 0 },
  );
  return (
    <div className="table-scroll">
      <table
        className="budget-table budget-ledger"
        aria-label="Rincian kebutuhan anggaran"
      >
        <thead>
          <tr>
            <th>Kebutuhan</th>
            <th>Subtotal</th>
            <th>Dibayar</th>
            <th>Sisa</th>
            <th aria-label="Aksi" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const item = entry.kind === "package" ? packageDetails : entry.item;
            const onEdit = () =>
              entry.kind === "package"
                ? edit("packagePayment")
                : edit("expense", item);
            return (
              <tr key={`${entry.kind}-${entry.id}`}>
                <td className="budget-item-cell">
                  <button
                    type="button"
                    className="budget-item-name"
                    aria-label={`Lihat detail ${item.name}`}
                    onClick={() =>
                      edit("budgetItem", { id: entry.id, kind: entry.kind })
                    }
                  >
                    <strong>{item.name}</strong>
                    <ArrowUpRight size={14} />
                  </button>
                  <div className="budget-item-meta">
                    <span className="budget-category">{entry.category}</span>
                    {entry.kind === "expense" && (
                      <span>
                        {item.quantity} × {money(item.unitPrice)} ·{" "}
                        {item.status === "estimate"
                          ? "Estimasi"
                          : "Dikonfirmasi"}
                      </span>
                    )}
                  </div>
                  {item.vendor && (
                    <small className="budget-vendor-name">{item.vendor}</small>
                  )}
                  {item.note && (
                    <span className="expense-note">{item.note}</span>
                  )}
                  <div className="budget-item-tools">
                    <VendorContactLinks offer={item} compact />
                    <AttachmentSummary
                      attachments={item.attachments}
                      name={item.name}
                      compact
                      onManage={() =>
                        edit("attachments", attachmentItem(entry, item))
                      }
                    />
                  </div>
                  <BudgetTaskLinks
                    item={item}
                    tasks={data.tasks}
                    edit={edit}
                    onManage={onEdit}
                    onToggle={onToggle}
                    saving={saving}
                  />
                </td>
                <td data-label="Subtotal">{money(entry.total)}</td>
                <td data-label="Dibayar">
                  {money(entry.paid)}
                  <PaymentStatus total={entry.total} paid={entry.paid} />
                </td>
                <td data-label="Sisa" className="budget-remaining">
                  {money(entry.remaining)}
                </td>
                <td className="budget-row-actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={
                        entry.kind === "package"
                          ? "Edit pembayaran paket"
                          : `Edit biaya ${item.name}`
                      }
                      onClick={onEdit}
                    >
                      <PencilSimple size={17} />
                    </button>
                    {entry.kind === "expense" && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Hapus biaya ${item.name}`}
                        onClick={() => remove("expenses", item)}
                      >
                        <Trash size={17} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>{filtered ? "Total hasil filter" : "Total anggaran"}</td>
            <td data-label="Subtotal">{money(totals.total)}</td>
            <td data-label="Dibayar">{money(totals.paid)}</td>
            <td data-label="Sisa">{money(totals.remaining)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function BudgetItemDetail({
  data,
  selection,
  packageDetails,
  edit,
  onToggle,
  saving,
}) {
  const entry = budgetEntries(data).find(
    (entry) => entry.kind === selection.kind && entry.id === selection.id,
  );
  if (!entry) return <p>Kebutuhan ini tidak lagi ada dalam rencana.</p>;
  const item = entry.kind === "package" ? packageDetails : entry.item;
  const onEdit = () =>
    entry.kind === "package" ? edit("packagePayment") : edit("expense", item);
  return (
    <div className="budget-item-detail">
      <header className="budget-item-detail-heading">
        <span className="budget-category">{entry.category}</span>
        <h3>{item.name}</h3>
        <p>
          {entry.kind === "package"
            ? "Paket utama dalam rencana kalian"
            : `${item.quantity} × ${money(item.unitPrice)} · Harga ${item.status === "confirmed" ? "sudah dikonfirmasi" : "masih estimasi"}`}
        </p>
        <PaymentStatus total={entry.total} paid={entry.paid} />
      </header>
      <dl className="budget-item-amounts">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(entry.total)}</dd>
        </div>
        <div>
          <dt>Sudah dibayar</dt>
          <dd>{money(entry.paid)}</dd>
        </div>
        <div>
          <dt>Sisa pembayaran</dt>
          <dd>{money(entry.remaining)}</dd>
        </div>
      </dl>
      <section className="budget-detail-section">
        <h4>Deskripsi & catatan</h4>
        {item.note ? (
          <p className="budget-full-note">{item.note}</p>
        ) : (
          <p className="budget-muted">Belum ada deskripsi atau catatan.</p>
        )}
      </section>
      <section className="budget-detail-section">
        <h4>Vendor & kontak</h4>
        <p>{item.vendor || "Vendor belum dicatat."}</p>
        <VendorContactLinks offer={item} />
      </section>
      <section className="budget-detail-section">
        <h4>Checklist terkait</h4>
        <BudgetTaskLinks
          item={item}
          tasks={data.tasks}
          edit={edit}
          onManage={onEdit}
          onToggle={onToggle}
          saving={saving}
        />
      </section>
      <section className="budget-detail-section">
        <h4>Lampiran & referensi</h4>
        {!item.attachments?.length && (
          <p className="budget-muted">
            Simpan nota, bukti pembayaran, atau referensi di sini.
          </p>
        )}
        <AttachmentSummary
          attachments={item.attachments}
          name={item.name}
          limit={20}
          onManage={() => edit("attachments", attachmentItem(entry, item))}
        />
      </section>
    </div>
  );
}
