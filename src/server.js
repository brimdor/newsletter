import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidSourceUrl, normalizeStatus, fallbackContent } from "./lib/validation.js";
import { sanitizeText } from "./lib/sanitize.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const uiDir = join(rootDir, "ui");
const dataPath = join(__dirname, "data", "newsletterItems.json");

async function loadItems() {
  const raw = await readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw);

  return parsed.map((item) => {
    const status = normalizeStatus(item.sourceContentStatus, item.content);
    const sourceUrl = isValidSourceUrl(item.sourceUrl) ? item.sourceUrl : null;

    return {
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      sourceTitle: sanitizeText(item.sourceTitle || "Source title unavailable"),
      sourceUrl,
      sourceContentStatus: status,
      content: status === "ready" ? sanitizeText(item.content) : fallbackContent(status)
    };
  });
}

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function serveStatic(res, path) {
  const filePath = join(uiDir, path === "/" ? "index.html" : path.replace(/^\//, ""));
  const ext = extname(filePath);
  if (!CONTENT_TYPES[ext]) return false;

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, "http://localhost");

  if (reqUrl.pathname === "/api/newsletter/items" && req.method === "GET") {
    const items = await loadItems();
    return sendJson(
      res,
      200,
      items.map(({ content, ...rest }) => rest)
    );
  }

  if (reqUrl.pathname.startsWith("/api/newsletter/items/") && reqUrl.pathname.endsWith("/source") && req.method === "GET") {
    const parts = reqUrl.pathname.split("/");
    const itemId = parts[4];
    const items = await loadItems();
    const item = items.find((entry) => entry.id === itemId);

    if (!item) {
      return sendJson(res, 404, { error: "Item not found" });
    }

    return sendJson(res, 200, {
      itemId: item.id,
      sourceTitle: item.sourceTitle,
      sourceUrl: item.sourceUrl,
      content: item.content,
      contentType: "text/markdown",
      status: item.sourceContentStatus
    });
  }

  if (await serveStatic(res, reqUrl.pathname)) return;

  sendJson(res, 404, { error: "Not found" });
});

const port = Number(process.env.PORT || 3000);
const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntry) {
  server.listen(port, () => {
    console.log(`newsletter app listening on :${port}`);
  });
}

export default server;
