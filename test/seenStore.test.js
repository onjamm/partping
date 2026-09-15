import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSeenStore, saveSeenStore, isSeen, markSeen } from "../src/seenStore.js";

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "partping-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("isSeen is false for an empty store", () => {
  assert.equal(isSeen({}, "watch-a", "VIN123"), false);
});

test("markSeen then isSeen returns true for that watch+vin", () => {
  const store = {};
  markSeen(store, "watch-a", "VIN123");
  assert.equal(isSeen(store, "watch-a", "VIN123"), true);
});

test("markSeen namespaces by watch id — other watches unaffected", () => {
  const store = {};
  markSeen(store, "watch-a", "VIN123");
  assert.equal(isSeen(store, "watch-b", "VIN123"), false);
});

test("loadSeenStore returns {} when the file doesn't exist yet", async () => {
  await withTempDir(async (dir) => {
    const store = await loadSeenStore(path.join(dir, "nope.json"));
    assert.deepEqual(store, {});
  });
});

test("saveSeenStore then loadSeenStore round-trips", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "seen.json");
    const store = {};
    markSeen(store, "watch-a", "VIN123");

    await saveSeenStore(file, store);
    const reloaded = await loadSeenStore(file);

    assert.equal(isSeen(reloaded, "watch-a", "VIN123"), true);
  });
});

test("saveSeenStore creates missing parent directories", async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, "nested", "deeper", "seen.json");
    await saveSeenStore(file, { "watch-a": { VIN123: "2026-01-01T00:00:00.000Z" } });

    const raw = await readFile(file, "utf8");
    assert.match(raw, /VIN123/);
  });
});
