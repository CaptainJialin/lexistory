import test from "node:test";
import assert from "node:assert/strict";
import { readApiBody, validApiBody } from "../lib/api-request";

test("speech rejects malformed or excessive input without provider calls", () => {
  assert.equal(validApiBody("speech", { text: 42 }), false);
  assert.equal(validApiBody("speech", { text: "a".repeat(1001) }), false);
  assert.equal(validApiBody("speech", { text: "A short sentence." }), true);
});
test("large/chunked and non-JSON API requests are rejected", async () => {
  const large = await readApiBody(new Request("https://example.test/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: "a".repeat(100000) }), "speech");
  assert.equal(large.error?.status, 413);
  const invalid = await readApiBody(new Request("https://example.test/api/speech", { method: "POST", body: "hi" }), "speech");
  assert.equal(invalid.error?.status, 415);
});
