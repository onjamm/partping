import { loadConfig } from "./config.js";
import { loadSeenStore, saveSeenStore, isSeen, markSeen } from "./seenStore.js";
import { searchRow52 } from "./row52.js";
import { sendNtfyNotification } from "./notify.js";
import { decodeVin } from "./vinDecode.js";

// "Sep 03, 2026" -> "Sep 03, 2026 (2 days ago)". Falls back to the raw
// string if it doesn't parse, or if it's not actually in the past.
export function formatDateAdded(dateAdded, now = new Date()) {
  if (!dateAdded) return dateAdded;

  const then = new Date(dateAdded);
  if (Number.isNaN(then.getTime())) return dateAdded;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffDays = Math.round((startOfToday - startOfThen) / 86_400_000);

  let relative;
  if (diffDays === 0) relative = "today";
  else if (diffDays === 1) relative = "yesterday";
  else if (diffDays > 1) relative = `${diffDays} days ago`;
  else return dateAdded; // future/unexpected — don't annotate

  return `${dateAdded} (${relative})`;
}

export async function runOnce(config, { search = searchRow52, notify = sendNtfyNotification, decode = decodeVin } = {}) {
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
        const decoded = await decode(listing.vin);

        // Ordered by what you'd actually do with it: where to go first (bold —
        // the one thing you need at a glance), then what car it is (to confirm
        // it's the right one), then low-priority reference info last.
        const rowYardLine = listing.row ? `**Row ${listing.row}** — ${listing.yardName}` : listing.yardName;

        const carLine = [`${listing.year ?? ""} ${listing.make} ${listing.model}`.trim(), decoded?.bodyClass, decoded?.model]
          .filter(Boolean)
          .join(" · ");

        const metaLine = [listing.dateAdded ? `Added ${formatDateAdded(listing.dateAdded)}` : null, `VIN \`${listing.vin}\``]
          .filter(Boolean)
          .join(" · ");

        const messageLines = [rowYardLine, listing.yardAddress, "", carLine, "", metaLine].filter(
          (line) => line !== null && line !== undefined,
        );

        const optionsCheckUrl = watch.optionsCheckUrl || config.optionsCheckUrls?.[watch.make];

        const actions = [];
        if (listing.mapsUrl) actions.push({ label: "Get Directions", url: listing.mapsUrl });
        if (optionsCheckUrl) actions.push({ label: "Check Options", url: optionsCheckUrl });

        await notify(config.ntfy, {
          title: `New junkyard hit: ${watch.label}`,
          message: messageLines.join("\n"),
          url: listing.url,
          actions,
          imageUrl: listing.imageUrl,
          priority: "high",
          markdown: true,
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
