// ============================================================================
// screens/admin/AdminUsers.js — USER MANAGEMENT  (URS #27)
// ============================================================================
// PLAIN ENGLISH: A searchable table of user accounts. The admin can search by
// name or email, see each account's tier and status, and suspend or reinstate
// an account. Runs on demo data (see lib/storage.js) since there is no backend
// user directory yet.
// ============================================================================

import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "../useFocusEffect";
import { getUsers, setUserStatus, addAuditEntry } from "../../lib/storage";
import { T } from "../../components/shared";

const STATUS_COLOR = { active: T.riskLow, suspended: T.riskHigh };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => setUsers(await getUsers()), []);
  useFocusEffect(load);

  const toggle = (u) => {
    const next = u.status === "active" ? "suspended" : "active";
    const verb = next === "suspended" ? "Suspend" : "Reinstate";
    Alert.alert(`${verb} account?`, `${u.name} (${u.email})`, [
      { text: "Cancel", style: "cancel" },
      {
        text: verb,
        style: next === "suspended" ? "destructive" : "default",
        onPress: async () => {
          const updated = await setUserStatus(u.id, next);
          await addAuditEntry(
            `${next === "suspended" ? "Suspended" : "Reinstated"} user ${u.email}`,
            next === "suspended" ? "warn" : "ok"
          );
          setUsers(updated);
        },
      },
    ]);
  };

  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : users;

  const counts = users.reduce(
    (a, u) => ((a[u.status] = (a[u.status] || 0) + 1), a),
    {}
  );

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {/* Summary */}
      <View style={styles.summary}>
        <Summary n={users.length} label="total" color={T.moss} />
        <Summary n={counts.active || 0} label="active" color={T.riskLow} />
        <Summary n={counts.suspended || 0} label="suspended" color={T.riskHigh} />
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {/* Table header */}
      <View style={styles.headerRow}>
        <Text style={[styles.hCell, { flex: 2.4 }]}>USER</Text>
        <Text style={[styles.hCell, { flex: 1 }]}>TIER</Text>
        <Text style={[styles.hCell, { flex: 1.1 }]}>STATUS</Text>
        <Text style={[styles.hCell, { width: 40 }]} />
      </View>

      {shown.map((u, i) => (
        <View key={u.id} style={[styles.row, i % 2 && styles.rowAlt]}>
          <View style={{ flex: 2.4 }}>
            <Text style={styles.name}>{u.name}</Text>
            <Text style={styles.email}>{u.email}</Text>
          </View>
          <Text style={[styles.cell, { flex: 1 }]}>{u.tier}</Text>
          <View style={{ flex: 1.1 }}>
            <View style={[styles.pill, { backgroundColor: STATUS_COLOR[u.status] }]}>
              <Text style={styles.pillText}>{u.status.toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity style={{ width: 40, alignItems: "center" }} onPress={() => toggle(u)}>
            <Text style={[styles.action, { color: u.status === "active" ? T.riskHigh : T.riskLow }]}>
              {u.status === "active" ? "⊘" : "↺"}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {shown.length === 0 && <Text style={styles.empty}>No accounts match "{query}".</Text>}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Every account action is written to the audit log with the
          administrator's identity and a timestamp.
        </Text>
      </View>
    </ScrollView>
  );
}

const Summary = ({ n, label, color }) => (
  <View style={styles.sumBox}>
    <Text style={[styles.sumNum, { color }]}>{n}</Text>
    <Text style={styles.sumLabel}>{label.toUpperCase()}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  summary: { flexDirection: "row", gap: 10 },
  sumBox: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  sumNum: { fontSize: 22, fontWeight: "800" },
  sumLabel: { fontSize: 10, color: T.ink, opacity: 0.6, letterSpacing: 1, marginTop: 2 },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 12,
  },
  searchGlyph: { fontSize: 18, color: T.moss, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: T.ink },
  headerRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.mossDark,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  hCell: { fontSize: 9.5, fontWeight: "800", color: T.paper, letterSpacing: 0.8 },
  row: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  rowAlt: { backgroundColor: "#FbFaF5" },
  name: { fontSize: 13, fontWeight: "700", color: T.ink },
  email: { fontSize: 11, color: T.ink, opacity: 0.6 },
  cell: { fontSize: 12.5, color: T.ink, textTransform: "capitalize" },
  pill: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start" },
  pillText: { color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.4 },
  action: { fontSize: 20, fontWeight: "800" },
  empty: { fontSize: 13, color: T.ink, opacity: 0.6, textAlign: "center", padding: 20 },
  note: { backgroundColor: T.amberSoft, borderRadius: 10, padding: 12, marginTop: 4 },
  noteText: { fontSize: 11.5, color: T.ink, opacity: 0.8, lineHeight: 16 },
});
