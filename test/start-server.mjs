import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fixturePlans } from "./fixtures.mjs";

const folder = mkdtempSync(path.join(tmpdir(), "ruang-kita-e2e-"));
const dataFile = path.join(folder, "wedding.json");
writeFileSync(dataFile, JSON.stringify(fixturePlans.wedding));
writeFileSync(
  path.join(folder, "lamaran.json"),
  JSON.stringify(fixturePlans.engagement),
);
writeFileSync(
  path.join(folder, "wedding-gedung.json"),
  JSON.stringify(fixturePlans.hall),
);
process.env.WEDDING_DATA_FILE = dataFile;
process.env.PORT = "4311";
process.env.HOST = "127.0.0.1";
process.on("exit", () => rmSync(folder, { recursive: true, force: true }));
await import("../server.mjs");
