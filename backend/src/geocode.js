// ============================================================================
// src/geocode.js - turn a Singapore address into map coordinates
// ============================================================================
// Uses OneMap, the Singapore Land Authority's free map service (no API key).
// Clinics type their address when they register; we look it up here so the
// vet locator can sort clinics by real distance from the user.
// Tries the 6-digit postal code first (most reliable), then the address text.
// Returns a GeoJSON point { type: "Point", coordinates: [lng, lat] } or null.

const ONEMAP = "https://www.onemap.gov.sg/api/common/elastic/search";

async function search(text) {
  const url = `${ONEMAP}?searchVal=${encodeURIComponent(text)}&returnGeom=Y&getAddrDetails=N&pageNum=1`;
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) return null;
  const hit = (await r.json())?.results?.[0];
  const lat = parseFloat(hit?.LATITUDE);
  const lng = parseFloat(hit?.LONGITUDE);
  // Rough box around Singapore, to reject anything odd
  if (!(lat > 1.1 && lat < 1.5 && lng > 103.5 && lng < 104.2)) return null;
  return { type: "Point", coordinates: [lng, lat] };
}

export async function geocodeSG(address) {
  const text = String(address || "").trim();
  if (!text) return null;
  try {
    const postal = text.match(/(?:^|\D)(\d{6})(?!\d)/)?.[1];
    if (postal) {
      const p = await search(postal);
      if (p) return p;
    }
    // Without the postal code, e.g. "12 Bukit Timah Road"
    const street = text.replace(/,?\s*(singapore|s)?\s*\(?\d{6}\)?/gi, "").trim();
    return street ? await search(street) : null;
  } catch (e) {
    console.warn("Geocoding failed:", e.message);
    return null;
  }
}
