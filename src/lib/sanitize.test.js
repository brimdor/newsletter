import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeText } from "./sanitize.js";

test("sanitizeText escapes html-sensitive characters", () => {
  const raw = '<img src=x onerror="alert(1)">';
  const out = sanitizeText(raw);
  assert.equal(out.includes("<img"), false);
  assert.match(out, /&lt;img/);
});
