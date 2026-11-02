import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPlan, savePlan } from "./plan.mjs";
import { storeAttachment, readAttachment } from "./attachments.mjs";
import { MAX_UPLOAD_BYTES } from "./attachment-config.js";
import { initializePlans } from "./data-init.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile =
  process.env.WEDDING_DATA_FILE || path.join(root, "data/wedding.json");
const planFiles = {
  wedding: dataFile,
  weddingHall:
    process.env.HALL_DATA_FILE ||
    path.join(path.dirname(dataFile), "wedding-gedung.json"),
  engagement:
    process.env.ENGAGEMENT_DATA_FILE ||
    path.join(path.dirname(dataFile), "lamaran.json"),
};
const port = Number(process.env.PORT || 4310);
const host = process.env.HOST || "127.0.0.1";
const uploadsDirectory = path.join(path.dirname(dataFile), "uploads");
const dev = process.argv.includes("--dev");
await initializePlans(planFiles);
await readPlan(dataFile);
await readPlan(planFiles.engagement);
await readPlan(planFiles.weddingHall);
const vite = dev
  ? await (
      await import("vite")
    ).createServer({ root, server: { middlewareMode: true }, appType: "spa" })
  : null;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  const json = (status, payload) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(payload));
  };
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/packages") {
      if (req.method !== "GET")
        return json(405, { error: "Metode tidak didukung." });
      const catalog = JSON.parse(
        await readFile(path.join(root, "data/packages.json"), "utf8"),
      );
      return json(200, catalog);
    }
    if (
      ["POST", "PUT"].includes(req.method) &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    )
      return json(403, { error: "Asal permintaan tidak diizinkan." });
    if (url.pathname === "/api/attachments") {
      if (req.method !== "POST")
        return json(405, { error: "Metode tidak didukung." });
      if (Number(req.headers["content-length"]) > MAX_UPLOAD_BYTES)
        return json(413, { error: "Ukuran file maksimal 10 MB." });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES)
          return json(413, { error: "Ukuran file maksimal 10 MB." });
        chunks.push(chunk);
      }
      try {
        const name = decodeURIComponent(req.headers["x-file-name"] || "");
        return json(
          201,
          await storeAttachment(uploadsDirectory, name, Buffer.concat(chunks)),
        );
      } catch (error) {
        return json(400, { error: error.message });
      }
    }
    if (url.pathname.startsWith("/api/attachments/")) {
      if (!["GET", "HEAD"].includes(req.method))
        return json(405, { error: "Metode tidak didukung." });
      try {
        const { metadata, content } = await readAttachment(
          uploadsDirectory,
          url.pathname.slice("/api/attachments/".length),
        );
        const disposition = metadata.contentType.startsWith("image/")
          ? "inline"
          : "attachment";
        res.writeHead(200, {
          "Content-Type": metadata.contentType,
          "Content-Length": content.length,
          "Content-Disposition": `${disposition}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        });
        return res.end(req.method === "HEAD" ? undefined : content);
      } catch {
        return json(404, { error: "Lampiran tidak ditemukan di server ini." });
      }
    }
    if (url.pathname === "/api/plan") {
      const eventType = url.searchParams.get("event") || "wedding";
      if (!["wedding", "engagement"].includes(eventType))
        return json(400, { error: "Jenis rencana tidak dikenal." });
      const scenario = url.searchParams.get("scenario") || "home";
      if (
        !["home", "hall"].includes(scenario) ||
        (eventType === "engagement" && url.searchParams.has("scenario"))
      )
        return json(400, { error: "Skenario rencana tidak dikenal." });
      const key =
        eventType === "wedding" && scenario === "hall"
          ? "weddingHall"
          : eventType;
      const selectedFile = planFiles[key];
      if (req.method === "GET") return json(200, await readPlan(selectedFile));
      if (req.method !== "PUT")
        return json(405, { error: "Metode tidak didukung." });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return json(415, { error: "Gunakan JSON." });
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 8 * 1024 * 1024)
          return json(413, { error: "File maksimal 8 MB." });
      }
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return json(400, { error: "JSON tidak dapat dibaca." });
      }
      try {
        if ((payload?.data?.eventType || "wedding") !== eventType)
          return json(400, {
            error: "Jenis JSON tidak sesuai dengan rencana yang sedang dibuka.",
          });
        if (
          eventType === "wedding" &&
          (payload?.data?.scenario || "home") !== scenario
        )
          return json(400, {
            error:
              "Skenario JSON tidak sesuai dengan rencana yang sedang dibuka.",
          });
        return json(
          200,
          await savePlan(selectedFile, payload.data, payload.revision),
        );
      } catch (error) {
        return json(error.code === "CONFLICT" ? 409 : 400, {
          error: error.message,
        });
      }
    }
    if (url.pathname.startsWith("/api/"))
      return json(404, { error: "Tidak ditemukan." });
    if (vite) return vite.middlewares(req, res);
    if (!["GET", "HEAD"].includes(req.method))
      return json(405, { error: "Metode tidak didukung." });
    const dist = path.join(root, "dist");
    const requested = path.resolve(
      dist,
      "." + decodeURIComponent(url.pathname),
    );
    if (!requested.startsWith(dist + path.sep) && requested !== dist)
      return json(403, { error: "Tidak diizinkan." });
    let file = requested;
    try {
      if (!(await stat(file)).isFile()) file = path.join(dist, "index.html");
    } catch {
      file = path.join(dist, "index.html");
    }
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control":
        path.basename(file) === "index.html"
          ? "no-cache"
          : "public, max-age=3600",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error("Permintaan gagal:", error.message);
    json(500, {
      error:
        "Data belum bisa dibaca. Periksa server dan validitas JSON rencana.",
    });
  }
});
server.listen(port, host, () =>
  console.log(
    `Ruang Kita siap: http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await vite?.close();
    server.close(() => process.exit(0));
  });
