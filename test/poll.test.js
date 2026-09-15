import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runOnce, formatDateAdded } from "../src/poll.js";
import { saveSeenStore, loadSeenStore } from "../src/seenStore.js";

async function withConfig(watches, fn, extra = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "partping-test-"));
  const config = {
    ntfy: { server: "https://ntfy.example.com", topic: "t" },
    seenStorePath: path.join(dir, "seen.json"),
    watches,
    ...extra,
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
  yard: "Pick-n-Pull Tacoma — Lakewood, Washington 98499",
  yardName: "Pick-n-Pull Tacoma",
  yardAddress: "Lakewood, Washington 98499",
  row: "24",
  dateAdded: "Sep 03, 2026",
  url: "https://row52.com/vin123",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pick-n-Pull+Tacoma",
  imageUrl: "https://cdn.row52.com/images/example.jpg",
};

// runOnce defaults to the real decodeVin (a real network call) when no
// `decode` is injected — every test that isn't specifically exercising VIN
// decoding stubs it out so tests stay hermetic and fast.
const noDecode = async () => null;

test("a new listing gets notified and marked seen", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const notified = [];
    const newCount = await runOnce(config, {
      search: async () => [listing],
      notify: async (ntfy, payload) => notified.push(payload),
      decode: noDecode,
    });

    assert.equal(newCount, 1);
    assert.equal(notified.length, 1);
    assert.match(notified[0].title, /E46 328i/);
    assert.match(notified[0].message, /^\*\*1999 BMW 3 Series\*\*\n\n/); // title first, bold
    assert.match(notified[0].message, /VIN `VIN123`/);
    assert.match(notified[0].message, /Added Sep 03, 2026/);
    assert.match(notified[0].message, /Row 24 · Pick-n-Pull Tacoma · Lakewood, Washington 98499$/);
    assert.deepEqual(notified[0].actions, [{ label: "Get Directions", url: listing.mapsUrl }]);
    assert.equal(notified[0].imageUrl, listing.imageUrl);
    assert.equal(notified[0].priority, "high");
    assert.equal(notified[0].markdown, true);

    const seen = await loadSeenStore(config.seenStorePath);
    assert.ok(seen.e46.VIN123);
  });
});

test("adds a Check Options button from config.optionsCheckUrls, keyed by the watch's make", async () => {
  await withConfig(
    [{ id: "e46", label: "E46 328i", make: "BMW" }],
    async (config) => {
      const notified = [];
      await runOnce(config, {
        search: async () => [listing], // listing.make === "BMW"
        notify: async (ntfy, payload) => notified.push(payload),
        decode: noDecode,
      });

      assert.deepEqual(notified[0].actions, [
        { label: "Get Directions", url: listing.mapsUrl },
        { label: "Check Options", url: "https://bimmer.work/" },
      ]);
    },
    { optionsCheckUrls: { BMW: "https://bimmer.work/" } },
  );
});

test("a watch's own optionsCheckUrl overrides the make-level default", async () => {
  await withConfig(
    [{ id: "e46", label: "E46 328i", optionsCheckUrl: "https://custom.example.com/" }],
    async (config) => {
      const notified = [];
      await runOnce(config, {
        search: async () => [listing],
        notify: async (ntfy, payload) => notified.push(payload),
        decode: noDecode,
      });

      assert.deepEqual(notified[0].actions, [
        { label: "Get Directions", url: listing.mapsUrl },
        { label: "Check Options", url: "https://custom.example.com/" },
      ]);
    },
    { optionsCheckUrls: { BMW: "https://bimmer.work/" } },
  );
});

test("no Check Options button when neither the watch nor config has a match for the make", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const notified = [];
    await runOnce(config, {
      search: async () => [listing], // make: "BMW", but config.optionsCheckUrls is empty
      notify: async (ntfy, payload) => notified.push(payload),
      decode: noDecode,
    });

    assert.deepEqual(notified[0].actions, [{ label: "Get Directions", url: listing.mapsUrl }]);
  });
});

test("a listing missing row/dateAdded/yardAddress doesn't leak 'undefined' into the message", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const bareListing = { vin: "VIN999", make: "BMW", model: "3 Series", year: 1999, yardName: "Pick-n-Pull Tacoma", url: "x" };
    const notified = [];
    await runOnce(config, {
      search: async () => [bareListing],
      notify: async (ntfy, payload) => notified.push(payload),
      decode: noDecode,
    });

    assert.doesNotMatch(notified[0].message, /undefined/);
    assert.doesNotMatch(notified[0].message, /Added /);
    // no Added section at all -> exactly 3 sections (title, VIN, row/yard), not 4
    assert.equal(notified[0].message.split("\n\n").length, 3);
    assert.match(notified[0].message, /Pick-n-Pull Tacoma$/); // no row/address -> just the yard name
  });
});

test("a previously-seen listing is not re-notified", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    await saveSeenStore(config.seenStorePath, { e46: { VIN123: "2026-01-01T00:00:00.000Z" } });

    let notifyCalls = 0;
    const newCount = await runOnce(config, {
      search: async () => [listing],
      notify: async () => notifyCalls++,
      decode: noDecode,
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
      decode: noDecode,
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
        decode: noDecode,
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
        decode: noDecode,
      });

      assert.equal(newCount, 2);
      assert.equal(notifyCalls, 2);
    },
  );
});

test("a decoded model takes precedence over Row52's generic model in the title", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const notified = [];
    await runOnce(config, {
      search: async () => [listing], // listing.model === "3 Series"
      notify: async (ntfy, payload) => notified.push(payload),
      decode: async () => ({ bodyClass: "Sedan/Saloon", model: "330i" }),
    });

    assert.match(notified[0].message, /^\*\*1999 BMW 330i · Sedan\/Saloon\*\*/);
    assert.doesNotMatch(notified[0].message, /3 Series/);
  });
});

test("a decoded bodyClass with no decoded model still uses Row52's model in the title", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const notified = [];
    await runOnce(config, {
      search: async () => [listing],
      notify: async (ntfy, payload) => notified.push(payload),
      decode: async () => ({ bodyClass: "Sedan/Saloon", model: undefined }),
    });

    assert.match(notified[0].message, /^\*\*1999 BMW 3 Series · Sedan\/Saloon\*\*/);
  });
});

test("a failed VIN decode doesn't block the notification, just falls back to Row52's own data", async () => {
  await withConfig([{ id: "e46", label: "E46 328i" }], async (config) => {
    const notified = [];
    const newCount = await runOnce(config, {
      search: async () => [listing],
      notify: async (ntfy, payload) => notified.push(payload),
      decode: async () => null, // decodeVin's real contract on failure — never throws
    });

    assert.equal(newCount, 1);
    assert.equal(notified.length, 1);
    assert.match(notified[0].message, /^\*\*1999 BMW 3 Series\*\*/); // no trailing " · ..." when decode is empty
  });
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
