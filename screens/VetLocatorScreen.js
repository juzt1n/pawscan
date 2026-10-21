// ============================================================================
// screens/VetLocatorScreen.js — NEARBY VET CLINICS  (URS #22)
// ============================================================================
// Uses the phone's location (expo-location, see lib/location.js) to list the
// verified clinics nearest to the user, and keeps the list up to date as they
// move. Without location the clinics are still listed, just not by distance.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking, Platform, ActivityIndicator,
} from "react-native";
import { getNearbyClinics, logClinicEvent } from "../lib/storage";
import { getCurrentCoords, watchCoords, distanceKm, formatDistance } from "../lib/location";
import { T } from "../components/shared";

export default function VetLocatorScreen({ onBack }) {
  const [clinics, setClinics] = useState([]);
  const [loc, setLoc] = useState({ status: "finding", canAskAgain: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetch = useRef(null); // where we were when we last asked the server
  const viewed = useRef(false);

  const fetchClinics = useCallback(async (coords) => {
    try {
      const list = await getNearbyClinics(coords);
      lastFetch.current = coords;
      setClinics(list);
      setError(null);
      if (!viewed.current) {
        viewed.current = true;
        list.forEach((c) => logClinicEvent(c.id, "view")); // counted, never linked to the user
      }
    } catch (e) {
      setError(e?.message || "Couldn't load clinics.");
    }
  }, []);

  // Find the user, then load clinics (asking for permission if needed)
  const locate = useCallback(async (ask = true) => {
    setLoading(true);
    setLoc((l) => ({ ...l, status: "finding" }));
    const r = await getCurrentCoords({ ask });
    setLoc(r);
    await fetchClinics(r.coords);
    setLoading(false);
    return r;
  }, [fetchClinics]);

  // On open: locate, then keep tracking while this screen is open
  useEffect(() => {
    let stop = () => {};
    let alive = true;
    (async () => {
      const r = await locate(true);
      if (!alive || r.status !== "granted") return;
      stop = await watchCoords((coords) => {
        setLoc((l) => ({ ...l, coords }));
        // Re-sort only after a real move (300 m), to save data and battery
        if (!lastFetch.current || distanceKm(lastFetch.current, coords) > 0.3) fetchClinics(coords);
      });
      if (!alive) stop();
    })();
    return () => { alive = false; stop(); };
  }, [locate, fetchClinics]);

  const allowLocation = async () => {
    if (loc.status === "denied" && !loc.canAskAgain) {
      Linking.openSettings().catch(() => {}); // the user has to switch it on in Settings
    } else {
      locate(true);
    }
  };

  // Open the phone's map app with directions to the clinic
  const openDirections = (c) => {
    const q = encodeURIComponent(c.address);
    const label = encodeURIComponent(c.clinicName);
    const hasPin = c.lat != null && c.lng != null;
    const url = Platform.select({
      ios: hasPin ? `maps:?daddr=${c.lat},${c.lng}&q=${label}` : `maps:0,0?q=${q}`,
      android: hasPin ? `geo:${c.lat},${c.lng}?q=${c.lat},${c.lng}(${label})` : `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${hasPin ? `${c.lat},${c.lng}` : q}`,
    });
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`)
    );
  };

  const call = (phone) => Linking.openURL(`tel:${phone}`).catch(() => {});

  const banner = {
    finding: { text: "Finding your location…", action: null },
    granted: { text: "Sorted by distance from you. The list updates as you move.", action: null },
    denied: {
      text: "Location is off for PawScan, so clinics aren't sorted by distance.",
      action: loc.canAskAgain ? "Allow location" : "Open Settings",
    },
    off: { text: "Your phone's location services are switched off. Turn them on to sort by distance.", action: "Try again" },
    unavailable: { text: "We couldn't get your location just now.", action: "Try again" },
  }[loc.status] || { text: "", action: null };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {onBack && (
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Nearby vet clinics</Text>
      <Text style={styles.sub}>
        {clinics.length} verified {clinics.length === 1 ? "clinic" : "clinics"}
        {loc.status === "granted" ? " near you" : ""}
      </Text>

      <View style={[styles.locBox, loc.status === "granted" && styles.locBoxOk]}>
        {loc.status === "finding" && <ActivityIndicator size="small" color={T.moss} style={{ marginRight: 8 }} />}
        <Text style={styles.locText}>📍 {banner.text}</Text>
        {banner.action && (
          <TouchableOpacity onPress={allowLocation} style={styles.locBtn}>
            <Text style={styles.locBtnText}>{banner.action}</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <TouchableOpacity onPress={() => fetchClinics(loc.coords || null)} style={styles.errorBox}>
          <Text style={styles.errorText}>{error} Tap to try again.</Text>
        </TouchableOpacity>
      )}

      {loading && clinics.length === 0 && !error && (
        <ActivityIndicator color={T.moss} style={{ marginVertical: 24 }} />
      )}

      {clinics.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.name}>{c.clinicName}</Text>
            {c.verified && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>✓ VERIFIED</Text>
              </View>
            )}
          </View>

          <Text style={styles.meta}>
            {formatDistance(c.distanceKm) || (loc.status === "granted" ? "Distance unavailable" : "Verified clinic")}
            {c.hours ? `  ·  ${c.hours}` : ""}
          </Text>
          <Text style={styles.address}>{c.address}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { logClinicEvent(c.id, "directions"); openDirections(c); }}>
              <Text style={styles.primaryBtnText}>Directions</Text>
            </TouchableOpacity>
            {c.phone ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => { logClinicEvent(c.id, "call"); call(c.phone); }}>
                <Text style={styles.secondaryBtnText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Listings are verified against ACRA and the NParks AVS registers before
          they appear here. Distances are straight-line and approximate. Your
          location is only used to sort this list and is never saved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40 },
  back: { color: T.moss, fontWeight: "700", fontSize: 15, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: "800", color: T.ink },
  sub: { fontSize: 13, color: T.ink, opacity: 0.65, marginBottom: 16 },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: "800", color: T.ink, flex: 1 },
  badge: {
    backgroundColor: T.amberSoft, borderWidth: 1, borderColor: T.amber,
    borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeText: { fontSize: 8.5, fontWeight: "800", color: T.ink, letterSpacing: 0.5 },
  meta: { fontSize: 12.5, color: T.moss, fontWeight: "600", marginBottom: 2 },
  address: { fontSize: 13, color: T.ink, opacity: 0.75, marginBottom: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1, backgroundColor: T.moss, borderRadius: 10,
    paddingVertical: 11, alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryBtn: {
    flex: 1, borderWidth: 1.5, borderColor: T.moss, borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
  },
  secondaryBtnText: { color: T.moss, fontWeight: "700", fontSize: 14 },
  locBox: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8,
    backgroundColor: T.amberSoft, borderRadius: 10, padding: 12, marginBottom: 14,
  },
  locBoxOk: { backgroundColor: "#E6EFE6" },
  locText: { flex: 1, minWidth: 180, fontSize: 12.5, color: T.ink, lineHeight: 17 },
  locBtn: { backgroundColor: T.moss, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  locBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  errorBox: { backgroundColor: "#F7E3DD", borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { fontSize: 12.5, color: "#8A2E1C" },
  note: { backgroundColor: T.amberSoft, borderRadius: 10, padding: 12, marginTop: 4 },
  noteText: { fontSize: 11.5, color: T.ink, opacity: 0.8, lineHeight: 16 },
});