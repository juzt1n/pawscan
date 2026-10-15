// ============================================================================
// screens/VetLocatorScreen.js — NEARBY VET CLINICS  (URS #22)
// ============================================================================
// ============================================================================

import { useState, useCallback } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking, Platform,
} from "react-native";
import { useFocusEffect } from "./useFocusEffect";
import { getNearbyClinics } from "../lib/storage";
import { T } from "../components/shared";

export default function VetLocatorScreen({ onBack }) {
  const [clinics, setClinics] = useState([]);

  const load = useCallback(async () => setClinics(await getNearbyClinics()), []);
  useFocusEffect(load);

  // Open the phone's native map app with the clinic address as the destination
  const openDirections = (address) => {
    const q = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://maps.google.com/?q=${q}`,
    });
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${q}`)
    );
  };

  const call = (phone) => Linking.openURL(`tel:${phone}`).catch(() => {});

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {onBack && (
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Nearby vet clinics</Text>
      <Text style={styles.sub}>
        {clinics.length} verified {clinics.length === 1 ? "clinic" : "clinics"} near you
      </Text>

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
            {c.distanceKm != null ? `${c.distanceKm} km away` : "Nearby"}
            {c.hours ? `  ·  ${c.hours}` : ""}
          </Text>
          <Text style={styles.address}>{c.address}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => openDirections(c.address)}>
              <Text style={styles.primaryBtnText}>Directions</Text>
            </TouchableOpacity>
            {c.phone ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => call(c.phone)}>
                <Text style={styles.secondaryBtnText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Listings are verified against ACRA and the NParks AVS registers before
          they appear here. Distances are approximate.
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
  note: { backgroundColor: T.amberSoft, borderRadius: 10, padding: 12, marginTop: 4 },
  noteText: { fontSize: 11.5, color: T.ink, opacity: 0.8, lineHeight: 16 },
});