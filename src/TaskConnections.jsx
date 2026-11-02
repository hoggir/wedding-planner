import { Check, LinkSimple } from "@phosphor-icons/react";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function TaskSelector({
  tasks,
  selected,
  onChange,
  mode,
  onModeChange,
  draft,
  onDraftChange,
  owners,
}) {
  const change = (key) => (event) =>
    onDraftChange({ ...draft, [key]: event.target.value });
  return (
    <fieldset className="task-connection-selector">
      <legend>Checklist terkait</legend>
      <div
        className="task-connection-modes"
        role="radiogroup"
        aria-label="Cara menghubungkan checklist"
      >
        <label>
          <input
            type="radio"
            name="checklist-mode"
            checked={mode === "select"}
            onChange={() => onModeChange("select")}
          />
          Pilih checklist yang ada
        </label>
        <label>
          <input
            type="radio"
            name="checklist-mode"
            checked={mode === "create"}
            onChange={() => onModeChange("create")}
          />
          Buat checklist baru
        </label>
      </div>
      {mode === "select" ? (
        <>
          <label className="field">
            <span>Checklist yang ada</span>
            <select
              aria-label="Checklist yang ada"
              value={selected}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Tanpa checklist</option>
              {tasks.map((task) => (
                <option value={task.id} key={task.id}>
                  {task.title} · {task.owner}
                  {task.done ? " · Selesai" : ""}
                </option>
              ))}
            </select>
          </label>
          <p>
            {tasks.length
              ? "Pilih maksimal satu tugas untuk kebutuhan ini."
              : "Belum ada tugas. Pilih Buat checklist baru untuk menambahkannya."}
          </p>
        </>
      ) : (
        <div className="new-linked-task-fields">
          <label className="field">
            <span>Judul checklist baru</span>
            <input
              value={draft.title}
              onChange={change("title")}
              required
              maxLength={300}
              placeholder="Contoh: Konfirmasi pesanan katering"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Kategori checklist baru</span>
              <input
                value={draft.category}
                onChange={change("category")}
                required
                maxLength={100}
              />
            </label>
            <label className="field">
              <span>Penanggung jawab checklist baru</span>
              <select
                aria-label="Penanggung jawab checklist baru"
                value={draft.owner}
                onChange={change("owner")}
              >
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Target tanggal checklist baru</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={change("dueDate")}
              />
            </label>
            <label className="field">
              <span>Prioritas checklist baru</span>
              <select
                aria-label="Prioritas checklist baru"
                value={draft.priority}
                onChange={change("priority")}
              >
                <option value="high">Prioritas</option>
                <option value="normal">Normal</option>
                <option value="low">Nanti</option>
              </select>
            </label>
          </div>
          <label className="field new-task-conclusion-field">
            <span>Jawaban / kesimpulan</span>
            <textarea
              rows={3}
              value={draft.conclusion}
              onChange={change("conclusion")}
              maxLength={2000}
              placeholder="Opsional. Catat keputusan atau hasil yang sudah diketahui."
            />
          </label>
          <p>Checklist baru dibuat dan dihubungkan saat menyimpan anggaran.</p>
        </div>
      )}
    </fieldset>
  );
}

export function TaskConclusion({ task }) {
  if (!task.conclusion?.trim()) return null;
  return (
    <span className="task-conclusion">
      <span className="task-conclusion-label">Kesimpulan</span>
      <span className="task-conclusion-text">{task.conclusion}</span>
    </span>
  );
}

export function BudgetTaskLinks({
  item,
  tasks,
  edit,
  onManage,
  onToggle,
  saving,
}) {
  const linked = tasks.filter((task) => item.taskIds?.includes(task.id));
  if (!linked.length)
    return (
      <button
        type="button"
        className="task-connection-manage"
        aria-label={`Hubungkan checklist untuk ${item.name}`}
        onClick={onManage}
        disabled={saving}
      >
        <LinkSimple size={14} /> Hubungkan checklist
      </button>
    );
  return (
    <div className="budget-task-links">
      <div className="budget-task-heading">
        <span>
          Checklist · {linked.filter((task) => task.done).length} /{" "}
          {linked.length} selesai
        </span>
        <button
          type="button"
          onClick={onManage}
          disabled={saving}
          aria-label={`Ubah checklist untuk ${item.name}`}
        >
          Ubah
        </button>
      </div>
      {linked.map((task) => (
        <div className={`linked-task ${task.done ? "done" : ""}`} key={task.id}>
          <button
            type="button"
            className="check-button"
            aria-label={`${task.done ? "Buka kembali" : "Selesaikan"}: ${task.title}`}
            aria-pressed={task.done}
            disabled={saving}
            onClick={() => onToggle(task)}
          >
            {task.done && <Check size={12} weight="bold" />}
          </button>
          <button
            type="button"
            className="linked-task-title"
            aria-label={`Buka tugas ${task.title}`}
            onClick={() => edit("task", task)}
          >
            <span className="linked-task-label">{task.title}</span>
            <TaskConclusion task={task} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function TaskBudgetLinks({ links, edit }) {
  if (!links.length) return null;
  return (
    <div className="task-budget-links" aria-label="Anggaran terkait">
      {links.map(({ kind, item, total }) => (
        <button
          type="button"
          className="linked-budget-button"
          key={`${kind}-${item.id || "package"}`}
          aria-label={`Buka anggaran ${item.name}`}
          onClick={() =>
            kind === "package" ? edit("packagePayment") : edit("expense", item)
          }
        >
          <LinkSimple size={13} />
          <span>
            {item.name} · {money(total)}
          </span>
        </button>
      ))}
    </div>
  );
}
