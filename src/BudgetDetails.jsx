import { PencilSimple, CheckCircle, Clock } from "@phosphor-icons/react";
import { summarize, paymentState } from "../plan-client.js";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function PaymentStatus({ total, paid }) {
  const state = paymentState(total, paid);
  return (
    <span className={`payment-status ${state}`}>
      {
        {
          unset: "Belum dianggarkan",
          paid: "Lunas",
          partial: "Sebagian",
          unpaid: "Belum dibayar",
        }[state]
      }
    </span>
  );
}

export default function BudgetDetails({ data, mode, edit }) {
  const stats = summarize(data);
  const remaining = mode === "remaining";
  const entries = [
    {
      id: "package",
      kind: "package",
      name: data.package.name,
      category: "Paket utama",
      vendor: data.package.vendor,
      total: data.package.price,
      paid: data.packagePaid,
    },
    ...data.expenses.map((expense) => ({
      ...expense,
      kind: "expense",
      total: expense.quantity * expense.unitPrice,
    })),
  ];
  const visible = remaining
    ? entries.filter((entry) => entry.total > entry.paid)
    : entries;
  return (
    <div className={`budget-details ${remaining ? "remaining" : "paid"}`}>
      <div className="budget-detail-total">
        <span>
          {remaining ? <Clock size={21} /> : <CheckCircle size={21} />}
          {remaining ? "Sisa seluruh kebutuhan" : "Total pembayaran tercatat"}
        </span>
        <strong>{money(remaining ? stats.remaining : stats.paid)}</strong>
        <p>
          {remaining
            ? `${visible.length} kebutuhan masih memiliki sisa biaya.`
            : `Dari paket utama dan ${data.expenses.length} kebutuhan tambahan.`}
        </p>
      </div>
      <dl className="budget-detail-context">
        <div>
          <dt>Total estimasi</dt>
          <dd>{money(stats.estimated)}</dd>
        </div>
        <div>
          <dt>{remaining ? "Sudah dibayar" : "Sisa pembayaran"}</dt>
          <dd>{money(remaining ? stats.paid : stats.remaining)}</dd>
        </div>
      </dl>
      {!stats.estimated ? (
        <p className="budget-detail-notice">
          Belum ada biaya yang dianggarkan.
        </p>
      ) : remaining && !visible.length ? (
        <p className="budget-detail-notice">
          Semua kebutuhan yang dianggarkan sudah lunas.
        </p>
      ) : !remaining && !stats.paid ? (
        <p className="budget-detail-notice">
          Belum ada pembayaran yang dicatat.
        </p>
      ) : null}
      {!!visible.length && (
        <div className="table-scroll">
          <table
            className="budget-table payment-detail-table"
            aria-label={
              remaining ? "Rincian sisa pembayaran" : "Rincian pembayaran"
            }
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
              {visible.map((entry) => (
                <tr key={`${entry.kind}-${entry.id}`}>
                  <td>
                    <button
                      type="button"
                      className="budget-item-name"
                      aria-label={`Lihat detail ${entry.name}`}
                      onClick={() =>
                        edit("budgetItem", { id: entry.id, kind: entry.kind })
                      }
                    >
                      <strong>{entry.name}</strong>
                    </button>
                    <small>
                      {entry.category}
                      {entry.vendor ? ` · ${entry.vendor}` : ""}
                    </small>
                    <PaymentStatus total={entry.total} paid={entry.paid} />
                  </td>
                  <td data-label="Subtotal">{money(entry.total)}</td>
                  <td data-label="Dibayar" className="paid-amount">
                    {money(entry.paid)}
                  </td>
                  <td data-label="Sisa" className="remaining-amount">
                    {money(entry.total - entry.paid)}
                  </td>
                  <td className="budget-row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={
                        entry.kind === "package"
                          ? "Edit pembayaran paket"
                          : `Edit biaya ${entry.name}`
                      }
                      onClick={() =>
                        entry.kind === "package"
                          ? edit("packagePayment")
                          : edit(
                              "expense",
                              data.expenses.find(
                                (expense) => expense.id === entry.id,
                              ),
                            )
                      }
                    >
                      <PencilSimple size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="budget-detail-hint">
        {remaining
          ? "Sisa dihitung dari subtotal dikurangi pembayaran setiap kebutuhan. Nilai estimasi dapat berubah setelah konfirmasi vendor."
          : "Pembayaran adalah total yang sudah dicatat per kebutuhan. Gunakan ikon pensil untuk memperbarui item yang sesuai."}
      </p>
    </div>
  );
}
