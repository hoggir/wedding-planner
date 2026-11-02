import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("inisialisasi membuat rencana contoh yang valid tanpa menimpa data yang sudah ada", async () => {
  const { initializePlans } = await import("../data-init.mjs");
  const { readPlan } = await import("../plan.mjs");
  const directory = await mkdtemp(path.join(tmpdir(), "wedding-init-"));
  const files = {
    wedding: path.join(directory, "plans", "wedding.json"),
    weddingHall: path.join(directory, "plans", "wedding-gedung.json"),
    engagement: path.join(directory, "plans", "lamaran.json"),
  };
  try {
    await initializePlans(files);
    for (const file of Object.values(files)) {
      const { data } = await readPlan(file);
      assert.equal(data.schemaVersion, 1);
      assert.deepEqual(data.guests, []);
      assert.deepEqual(data.notes, []);
    }
    const original = await readPlan(files.wedding);
    original.data.wedding.partnerOne = "Nama yang sudah disimpan";
    const existing = JSON.stringify(original.data, null, 2);
    await writeFile(files.wedding, existing);
    await initializePlans(files);
    assert.equal(await readFile(files.wedding, "utf8"), existing);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
