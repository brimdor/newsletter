import test from "node:test";
import assert from "node:assert/strict";
import { isValidSourceUrl, normalizeStatus, fallbackContent } from "./validation.js";

test("isValidSourceUrl rejects placeholders and invalid urls", () => {
  assert.equal(isValidSourceUrl("https://example.com/story"), false);
  assert.equal(isValidSourceUrl("http://localhost:3000"), false);
  assert.equal(isValidSourceUrl("notaurl"), false);
});

test("isValidSourceUrl accepts real http(s)", () => {
  assert.equal(isValidSourceUrl("https://example.org/story"), true);
});

test("normalizeStatus and fallbackContent handle missing content", () => {
  assert.equal(normalizeStatus("ready", ""), "unavailable");
  assert.match(fallbackContent("unavailable"), /unavailable/i);
});
