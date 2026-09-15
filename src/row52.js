// Row52 (row52.com) search client.
//
// STATUS: NOT YET IMPLEMENTED. Row52's actual search request/response shape
// has not been captured yet — see docs/row52-investigation.md for what's
// needed and how to grab it. This file is deliberately a stub so the rest
// of the pipeline (config, seen-VIN store, ntfy notifications, poll loop)
// can be built and tested without guessing at an API we haven't observed.
//
// Once we have a real capture, replace the body of `searchRow52` with an
// actual fetch() call and a parser for the real response shape. The `watch`
// object below is intentionally provider-agnostic so a future non-Row52
// source could reuse the same shape.

/**
 * @param {object} watch - one entry from config.json `watches`
 * @param {string} watch.make
 * @param {string} watch.model
 * @param {number} watch.yearMin
 * @param {number} watch.yearMax
 * @param {string} watch.state
 * @param {string} watch.zip
 * @param {number} watch.savedSearchRadiusMiles
 * @returns {Promise<Array<{vin: string, make: string, model: string, year: number, yard: string, url: string, dateAdded?: string}>>}
 */
export async function searchRow52(watch) {
  throw new Error(
    `searchRow52() is not implemented yet for watch "${watch.id}". ` +
      "Row52's request/response shape hasn't been captured — see docs/row52-investigation.md.",
  );
}
