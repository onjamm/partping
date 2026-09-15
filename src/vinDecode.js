// Body style (sedan/coupe/etc.) isn't in Row52's data at all, and BMW's
// VIN encoding for it is proprietary — not something to guess at. NHTSA
// runs a free, public VIN-decode API that actually has this, built for
// exactly this purpose: https://vpic.nhtsa.dot.gov (no key, no auth).
//
// This is enrichment, not core data — it's only called for listings we're
// already about to notify on (low volume), and deliberately never throws.
// A failure here should never block sending the actual notification.

const BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

export async function decodeVin(vin) {
  try {
    const res = await fetch(`${BASE_URL}/${vin}?format=json`);
    if (!res.ok) return null;

    const result = (await res.json())?.Results?.[0];
    if (!result) return null;

    return {
      bodyClass: result.BodyClass || undefined,
      model: result.Model || undefined,
    };
  } catch {
    return null;
  }
}
