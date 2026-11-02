import { useRef, useState } from "react";
import {
  ArrowUpRight,
  FileText,
  Link,
  Paperclip,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  FILE_TYPES,
  MAX_ATTACHMENTS,
  MAX_UPLOAD_BYTES,
} from "../attachment-config.js";
import { createId } from "../plan-client.js";

export function createLinkAttachment(name, value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(
      "Masukkan tautan lengkap, misalnya https://drive.google.com/…",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Tautan harus menggunakan http atau https tanpa kredensial.",
    );
  return {
    id: createId(),
    kind: "link",
    name: name.trim() || url.hostname,
    url: url.href,
  };
}

export function AttachmentSummary({
  attachments = [],
  onManage,
  name,
  compact = false,
  limit = 3,
}) {
  if (compact && !attachments.length) return null;
  return (
    <div className={`expense-attachments ${compact ? "compact" : ""}`}>
      {!!attachments.length && (
        <div className="attachment-chips">
          {attachments.slice(0, limit).map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="attachment-chip"
              title={a.name}
            >
              {a.kind === "link" ? <Link size={12} /> : <FileText size={12} />}
              <span>{a.name}</span>
              <ArrowUpRight size={11} />
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className="attachment-manage"
        onClick={onManage}
        aria-label={`Lampiran ${name}`}
      >
        <Paperclip size={14} />
        {attachments.length
          ? `${attachments.length} lampiran · Kelola`
          : compact
            ? "Lampiran"
            : "Tambah lampiran"}
      </button>
    </div>
  );
}

export default function AttachmentEditor({
  attachments,
  onChange,
  onBusyChange,
  linkName,
  linkUrl,
  onLinkDraft,
  disabled,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const busy = disabled || !!uploading;
  async function uploadFiles(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    setError("");
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setError("Maksimal 20 lampiran per kebutuhan.");
      return;
    }
    setUploading("Menyiapkan unggahan…");
    onBusyChange(true);
    const uploaded = [];
    const errors = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploading(`Mengunggah ${i + 1} dari ${files.length}…`);
        try {
          if (!file.size) throw new Error("File kosong.");
          if (file.size > MAX_UPLOAD_BYTES)
            throw new Error("Ukuran maksimal 10 MB.");
          const response = await fetch("/api/attachments", {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "X-File-Name": encodeURIComponent(file.name),
            },
            body: file,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Unggahan gagal.");
          uploaded.push(result);
        } catch (e) {
          errors.push(`${file.name}: ${e.message}`);
        }
      }
      if (uploaded.length) onChange((previous) => [...previous, ...uploaded]);
      if (errors.length) setError(errors.join("\n"));
    } finally {
      setUploading("");
      onBusyChange(false);
    }
  }
  function addLink() {
    setError("");
    try {
      if (attachments.length >= MAX_ATTACHMENTS)
        throw new Error("Maksimal 20 lampiran per kebutuhan.");
      const link = createLinkAttachment(linkName, linkUrl);
      onChange((previous) => [...previous, link]);
      onLinkDraft("", "");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="attachment-editor">
      <button
        type="button"
        className="upload-zone"
        onClick={() => inputRef.current.click()}
        disabled={busy}
      >
        <span className="upload-zone-icon">
          <UploadSimple size={25} />
        </span>
        <strong>{uploading || "Pilih dokumen atau gambar"}</strong>
        <span>Bisa beberapa file sekaligus · Maksimal 10 MB per file</span>
        <small>PDF, Office, OpenDocument, TXT, CSV, JPG, PNG, WEBP, GIF</small>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={Object.keys(FILE_TYPES).join(",")}
        onChange={uploadFiles}
        aria-label="Unggah dokumen atau gambar"
        className="visually-hidden"
        disabled={busy}
      />
      <div className="attachment-link-form">
        <h3>
          <Link size={17} />
          Atau simpan tautan
        </h3>
        <label className="field">
          <span>Nama tautan (opsional)</span>
          <input
            value={linkName}
            onChange={(e) => onLinkDraft(e.target.value, linkUrl)}
            placeholder="Contoh: Penawaran vendor"
            maxLength={255}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
          />
        </label>
        <div className="attachment-link-row">
          <label className="field">
            <span>Alamat tautan</span>
            <input
              inputMode="url"
              value={linkUrl}
              onChange={(e) => onLinkDraft(linkName, e.target.value)}
              placeholder="https://…"
              maxLength={2000}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={addLink}
            disabled={busy || !linkUrl.trim()}
          >
            Tambahkan tautan
          </button>
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          <WarningCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      <div className="attachments-list">
        <div className="attachments-list-heading">
          <h3>Lampiran tersimpan di rencana</h3>
          <span>
            {attachments.length} / {MAX_ATTACHMENTS}
          </span>
        </div>
        {!attachments.length ? (
          <p className="attachment-empty">
            Belum ada lampiran. Tambahkan nota, gambar referensi, atau tautan
            penawaran.
          </p>
        ) : (
          attachments.map((a) => (
            <div className="attachment-item" key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="attachment-open"
              >
                {a.kind === "file" && a.contentType.startsWith("image/") ? (
                  <img src={a.url} alt={`Pratinjau ${a.name}`} loading="lazy" />
                ) : (
                  <span className="attachment-file-icon">
                    {a.kind === "link" ? (
                      <Link size={21} />
                    ) : (
                      <FileText size={21} />
                    )}
                  </span>
                )}
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {a.kind === "link"
                      ? new URL(a.url).hostname
                      : `${a.size >= 1024 * 1024 ? `${(a.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(a.size / 1024))} KB`} · ${a.contentType.startsWith("image/") ? "Buka gambar" : "Unduh dokumen"}`}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </a>
              <button
                type="button"
                className="icon-button"
                aria-label={`Hapus lampiran ${a.name}`}
                onClick={() =>
                  onChange((previous) =>
                    previous.filter((item) => item.id !== a.id),
                  )
                }
                disabled={busy}
              >
                <Trash size={17} />
              </button>
            </div>
          ))
        )}
      </div>
      <p className="attachment-save-hint">
        Klik Simpan perubahan untuk menerapkan penambahan atau penghapusan
        lampiran.
      </p>
    </div>
  );
}
