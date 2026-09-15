# Row52 network investigation — needed before `src/row52.js` can be implemented

`row52.com` is blocked by this sandbox's outbound network policy, so this
couldn't be captured from inside the coding session. `src/row52.js` is a
stub until this is filled in.

## How to capture it

1. In Chrome/Firefox, open DevTools → Network tab, filter to **Fetch/XHR**.
2. Go to https://www.row52.com/ and use the search UI: search for a BMW,
   1999-2001, in Washington State, within your saved radius (whatever
   location/radius picker Row52 exposes — zip code, saved location, map
   pin, etc.).
3. Find the request(s) that fire when you submit the search or when
   results load. For each one, capture:
   - Full URL, including query string
   - HTTP method (GET/POST)
   - Request headers (especially anything like `Authorization`,
     `X-Api-Key`, a session/anti-forgery cookie or header — Row52 may
     require a session cookie from loading the page first)
   - Request body if POST (form-encoded or JSON — copy it verbatim)
   - Full response body (right-click the request → Copy → Copy Response,
     or the Preview/Response tab) — need real field names for VIN, make,
     model, year, yard/location name, row or spot number, date added,
     and anything like a listing detail URL or image.
4. Also capture how "yard" or "location" filtering actually works:
   - Is it a lat/lng + radius, a zip + radius, or a fixed list of yard
     IDs/codes you pick from?
   - If it's yard IDs: is there a separate endpoint that lists all yards
     (so we can find the Washington State ones within X miles of a zip),
     or is that resolved client-side from a static list on the page?
5. If the search page loads results without any visible XHR (i.e. it's
   server-rendered on GET with query params in the URL), that's simpler —
   just capture the full URL of the results page and the HTML structure
   around each result row instead.

## What to paste back

Paste the raw request/response details (redact anything that looks like a
personal session/auth token if you'd rather not share it, but flag that
one exists so `row52.js` can be written to require it).

## Once captured

Fill in `src/row52.js`:
- `searchRow52(watch)` should build the real request from `watch.make`,
  `watch.model`, `watch.yearMin/yearMax`, `watch.zip`,
  `watch.savedSearchRadiusMiles`, and return an array of
  `{ vin, make, model, year, yard, url, dateAdded }`.
- If Row52 needs a yard-ID list instead of zip+radius, add a one-time
  lookup (cached to a local JSON file, not re-fetched every poll) that
  resolves WA yards within radius of the configured zip, and use that
  set of yard IDs in the search request.
- If a session/cookie is required, fetch the search page once per run
  first to establish it, then reuse it for the actual search request(s).
