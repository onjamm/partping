# partping

Polls Row52 (row52.com) for junkyard vehicle listings matching your saved
searches (make/model/year range, state, radius) and sends an [ntfy.sh](https://ntfy.sh)
push notification for any listing we haven't alerted on before. No UI, no
database — a flat JSON file tracks seen VINs.

## Status

v0 scaffold. `src/row52.js` is a **stub** — Row52's actual search
request/response shape hasn't been captured yet (row52.com was unreachable
from the sandbox that built this). See `docs/row52-investigation.md` for
what's needed and how to capture it; once that's filled in, `searchRow52()`
is the only thing left to implement.

Everything else (config loading, the seen-VIN store, ntfy notifications,
the poll loop) is built and ready.

## Setup

```bash
npm install    # no deps yet, but future-proofs this
cp config.example.json config.json
```

Edit `config.json`:
- `ntfy.topic` — pick a hard-to-guess topic name (anyone who knows it can
  read/publish to it on the public ntfy.sh server; use a self-hosted
  server or ntfy's auth features if that's a concern). Subscribe to it in
  the ntfy app or at https://ntfy.sh/<your-topic>.
- `watches` — one entry per saved search. `id` must be stable (it's the
  key used in the seen-VIN store) — don't rename it once you've started
  polling, or you'll get re-alerted on everything.

## Run

```bash
npm run once    # single poll, then exit
npm start        # loop forever at config.pollIntervalMinutes
```

Seen VINs are stored per-watch in `data/seen.json` (created automatically,
gitignored).

## Layout

- `src/config.js` — loads and validates `config.json`
- `src/row52.js` — Row52 search client (**stub**, see Status above)
- `src/seenStore.js` — flat-JSON seen-VIN tracking
- `src/notify.js` — ntfy.sh push notifications
- `src/poll.js` — CLI entry point / poll loop
