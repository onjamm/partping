import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeVin } from "../src/vinDecode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("decodeVin extracts bodyClass and model from a real NHTSA response", async (t) => {
  const json = await readFile(path.join(__dirname, "fixtures/nhtsa-decode-vin.json"), "utf8");
  let requestedUrl;

  t.mock.method(globalThis, "fetch", async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => JSON.parse(json) };
  });

  const decoded = await decodeVin("WBAAV53431FJ63013");

  assert.deepEqual(decoded, { bodyClass: "Sedan/Saloon", model: "330i" });
  assert.equal(requestedUrl, "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/WBAAV53431FJ63013?format=json");
});

test("decodeVin treats empty-string fields as absent, not blank strings", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ Results: [{ BodyClass: "", Model: "" }] }),
  }));

  const decoded = await decodeVin("SOMEVIN");
  assert.deepEqual(decoded, { bodyClass: undefined, model: undefined });
});

test("decodeVin returns null (never throws) on a non-ok response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false }));
  assert.equal(await decodeVin("SOMEVIN"), null);
});

test("decodeVin returns null (never throws) when fetch itself fails", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });
  assert.equal(await decodeVin("SOMEVIN"), null);
});

test("decodeVin returns null on an unexpected/empty response shape", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ Results: [] }) }));
  assert.equal(await decodeVin("SOMEVIN"), null);
});
