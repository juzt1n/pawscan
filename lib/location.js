// ============================================================================
// lib/location.js - where is the user? (for the vet locator, URS #22)
// ============================================================================
// PLAIN ENGLISH: asks the phone for its position so we can sort vet clinics by
// distance. Location is only used while the vet locator is open, is never
// saved, and is only sent to our server to find the nearest clinics.
import * as Location from "expo-location";

// status: "granted" | "denied" | "off" (location services switched off) | "unavailable"
export async function getCurrentCoords({ ask = true } = {}) {
  try {
    const perm = ask
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      return { coords: null, status: "denied", canAskAgain: perm.canAskAgain !== false };
    }
    if (!(await Location.hasServicesEnabledAsync())) {
      return { coords: null, status: "off", canAskAgain: true };
    }

    // A recent fix is instant; otherwise ask the GPS (can take a few seconds indoors)
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (last) return { coords: pick(last), status: "granted" };

    const now = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    return now
      ? { coords: pick(now), status: "granted" }
      : { coords: null, status: "unavailable", canAskAgain: true };
  } catch {
    return { coords: null, status: "unavailable", canAskAgain: true };
  }
}

// Follow the user as they move; calls onMove when they have moved about 200 m.
// Returns a function that stops tracking.
export async function watchCoords(onMove) {
  try {
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 200, timeInterval: 15000 },
      (pos) => onMove(pick(pos))
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

// Straight-line distance between two points, in km (haversine formula)
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// "850 m away" or "2.4 km away"
export function formatDistance(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away` : `${km.toFixed(1)} km away`;
}

const pick = (pos) => ({ lat: pos.coords.latitude, lng: pos.coords.longitude });
