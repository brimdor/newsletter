import test from "node:test";
import assert from "node:assert/strict";
import server from "./server.js";

let listener;
let baseUrl;

test.before(async () => {
  listener = server.listen(0);
  await new Promise((resolve) => listener.once("listening", resolve));
  const { port } = listener.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => listener.close((err) => (err ? reject(err) : resolve())));
});

test("items endpoint returns no placeholder source URLs", async () => {
  const response = await fetch(`${baseUrl}/api/newsletter/items`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.length > 0);
  assert.equal(payload.some((item) => item.sourceUrl?.includes("example.com")), false);
});

test("source endpoint returns content and fallback status", async () => {
  const ready = await fetch(`${baseUrl}/api/newsletter/items/item-001/source`);
  const readyJson = await ready.json();
  assert.equal(ready.status, 200);
  assert.equal(readyJson.status, "ready");
  assert.match(readyJson.content, /Edge AI Compression Report/);

  const unavailable = await fetch(`${baseUrl}/api/newsletter/items/item-002/source`);
  const unavailableJson = await unavailable.json();
  assert.equal(unavailable.status, 200);
  assert.equal(unavailableJson.status, "unavailable");
  assert.match(unavailableJson.content, /unavailable/i);
});

test("local site artifact is served from static root", async () => {
  const response = await fetch(`${baseUrl}/local-site-artifact.json`);
  assert.equal(response.status, 200);
  const artifact = await response.json();
  assert.equal(artifact.projectId, "proj-20260216-001");
  assert.equal(artifact.type, "web_app_local_site");
  assert.equal(artifact.status, "ready");
});
