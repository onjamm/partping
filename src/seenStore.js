import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Flat JSON file: { [watchId]: { [vin]: isoTimestampFirstSeen } }

export async function loadSeenStore(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

export async function saveSeenStore(filePath, store) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export function isSeen(store, watchId, vin) {
  return Boolean(store[watchId]?.[vin]);
}

export function markSeen(store, watchId, vin) {
  store[watchId] ??= {};
  store[watchId][vin] = new Date().toISOString();
}
