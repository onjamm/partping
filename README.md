# partping

Polls Row52 (row52.com) for junkyard vehicle listings matching your saved
searches (make/model/year range, zip + radius) and sends an [ntfy.sh](https://ntfy.sh)
push notification for any listing we haven't alerted on before. No UI, no
database — a flat JSON file tracks seen VINs.

## Status

v0, fully working: polls Row52, dedupes against seen VINs, sends ntfy
alerts, runs as a long-lived worker on Railway. Currently one watch
configured (1999-2001 BMW 3-Series). See `docs/row52-investigation.md`
for how to add more make/model watches — Row52 identifies them by
internal numeric IDs, not names, so each new one needs a quick manual
lookup.

## Setup

```bash
npm install    # no deps yet, but future-proofs this
export NTFY_TOPIC=pick-a-hard-to-guess-topic-name
```

`config.json` is committed to the repo (it's just your watch list — make,
model, year range, state, zip, radius — nothing secret). The one real
secret, `ntfy.topic`, is deliberately *not* in it: set it via the
`NTFY_TOPIC` env var instead (locally as above; on Railway, see Deploy
below). Anyone who knows your ntfy topic can read/publish to it on the
public ntfy.sh server, which is exactly why it isn't sitting in git history
— use a self-hosted ntfy server or its auth features if that's a bigger
concern for you. Subscribe to your topic in the ntfy app or at
https://ntfy.sh/<your-topic>.

Edit `config.json`'s `watches` array to match what you're actually
searching for. Each entry's `id` must stay stable once you've started
polling — it's the key used in the seen-VIN store, so renaming it means
getting re-alerted on everything.

## Run

```bash
npm run once    # single poll, then exit
npm start        # loop forever at config.pollIntervalMinutes
```

Seen VINs are stored per-watch in `data/seen.json` (created automatically,
gitignored). Override the path with `SEEN_STORE_PATH` — this is how a host
with ephemeral local disk (see Deploy below) points it at persistent
storage instead.

## Deploy (Railway)

This is meant to run as a long-lived background worker, not a scheduled
job — `npm start` polls forever on its own, so it just needs somewhere
that's actually always on.

1. Push this repo to GitHub (already done if you're reading this from
   there).
2. In Railway: **New Project → Deploy from GitHub repo** → select this
   repo. Railway auto-detects it as a Node app via Nixpacks and
   `railway.json` tells it to run `npm start` with an on-failure restart
   policy.
3. Add a **Volume** to the service, mounted at e.g. `/data`. Without this,
   `data/seen.json` lives on the container's ephemeral disk and gets wiped
   on every redeploy — you'd get re-alerted on every listing you've
   already seen.
4. Set env vars on the service:
   - `NTFY_TOPIC` — your real topic (required, see Setup above)
   - `SEEN_STORE_PATH` = `/data/seen.json` — points the seen-VIN store at
     the volume you just mounted
5. Deploy, then check the service logs to confirm it's polling on
   schedule (every `pollIntervalMinutes`, default 5).

## Tests

```bash
npm test
```

Uses Node's built-in test runner (`node:test`), no extra dependencies.
Covers config validation, the seen-VIN store, ntfy request-building (fetch
mocked), the poll loop's diff/notify/retry logic (search and notify are
injected, so this doesn't touch the network), and `row52.js`'s URL-building
and HTML parsing — the parser is tested against a real captured Row52 page
(`test/fixtures/row52-search.html`), not a guess at the markup.

## Layout

- `src/config.js` — loads and validates `config.json`
- `src/row52.js` — Row52 search client (builds the search URL, parses results)
- `src/seenStore.js` — flat-JSON seen-VIN tracking
- `src/notify.js` — ntfy.sh push notifications
- `src/poll.js` — CLI entry point / poll loop
- `test/` — unit tests (`npm test`), including a real Row52 page fixture
