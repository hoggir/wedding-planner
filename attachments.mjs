import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  FILE_TYPES,
  MAX_ATTACHMENTS,
  MAX_UPLOAD_BYTES,
} from "./attachment-config.js";

const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const text = (v, limit) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= limit;

export function validateAttachments(attachments) {
  if (attachments === undefined) return;
  if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS)
    throw new Error("Lampiran maksimal 20 per kebutuhan.");
  const ids = new Set();
  for (const a of attachments) {
    if (!a || !text(a.id, 100) || ids.has(a.id) || !text(a.name, 255))
      throw new Error("Nama atau ID lampiran tidak valid atau duplikat.");
    ids.add(a.id);
    if (a.kind === "link") {
      let url;
      try {
        url = new URL(a.url);
      } catch {
        throw new Error("Tautan lampiran tidak valid.");
      }
      if (
        !text(a.url, 2000) ||
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(
          "Tautan lampiran harus menggunakan http atau https tanpa kredensial.",
        );
    } else if (a.kind === "file") {
      if (
        !uuid.test(a.id) ||
        a.url !== `/api/attachments/${a.id}` ||
        !Object.values(FILE_TYPES).includes(a.contentType) ||
        !Number.isInteger(a.size) ||
        a.size < 1 ||
        a.size > MAX_UPLOAD_BYTES
      )
        throw new Error("Data file lampiran tidak valid.");
    } else throw new Error("Jenis lampiran harus file atau link.");
  }
}

export async function storeAttachment(directory, originalName, content) {
  if (!text(originalName, 500)) throw new Error("Nama file tidak valid.");
  const name = path
    .basename(originalName.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .normalize("NFC");
  if (!text(name, 255))
    throw new Error("Nama file terlalu panjang atau kosong.");
  const contentType = FILE_TYPES[path.extname(name).toLowerCase()];
  if (!contentType)
    throw new Error(
      "Format belum didukung. Gunakan PDF, dokumen Office/OpenDocument, TXT, CSV, JPG, PNG, WEBP, atau GIF.",
    );
  if (!content.length) throw new Error("File kosong tidak dapat diunggah.");
  if (content.length > MAX_UPLOAD_BYTES)
    throw new Error("Ukuran file maksimal 10 MB.");
  const header = content.subarray(0, 12);
  const validImage = {
    "image/png": header
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": header.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    "image/gif": ["GIF87a", "GIF89a"].includes(
      header.subarray(0, 6).toString(),
    ),
    "image/webp":
      header.subarray(0, 4).toString() === "RIFF" &&
      header.subarray(8, 12).toString() === "WEBP",
  };
  if (contentType.startsWith("image/") && !validImage[contentType])
    throw new Error("Isi gambar tidak sesuai dengan format file.");
  const id = randomUUID();
  const metadata = {
    id,
    kind: "file",
    name,
    url: `/api/attachments/${id}`,
    size: content.length,
    contentType,
  };
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, id), content, { flag: "wx" });
  try {
    await writeFile(
      path.join(directory, `${id}.json`),
      JSON.stringify(metadata),
      { flag: "wx" },
    );
  } catch (error) {
    await unlink(path.join(directory, id));
    throw error;
  }
  return metadata;
}

export async function readAttachment(directory, id) {
  if (!uuid.test(id)) throw new Error("ID lampiran tidak valid.");
  const metadata = JSON.parse(
    await readFile(path.join(directory, `${id}.json`), "utf8"),
  );
  validateAttachments([metadata]);
  if (metadata.id !== id) throw new Error("ID lampiran tidak sesuai.");
  return { metadata, content: await readFile(path.join(directory, id)) };
}
