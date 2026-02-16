import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.ok, true, `Expected ${path} to be reachable`);
  return response.json();
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.ok, true, `Expected ${path} to be reachable`);
  return response.text();
}

const indexHtml = await getText("/");
assert.match(indexHtml, /id="overlay"/, "Overlay container must exist in UI HTML");
assert.match(indexHtml, /id="source-content"/, "Overlay content region must exist in UI HTML");

const artifact = await getJson("/local-site-artifact.json");
assert.equal(artifact.type, "web_app_local_site", "Local site artifact type mismatch");
assert.equal(artifact.status, "ready", "Local site artifact must be ready");

const items = await getJson("/api/newsletter/items");
assert.ok(Array.isArray(items) && items.length > 0, "Items payload must be non-empty");
assert.equal(items.some((item) => (item.sourceUrl || "").includes("example.com")), false, "Items must not expose example.com links");

const firstItem = items[0];
const source = await getJson(`/api/newsletter/items/${firstItem.id}/source`);
assert.ok(source.sourceTitle, "Source title must be returned");
assert.ok(source.status === "ready" || source.status === "unavailable", "Source status must be ready|unavailable");

console.log("showcase visual+contract check passed", {
  checkedAt: new Date().toISOString(),
  baseUrl,
  itemId: firstItem.id,
  status: source.status
});
