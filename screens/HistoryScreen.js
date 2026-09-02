// ============================================================================
// screens/HistoryScreen.js — PAST SCANS  (PRD #11 view, #12 delete)
// ============================================================================
// PLAIN ENGLISH: Shows the saved scan list, newest first. Each row has the
// photo thumbnail, breed, confidence, and date. The ✕ deletes a row — after
// an "are you sure?" popup, because deletions can't be undone.
//
// FlatList (instead of ScrollView + map) is React Native's efficient list:
// it only draws the rows currently on screen, so even 100 scans stay smooth.
// ============================================================================

import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "./useFocusEffect";
import { getHistory, deleteScan } from "../lib/storage";
import { T } from "../components/shared";

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);

  // Re-read the list every time the user arrives on this tab — otherwise a
  // scan made moments ago wouldn't appear (the "stale data" problem).
  const load = useCallback(async () => setHistory(await getHistory()), []);
  useFocusEffect(load);

  // PRD #12 — confirm, then delete, then reload the list
  const confirmDelete = (item) => {
    Alert.alert("Delete scan?", `Remove the ${titleCase(item.breed)} scan from history?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive", // shows red on iOS
        onPress: async () => {
          await deleteScan(item.id);
          load();
        },
      },
    ]);
  };

  // Empty state: friendlier than a blank screen
  if (!history.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyGlyph}>🐕</Text>
        <Text style={styles.emptyTitle}>No scans yet</Text>
        <Text style={styles.emptyText}>
          Your identified dogs will appear here so you can review them over time.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={history}
      keyExtractor={(item) => item.id} // React needs a unique id per row
      renderItem={({ item }) => (
        <View style={styles.card}>
          {/* Thumbnail if the photo still exists, paw icon if not */}
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Text style={{ fontSize: 22 }}>🐾</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.breed}>{titleCase(item.breed)}</Text>
            <Text style={styles.meta}>
              {(item.confidence * 100).toFixed(1)}% ·{" "}
              {new Date(item.timestamp).toLocaleDateString()}{" "}
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 18, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    padding: 10,
  },
  thumb: { width: 54, height: 54, borderRadius: 10 },
  thumbFallback: {
    backgroundColor: T.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  breed: { fontSize: 15, fontWeight: "700", color: T.ink },
  meta: { fontSize: 12, color: T.ink, opacity: 0.6, marginTop: 2 },
  deleteBtn: { padding: 8 }, // padding makes the small ✕ easier to tap
  deleteText: { color: T.riskHigh, fontSize: 16, fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyGlyph: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  emptyText: { fontSize: 14, color: T.ink, opacity: 0.6, textAlign: "center", marginTop: 6 },
});
