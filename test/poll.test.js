import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runOnce, formatDateAdded } from "../src/poll.js";
import { saveSeenStore, loadSeenStore } from "../src/seenStore.js";

async function withConfig(watches, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "partping-test-"));
  const config = {
    ntfy: { server: "https://ntfy.example.com", topic: "t" },
    seenStorePath: path.join(dir, "seen.json"),
    watches,
  };
  try {
    await fn(config);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const listing = {
  vin: "VIN123",
  make: "BMW",
  model: "3 Series",
  year: 1999,
  yard: "Pick-n-Pull Tacoma",
  row: "24",
  dateAdded: "Sep 03, 2026",
  url: "https://row52.com/vin123",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pick-n-Pull+Tacoma",
  imageUrl: "https://cdn.row52.com/images/example.jpg",
};

test("a new listing gets notified and marked seen", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const notified = [];
    const newCount = await runOnce(config, {
      search: async () => [listing],
      notify: async (ntfy, payload) => notified.push(payload),
    });

    assert.equal(newCount, 1);
    assert.equal(notified.length, 1);
    assert.match(notified[0].title, /E46 328i/);
    assert.match(notified[0].message, /VIN123/);
    assert.match(notified[0].message, /Row: 24/);
    assert.match(notified[0].message, /Added to yard: Sep 03, 2026/);
    assert.equal(notified[0].directionsUrl, listing.mapsUrl);
    assert.equal(notified[0].imageUrl, listing.imageUrl);
    assert.equal(notified[0].priority, "high");

    const seen = await loadSeenStore(config.seenStorePath);
    assert.ok(seen.e46.VIN123);
  });
});

test("a listing missing row/dateAdded doesn't leak 'undefined' into the message", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const bareListing = { vin: "VIN999", make: "BMW", model: "3 Series", year: 1999, yard: "Pick-n-Pull Tacoma", url: "x" };
    const notified = [];
    await runOnce(config, {
      search: async () => [bareListing],
      notify: async (ntfy, payload) => notified.push(payload),
    });

    assert.doesNotMatch(notified[0].message, /undefined/);
    assert.doesNotMatch(notified[0].message, /Row:/);
    assert.doesNotMatch(notified[0].message, /Added to yard:/);
  });
});

test("a previously-seen listing is not re-notified", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    await saveSeenStore(config.seenStorePath, { e46: { VIN123: "2026-01-01T00:00:00.000Z" } });

    let notifyCalls = 0;
    const newCount = await runOnce(config, {
      search: async () => [listing],
      notify: async () => notifyCalls++,
    });

    assert.equal(newCount, 0);
    assert.equal(notifyCalls, 0);
  });
});

test("a failed notification is not marked seen, so it's retried next poll", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const newCount = await runOnce(config, {
      search: async () => [listing],
      notify: async () => {
        throw new Error("ntfy down");
      },
    });

    assert.equal(newCount, 0);
    const seen = await loadSeenStore(config.seenStorePath);
    assert.equal(seen.e46?.VIN123, undefined);
  });
});

test("a search failure on one watch doesn't stop the others", async () => {
  await withConfig(
    [
      { id: "broken", label: "Broken watch" },
      { id: "e46", label: "E46 328i" },
    ],
    async (config) => {
      const notified = [];
      const newCount = await runOnce(config, {
        search: async (watch) => {
          if (watch.id === "broken") throw new Error("boom");
          return [listing];
        },
        notify: async (ntfy, payload) => notified.push(payload),
      });

      assert.equal(newCount, 1);
      assert.equal(notified.length, 1);
    },
  );
});

test("the same VIN under two different watches is tracked independently", async () => {
  await withConfig(
    [
      { id: "watch-a", label: "Watch A" },
      { id: "watch-b", label: "Watch B" },
    ],
    async (config) => {
      let notifyCalls = 0;
      const newCount = await runOnce(config, {
        search: async () => [listing],
        notify: async () => notifyCalls++,
      });

      assert.equal(newCount, 2);
      assert.equal(notifyCalls, 2);
    },
  );
});

test("formatDateAdded annotates with a relative day count", () => {
  const now = new Date(2026, 8, 10); // Sep 10, 2026 (months are 0-indexed)

  assert.equal(formatDateAdded("Sep 10, 2026", now), "Sep 10, 2026 (today)");
  assert.equal(formatDateAdded("Sep 09, 2026", now), "Sep 09, 2026 (yesterday)");
  assert.equal(formatDateAdded("Sep 03, 2026", now), "Sep 03, 2026 (7 days ago)");
});

test("formatDateAdded falls back to the raw string when unparseable or in the future", () => {
  const now = new Date(2026, 8, 10);

  assert.equal(formatDateAdded("not a date", now), "not a date");
  assert.equal(formatDateAdded("Sep 15, 2026", now), "Sep 15, 2026");
  assert.equal(formatDateAdded(undefined, now), undefined);
});
