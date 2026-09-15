import { loadConfig } from "./config.js";
import { loadSeenStore, saveSeenStore, isSeen, markSeen } from "./seenStore.js";
import { searchRow52 } from "./row52.js";
import { sendNtfyNotification } from "./notify.js";

export async function runOnce(config, { search = searchRow52, notify = sendNtfyNotification } = {}) {
  const seen = await loadSeenStore(config.seenStorePath);
  let newCount = 0;

  for (const watch of config.watches) {
    let results;
    try {
      results = await search(watch);
    } catch (err) {
      console.error(`[${watch.id}] search failed: ${err.message}`);
      continue;
    }

    for (const listing of results) {
      if (isSeen(seen, watch.id, listing.vin)) continue;

      console.log(`[${watch.id}] new listing: ${listing.vin} @ ${listing.yard}`);
      try {
        await notify(config.ntfy, {
          title: `New junkyard hit: ${watch.label}`,
          message: `${listing.year ?? ""} ${listing.make} ${listing.model}\nYard: ${listing.yard}\nVIN: ${listing.vin}`.trim(),
          url: listing.url,
          tags: ["car", "mag"],
        });
      } catch (err) {
        console.error(`[${watch.id}] ntfy notification failed for ${listing.vin}: ${err.message}`);
        continue; // don't mark seen if we failed to notify — retry next poll
      }

      markSeen(seen, watch.id, listing.vin);
      newCount++;
    }
  }

  await saveSeenStore(config.seenStorePath, seen);
  return newCount;
}

async function main() {
  const runOnceFlag = process.argv.includes("--once");
  const config = await loadConfig(process.env.PARTPING_CONFIG);

  if (runOnceFlag) {
    const newCount = await runOnce(config);
    console.log(`Done. ${newCount} new listing(s).`);
    return;
  }

  console.log(`Polling every ${config.pollIntervalMinutes} minute(s). Ctrl+C to stop.`);
  const intervalMs = config.pollIntervalMinutes * 60_000;

  let stopped = false;
  const shutdown = () => {
    stopped = true;
    console.log("\nStopping.");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (!stopped) {
    try {
      const newCount = await runOnce(config);
      if (newCount > 0) console.log(`${newCount} new listing(s) — notified.`);
    } catch (err) {
      console.error("Poll run failed:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
