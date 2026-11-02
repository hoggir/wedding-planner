import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  storeAttachment,
  readAttachment,
  validateAttachments,
} from "../attachments.mjs";

test("lampiran menerima tautan HTTPS dan menolak URL aktif serta ID duplikat", () => {
  const link = {
    id: "proposal",
    kind: "link",
    name: "Penawaran vendor",
    url: "https://example.com/proposal",
  };
  assert.doesNotThrow(() => validateAttachments(undefined));
  assert.doesNotThrow(() => validateAttachments([link]));
  assert.throws(
    () => validateAttachments([{ ...link, url: "javascript:alert(1)" }]),
    /tautan/i,
  );
  assert.throws(
    () => validateAttachments([{ ...link, url: "/data/wedding.json" }]),
    /tautan/i,
  );
  assert.throws(() => validateAttachments([link, link]), /duplikat/i);
});

test("dokumen diunggah dengan nama aman dan dapat dibaca kembali persis", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "wedding-upload-"));
  try {
    const bytes = Buffer.from("%PDF-1.7\nNota vendor\n%%EOF");
    const attachment = await storeAttachment(
      directory,
      "Nota vendor.pdf",
      bytes,
    );
    assert.equal(attachment.name, "Nota vendor.pdf");
    assert.equal(attachment.kind, "file");
    assert.equal(attachment.size, bytes.length);
    assert.doesNotThrow(() => validateAttachments([attachment]));
    const stored = await readAttachment(directory, attachment.id);
    assert.deepEqual(stored.content, bytes);
    assert.equal(stored.metadata.contentType, "application/pdf");
    await assert.rejects(
      readAttachment(directory, "../wedding.json"),
      /lampiran/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unggahan kosong, tipe aktif, gambar palsu, dan file terlalu besar ditolak", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "wedding-upload-"));
  try {
    await assert.rejects(
      storeAttachment(directory, "nota.txt", Buffer.alloc(0)),
      /kosong/i,
    );
    await assert.rejects(
      storeAttachment(
        directory,
        "nota.html",
        Buffer.from("<script>1</script>"),
      ),
      /format/i,
    );
    await assert.rejects(
      storeAttachment(directory, "nota.png", Buffer.from("bukan gambar")),
      /gambar/i,
    );
    await assert.rejects(
      storeAttachment(
        directory,
        "nota.pdf",
        Buffer.alloc(10 * 1024 * 1024 + 1),
      ),
      /10 MB/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
