import { TaskSelector } from "./TaskConnections.jsx";
import AttachmentEditor from "./Attachments.jsx";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function BudgetEditorFields({
  type,
  form,
  setForm,
  data,
  input,
  amount,
  select,
  taskMode,
  onTaskModeChange,
  newTask,
  setNewTask,
  owners,
  onBusyChange,
  disabled,
}) {
  const expense = type === "expense";
  const total = expense ? form.quantity * form.unitPrice : Number(form.price);
  const paid = Number(expense ? form.paid : form.packagePaid);
  const contact = (key) => (event) =>
    setForm((previous) => ({
      ...previous,
      contacts: { ...previous.contacts, [key]: event.target.value },
    }));
  return (
    <>
      <dl className="budget-edit-summary form-subtotal">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(total)}</dd>
        </div>
        <div>
          <dt>Sudah dibayar</dt>
          <dd>{money(paid)}</dd>
        </div>
        <div>
          <dt>Sisa pembayaran</dt>
          <dd className={total < paid ? "invalid-amount" : ""}>
            {money(total - paid)}
          </dd>
        </div>
      </dl>
      <section className="budget-editor-section budget-editor-cost">
        <div className="budget-editor-section-heading">
          <h3>Kebutuhan & biaya</h3>
          <p>
            {expense
              ? "Catat kebutuhan dan nilai yang kalian rencanakan."
              : "Perbarui harga dan pembayaran setelah konfirmasi vendor."}
          </p>
        </div>
        {expense ? (
          <>
            <Field label="Nama kebutuhan">
              {input("name", {
                required: true,
                placeholder: "Contoh: Souvenir tamu",
              })}
            </Field>
            <div className="form-grid">
              <Field label="Kategori">
                {input("category", {
                  required: true,
                  maxLength: 100,
                  list: "expense-categories",
                })}
                <datalist id="expense-categories">
                  {[
                    ...new Set([
                      "Konsumsi",
                      "Perlengkapan",
                      "Undangan",
                      "Souvenir",
                      "Penampilan",
                      "Seserahan",
                      "Transportasi",
                      "Administrasi",
                      "Lainnya",
                      ...data.expenses.map((item) => item.category),
                    ]),
                  ].map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </Field>
              <Field label="Status harga">
                {select("status", [
                  ["estimate", "Masih estimasi"],
                  ["confirmed", "Sudah dikonfirmasi"],
                ])}
              </Field>
              <Field label="Jumlah">
                {input("quantity", {
                  type: "number",
                  min: 1,
                  max: 100000,
                  required: true,
                })}
              </Field>
              <Field label="Harga satuan (Rp)">
                {amount("unitPrice", { min: 0, max: 1e12, required: true })}
              </Field>
            </div>
            <Field
              label="Sudah dibayar (Rp)"
              hint="Total pembayaran yang sudah dilakukan untuk kebutuhan ini."
            >
              {amount("paid", { min: 0, max: total, required: true })}
            </Field>
          </>
        ) : (
          <>
            <p className="budget-package-editor-name">{data.package.name}</p>
            <Field label="Harga paket (Rp)">
              {amount("price", { min: 0, max: 1e12, required: true })}
            </Field>
            <Field label="Total dibayar (Rp)">
              {amount("packagePaid", { min: 0, max: total, required: true })}
            </Field>
          </>
        )}
        <Field label="Deskripsi / varian / catatan">
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, note: event.target.value }))
            }
            maxLength={2000}
            placeholder="Contoh: kain putih, bunga emerald. Ongkir dikonfirmasi terpisah."
          />
        </Field>
      </section>
      <section className="budget-editor-section budget-editor-vendor">
        <div className="budget-editor-section-heading">
          <h3>Vendor & kontak</h3>
          <p>Opsional. Simpan kontak agar mudah dihubungi kembali.</p>
        </div>
        <Field label="Nama vendor">
          {input("vendor", { placeholder: "Contoh: Niscala Decoration" })}
        </Field>
        <Field label="WhatsApp vendor" hint="Gunakan awalan 08 atau +62.">
          <input
            type="tel"
            value={form.contacts.whatsapp || ""}
            onChange={contact("whatsapp")}
            maxLength={100}
            placeholder="Contoh: 085925827004"
          />
        </Field>
        <Field label="Instagram vendor">
          <input
            type="url"
            value={form.contacts.instagram || ""}
            onChange={contact("instagram")}
            maxLength={2000}
            placeholder="https://www.instagram.com/nama_vendor"
          />
        </Field>
        <Field
          label="Tautan vendor"
          hint="Website, toko, atau referensi vendor lainnya."
        >
          <input
            type="url"
            value={form.contacts.link || ""}
            onChange={contact("link")}
            maxLength={2000}
            placeholder="https://..."
          />
        </Field>
      </section>
      <section className="budget-editor-checklist">
        <TaskSelector
          tasks={data.tasks}
          selected={form.taskIds[0] || ""}
          onChange={(taskId) =>
            setForm((previous) => ({
              ...previous,
              taskIds: taskId ? [taskId] : [],
            }))
          }
          mode={taskMode}
          onModeChange={onTaskModeChange}
          draft={newTask}
          onDraftChange={setNewTask}
          owners={owners}
        />
      </section>
      <section className="budget-editor-section budget-editor-attachments">
        <div className="budget-editor-section-heading">
          <h3>Lampiran & referensi</h3>
          <p>
            Simpan nota, bukti pembayaran, dokumen penawaran, atau tautan vendor.
          </p>
        </div>
        <AttachmentEditor
          attachments={form.attachments || []}
          onChange={(update) =>
            setForm((previous) => ({
              ...previous,
              attachments: update(previous.attachments || []),
            }))
          }
          onBusyChange={onBusyChange}
          linkName={form.linkName || ""}
          linkUrl={form.linkUrl || ""}
          onLinkDraft={(linkName, linkUrl) =>
            setForm((previous) => ({ ...previous, linkName, linkUrl }))
          }
          disabled={disabled}
        />
      </section>
    </>
  );
}
