import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";

async function withConfigFile(contents, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "partping-test-"));
  const file = path.join(dir, "config.json");
  try {
    if (contents !== null) {
      await writeFile(file, JSON.stringify(contents), "utf8");
    }
    await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const validConfig = {
  ntfy: { topic: "my-real-topic" },
  watches: [{ id: "e46", make: "BMW" }],
};

test("throws a clear error when the config file is missing", async () => {
  await withConfigFile(null, async (file) => {
    await assert.rejects(() => loadConfig(file), /Config file not found/);
  });
});

test("throws when ntfy.topic is missing", async () => {
  await withConfigFile({ watches: validConfig.watches }, async (file) => {
    await assert.rejects(() => loadConfig(file), /Missing ntfy topic/);
  });
});

test("throws when ntfy.topic is still the placeholder", async () => {
  await withConfigFile(
    { ntfy: { topic: "REPLACE-WITH-A-PRIVATE-NTFY-TOPIC" }, watches: validConfig.watches },
    async (file) => {
      await assert.rejects(() => loadConfig(file), /Missing ntfy topic/);
    },
  );
});

test("throws when watches is missing or empty", async () => {
  await withConfigFile({ ntfy: validConfig.ntfy, watches: [] }, async (file) => {
    await assert.rejects(() => loadConfig(file), /watches/);
  });
});

test("applies defaults for server, pollIntervalMinutes, seenStorePath", async () => {
  await withConfigFile(validConfig, async (file) => {
    const config = await loadConfig(file);
    assert.equal(config.ntfy.server, "https://ntfy.sh");
    assert.equal(config.pollIntervalMinutes, 15);
    assert.ok(path.isAbsolute(config.seenStorePath));
  });
});

test("preserves explicit values instead of overwriting with defaults", async () => {
  await withConfigFile(
    { ...validConfig, ntfy: { ...validConfig.ntfy, server: "https://ntfy.example.com" }, pollIntervalMinutes: 5 },
    async (file) => {
      const config = await loadConfig(file);
      assert.equal(config.ntfy.server, "https://ntfy.example.com");
      assert.equal(config.pollIntervalMinutes, 5);
    },
  );
});

test("NTFY_TOPIC env var overrides config.json's topic, even a placeholder one", async () => {
  await withConfigFile(
    { ntfy: { topic: "REPLACE-WITH-A-PRIVATE-NTFY-TOPIC" }, watches: validConfig.watches },
    async (file) => {
      process.env.NTFY_TOPIC = "env-supplied-topic";
      try {
        const config = await loadConfig(file);
        assert.equal(config.ntfy.topic, "env-supplied-topic");
      } finally {
        delete process.env.NTFY_TOPIC;
      }
    },
  );
});

test("SEEN_STORE_PATH env var overrides config.json's seenStorePath", async () => {
  await withConfigFile(validConfig, async (file) => {
    process.env.SEEN_STORE_PATH = "/tmp/partping-custom-seen.json";
    try {
      const config = await loadConfig(file);
      assert.equal(config.seenStorePath, path.resolve("/tmp/partping-custom-seen.json"));
    } finally {
      delete process.env.SEEN_STORE_PATH;
    }
  });
});
