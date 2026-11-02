import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRoute, planHref, eventDetails } from "../events.js";
import { readPlan, savePlan, validatePlan } from "../plan.mjs";
import { fixturePlans } from "./fixtures.mjs";

test("tautan acara mempertahankan konteks dan URL pernikahan lama tetap berfungsi", () => {
  assert.deepEqual(parseRoute("#budget"), {
    eventType: "wedding",
    page: "budget",
  });
  assert.deepEqual(parseRoute("#lamaran/tasks"), {
    eventType: "engagement",
    page: "tasks",
  });
  assert.deepEqual(parseRoute("#lamaran"), {
    eventType: "engagement",
    page: "overview",
  });
  assert.equal(planHref("engagement", "guests"), "#lamaran/guests");
  assert.equal(planHref("wedding", "guests"), "#guests");
  assert.deepEqual(parseRoute("#gedung/budget"), {
    eventType: "weddingHall",
    page: "budget",
  });
  assert.equal(planHref("weddingHall", "package"), "#gedung/package");
});

test("lamaran menerima target yang belum ditentukan dan backup setiap acara disimpan terpisah", async () => {
  const wedding = structuredClone(fixturePlans.wedding);
  const engagement = structuredClone(fixturePlans.engagement);
  engagement.event.guestTarget = 0;
  assert.doesNotThrow(() => validatePlan(engagement));
  assert.equal(eventDetails(engagement).guestTarget, 0);
  const folder = await mkdtemp(path.join(tmpdir(), "ruang-kita-events-"));
  try {
    const weddingFile = path.join(folder, "wedding.json");
    const engagementFile = path.join(folder, "lamaran.json");
    await writeFile(weddingFile, JSON.stringify(wedding));
    await writeFile(engagementFile, JSON.stringify(engagement));
    const beforeWedding = await readPlan(weddingFile);
    const beforeEngagement = await readPlan(engagementFile);
    wedding.packagePaid = 0;
    engagement.event.guestTarget = 40;
    await savePlan(weddingFile, wedding, beforeWedding.revision);
    await savePlan(engagementFile, engagement, beforeEngagement.revision);
    assert.deepEqual((await readdir(path.join(folder, "backups"))).sort(), [
      "lamaran",
      "wedding",
    ]);
    assert.equal((await readPlan(engagementFile)).data.event.guestTarget, 40);
    assert.deepEqual((await readPlan(weddingFile)).data.guests, wedding.guests);
    await assert.rejects(
      savePlan(engagementFile, engagement, beforeWedding.revision),
      { code: "CONFLICT" },
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
