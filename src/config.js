import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONFIG_PATH = "config.json";

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  let raw;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Config file not found at "${configPath}". config.json is committed to the repo — make sure you're running from the repo root, or pass a different path via PARTPING_CONFIG.`,
      );
    }
    throw err;
  }

  const config = JSON.parse(raw);

  // ntfy.topic is the one real secret in here, so it's allowed to come from
  // an env var instead of the committed file — set NTFY_TOPIC locally or in
  // your host's dashboard (e.g. Railway) and it overrides whatever's on disk.
  if (process.env.NTFY_TOPIC) {
    config.ntfy ??= {};
    config.ntfy.topic = process.env.NTFY_TOPIC;
  }

  if (!config.ntfy?.topic || config.ntfy.topic.startsWith("REPLACE-WITH")) {
    throw new Error(
      "Missing ntfy topic: set it in config.json, or via the NTFY_TOPIC environment variable.",
    );
  }
  if (!Array.isArray(config.watches) || config.watches.length === 0) {
    throw new Error("config.json must define at least one entry in `watches`.");
  }

  config.ntfy.server ??= "https://ntfy.sh";
  config.pollIntervalMinutes ??= 15;
  // Per-make default for the "Check Options" button (e.g. { "BMW": "https://bimmer.work/" }).
  // A watch's own `optionsCheckUrl` overrides this when set.
  config.optionsCheckUrls ??= {};
  // SEEN_STORE_PATH lets a host with ephemeral local disk (Railway, etc.)
  // point this at a mounted persistent volume instead.
  config.seenStorePath = process.env.SEEN_STORE_PATH || config.seenStorePath || "data/seen.json";
  config.seenStorePath = path.resolve(config.seenStorePath);

  return config;
}
