# Adding a new Row52 watch (make/model)

Row52 identifies make and model by internal numeric IDs (`MakeId`,
`ModelId`) — not names — and there's no known public endpoint that lists
them. To add a watch for a new make/model, find its IDs manually:

1. Go to [row52.com](https://row52.com), use the search form (Year, Make,
   Model, plus a zip + radius).
2. Submit the search — the resulting page URL contains the IDs, e.g.:
   ```
   https://row52.com/Search/?YMMorVin=YMM&Year=1999-2001&ZipCode=98385&Page=1&ModelId=1150&MakeId=90&LocationId=&IsVin=false&Distance=50
   ```
   `MakeId=90` and `ModelId=1150` there are BMW / 3-Series.
3. Add a new entry to `config.json`'s `watches` array using those IDs:
   ```json
   {
     "id": "some-stable-id",
     "label": "human-readable label for notifications",
     "make": "BMW",
     "model": "3-Series",
     "makeId": 90,
     "modelId": 1150,
     "yearMin": 1999,
     "yearMax": 2001,
     "savedSearchRadiusMiles": 50,
     "zip": "98385"
   }
   ```
   `make`/`model` are just for display in notifications — `makeId`/`modelId`
   are what actually drive the search.

## How the search itself works (for reference)

`src/row52.js` builds a GET request to `https://row52.com/Search/` with
those params (see `buildSearchUrl`). No session or auth needed — it's a
plain public page. Results come back as server-rendered HTML with each
listing's data embedded as schema.org microdata
(`<meta itemprop="vin" content="...">` etc.), which `parseListings` reads.
`test/fixtures/row52-search.html` is a real captured page used to test the
parser against actual markup instead of a guess.

**Known limitation:** only page 1 is fetched. Fine for a narrow watch, but
a watch broad enough to return more than one page of results would miss
anything past the first page — pagination isn't implemented.
