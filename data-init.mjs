import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const templates = {
  wedding: new URL("./data/examples/wedding.json", import.meta.url),
  weddingHall: new URL("./data/examples/wedding-gedung.json", import.meta.url),
  engagement: new URL("./data/examples/lamaran.json", import.meta.url),
};

export async function initializePlans(files) {
  for (const [type, file] of Object.entries(files)) {
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await copyFile(templates[type], file, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}
