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
        `Config file not found at "${configPath}". Copy config.example.json to config.json and fill in your ntfy topic + watches.`,
      );
    }
    throw err;
  }

  const config = JSON.parse(raw);

  if (!config.ntfy?.topic || config.ntfy.topic.startsWith("REPLACE-WITH")) {
    throw new Error("config.json is missing a real ntfy.topic.");
  }
  if (!Array.isArray(config.watches) || config.watches.length === 0) {
    throw new Error("config.json must define at least one entry in `watches`.");
  }

  config.ntfy.server ??= "https://ntfy.sh";
  config.pollIntervalMinutes ??= 15;
  config.seenStorePath ??= "data/seen.json";
  config.seenStorePath = path.resolve(config.seenStorePath);

  return config;
}
