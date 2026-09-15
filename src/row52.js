// Row52 (row52.com) search client.
//
// Row52 renders search results server-side on a plain GET request — no
// session, no auth, no hidden JSON API. Each result is embedded as
// schema.org microdata (<meta itemprop="vin" ...> etc.) inside a
// `<div class="list-row">` block, which is what parseListings() reads.
// Captured against a real search on 2026-09-15 — see
// test/fixtures/row52-search.html for the actual page this was built from.
//
// Row52 identifies make/model by internal numeric IDs (MakeId/ModelId),
// not names, and there's no known public endpoint that lists them. To add
// a new make/model, search for it in Row52's own UI and read the IDs off
// the resulting URL (?...&MakeId=90&ModelId=1150&...) — see
// docs/row52-investigation.md.
//
// Known limitation: only fetches page 1. Fine for a narrow watch (single
// make/model within a radius), but a watch broad enough to exceed one
// page of results would miss anything past it.

const BASE_URL = "https://row52.com/Search/";

export function buildSearchUrl(watch) {
  const params = new URLSearchParams({
    YMMorVin: "YMM",
    Year: `${watch.yearMin}-${watch.yearMax}`,
    ZipCode: watch.zip,
    Page: "1",
    ModelId: String(watch.modelId),
    MakeId: String(watch.makeId),
    LocationId: "",
    IsVin: "false",
    Distance: String(watch.savedSearchRadiusMiles),
  });
  return `${BASE_URL}?${params}`;
}

export function parseListings(html) {
  const blocks = html.split('<div class="list-row">').slice(1);
  const listings = [];

  for (const block of blocks) {
    const vin = block.match(/<meta itemprop="vin" content="([^"]+)"/)?.[1];
    if (!vin) continue; // trailing footer/script content after the last real listing

    const make = block.match(/<meta itemprop="make" content="([^"]+)"/)?.[1] ?? "";
    const model = block.match(/<meta itemprop="model" content="([^"]+)"/)?.[1] ?? "";
    const year = block.match(/<meta itemprop="year" content="([^"]+)"/)?.[1];
    const yardName = block.match(/<span itemprop="name">\s*<strong>([^<]+)<\/strong>/)?.[1]?.trim();
    const yardAddress = block.match(/itemprop="address">([^<]+)</)?.[1]?.trim();
    const row = block
      .match(/<h4 class="mobile-title">Row<\/h4>\s*<div class="list-row-right">\s*<strong>([^<]+)<\/strong>/)?.[1]
      ?.trim();
    const dateAdded = block
      .match(/<h4 class="mobile-title">Added to yard<\/h4>\s*<div class="list-row-right">\s*<strong>([^<]+)<\/strong>/)?.[1]
      ?.trim();

    listings.push({
      vin,
      make,
      model,
      year: year ? Number(year) : undefined,
      yard: [yardName, yardAddress].filter(Boolean).join(" — "),
      row,
      dateAdded,
      url: `https://row52.com/Vehicle/Index/${vin}`,
    });
  }

  return listings;
}

export async function searchRow52(watch) {
  const url = buildSearchUrl(watch);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; partping/0.1; +https://github.com/onjamm/partping)",
    },
  });

  if (!res.ok) {
    throw new Error(`Row52 search failed: ${res.status} ${res.statusText}`);
  }

  return parseListings(await res.text());
}
