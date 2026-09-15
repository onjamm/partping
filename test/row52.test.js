import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSearchUrl, parseListings, searchRow52 } from "../src/row52.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const watch = {
  id: "e46-328i-prefacelift",
  yearMin: 1999,
  yearMax: 2001,
  zip: "98385",
  makeId: 90,
  modelId: 1150,
  savedSearchRadiusMiles: 50,
};

test("buildSearchUrl matches Row52's real search URL shape", () => {
  const url = buildSearchUrl(watch);
  const parsed = new URL(url);

  assert.equal(parsed.origin + parsed.pathname, "https://row52.com/Search/");
  assert.equal(parsed.searchParams.get("YMMorVin"), "YMM");
  assert.equal(parsed.searchParams.get("Year"), "1999-2001");
  assert.equal(parsed.searchParams.get("ZipCode"), "98385");
  assert.equal(parsed.searchParams.get("MakeId"), "90");
  assert.equal(parsed.searchParams.get("ModelId"), "1150");
  assert.equal(parsed.searchParams.get("Distance"), "50");
  assert.equal(parsed.searchParams.get("IsVin"), "false");
});

test("parseListings extracts all 5 listings from a real captured Row52 page", async () => {
  const html = await readFile(path.join(__dirname, "fixtures/row52-search.html"), "utf8");
  const listings = parseListings(html);

  assert.equal(listings.length, 5);

  const first = listings[0];
  assert.equal(first.vin, "WBAAV53431FJ63013");
  assert.equal(first.make, "BMW");
  assert.equal(first.model, "3-Series");
  assert.equal(first.year, 2001);
  assert.equal(first.row, "24");
  assert.equal(first.dateAdded, "Sep 03, 2026");
  assert.equal(first.yard, "PICK-n-PULL Tacoma — Lakewood, Washington 98499");
  assert.equal(first.url, "https://row52.com/Vehicle/Index/WBAAV53431FJ63013");
});

test("parseListings picks up every VIN, not just the first", async () => {
  const html = await readFile(path.join(__dirname, "fixtures/row52-search.html"), "utf8");
  const listings = parseListings(html);
  const vins = listings.map((l) => l.vin);

  assert.deepEqual(vins, [
    "WBAAV53431FJ63013",
    "WBABN53451JU35580",
    "WBABN33491JW56961",
    "WBAAM5331YJR56358",
    "WBAAN37401ND49292",
  ]);
});

test("parseListings returns [] for a page with no results", () => {
  assert.deepEqual(parseListings("<html><body>0 Results</body></html>"), []);
});

test("searchRow52 fetches the built URL and returns parsed listings", async (t) => {
  const html = await readFile(path.join(__dirname, "fixtures/row52-search.html"), "utf8");
  let requestedUrl;

  t.mock.method(globalThis, "fetch", async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, statusText: "OK", text: async () => html };
  });

  const listings = await searchRow52(watch);

  assert.equal(listings.length, 5);
  assert.match(requestedUrl, /^https:\/\/row52\.com\/Search\/\?/);
  assert.match(requestedUrl, /MakeId=90/);
});

test("searchRow52 throws with status detail on a non-ok response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
  }));

  await assert.rejects(() => searchRow52(watch), /503.*Service Unavailable/);
});
