// ============================================================================
// screens/BusinessDashboard.js — APPROVED CLINIC  (URS #24, #25)
// ============================================================================
// PLAIN ENGLISH: What a vet clinic sees once an admin has approved them.
//   US-24  manage the clinic listing (name, address, phone, hours, services)
//   US-25  view anonymised referral statistics
//
// The "Verified" badge is the visible payoff of the whole approval workflow:
// it only appears because an administrator checked the UEN and licence.
// ============================================================================

import { useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "./useFocusEffect";
import { getMyBusiness, updateBusinessListing, logout } from "../lib/storage";
import { T } from "../components/shared";

// Demo statistics. In the real system these come from the backend, aggregated
// and anonymised so a clinic can never identify individual users.
const DEMO_STATS = [
  { label: "Listing views", value: "248", period: "last 30 days" },
  { label: "Direction requests", value: "37", period: "last 30 days" },
  { label: "Profile taps", value: "64", period: "last 30 days" },
];

export default function BusinessDashboard({ session, onLogout }) {
  const [biz, setBiz] = useState(null);
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [services, setServices] = useState("");

  const load = useCallback(async () => {
    const b = await getMyBusiness(session.email);
    setBiz(b);
    if (b) {
      setAddress(b.address || "");
      setPhone(b.phone || "");
      setHours(b.hours || "");
      setServices(b.services || "");
    }
  }, [session.email]);

  useFocusEffect(load);

  const save = async () => {
    const updated = await updateBusinessListing(biz.id, {
      address, phone, hours, services,
    });
    setBiz(updated);
    setEditing(false);
    Alert.alert("Listing updated", "Your clinic details have been saved.");
  };

  const doLogout = async () => {
    await logout();
    onLogout();
  };

  if (!biz) return null;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {/* Verified header - the payoff of the approval workflow */}
      <View style={styles.headerCard}>
        <Text style={styles.clinicName}>{biz.clinicName}</Text>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✓ VERIFIED CLINIC</Text>
        </View>
        <Text style={styles.verifiedNote}>
          Verified on {new Date(biz.reviewedAt || Date.now()).toLocaleDateString()} ·
          UEN {biz.uen} · AVS {biz.avsLicence}
        </Text>
      </View>

      {/* US-24 Manage listing */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.sectionTitle}>CLINIC LISTING</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Text style={styles.editLink}>{editing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        </View>

        {!editing ? (
          <>
            <Row k="Address" v={biz.address} />
            <Row k="Contact" v={biz.phone || "—"} />
            <Row k="Opening hours" v={biz.hours || "Not set"} />
            <Row k="Services" v={biz.services || "Not set"} />
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <TextInput style={styles.input} value={address} onChangeText={setAddress}
              placeholder="Clinic address" placeholderTextColor="#999" />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="Contact number" placeholderTextColor="#999"
              keyboardType="phone-pad" />
            <TextInput style={styles.input} value={hours} onChangeText={setHours}
              placeholder="Opening hours (e.g. Mon-Sat 9am-7pm)" placeholderTextColor="#999" />
            <TextInput style={[styles.input, { height: 74, textAlignVertical: "top" }]}
              value={services} onChangeText={setServices} multiline
              placeholder="Services offered (e.g. consultations, surgery, dental)"
              placeholderTextColor="#999" />
            <TouchableOpacity style={styles.primaryBtn} onPress={save}>
              <Text style={styles.primaryBtnText}>Save changes</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* US-25 Referral statistics */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>REFERRAL STATISTICS</Text>
        <View style={styles.statRow}>
          {DEMO_STATS.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statPeriod}>{s.period}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.privacyNote}>
          Statistics are aggregated and anonymised. Individual users cannot be
          identified from this data (PDPA).
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={doLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const Row = ({ k, v }) => (
  <View style={styles.row}>
    <Text style={styles.rowKey}>{k}</Text>
    <Text style={styles.rowVal}>{v}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40, gap: 14 },
  headerCard: {
    backgroundColor: T.mossDark, borderRadius: 14, padding: 18, alignItems: "center",
  },
  clinicName: { color: T.paper, fontSize: 20, fontWeight: "800", textAlign: "center" },
  verifiedBadge: {
    backgroundColor: T.amber, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  verifiedText: { color: T.mossDark, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  verifiedNote: {
    color: T.paper, opacity: 0.75, fontSize: 11,
    marginTop: 8, textAlign: "center", lineHeight: 16,
  },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: {
    fontSize: 11, letterSpacing: 2, fontWeight: "700",
    color: T.moss, marginBottom: 10,
  },
  editLink: { color: T.moss, fontWeight: "700", fontSize: 13, marginBottom: 10 },
  row: { flexDirection: "row", paddingVertical: 5, gap: 10 },
  rowKey: { fontSize: 12.5, color: T.ink, opacity: 0.55, width: 100 },
  rowVal: { fontSize: 13.5, color: T.ink, flex: 1, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
    backgroundColor: T.paper, color: T.ink,
  },
  primaryBtn: {
    backgroundColor: T.moss, borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1, backgroundColor: T.paper, borderRadius: 10,
    padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800", color: T.moss },
  statLabel: { fontSize: 11, color: T.ink, textAlign: "center", marginTop: 2 },
  statPeriod: { fontSize: 9.5, color: T.ink, opacity: 0.5, marginTop: 2 },
  privacyNote: {
    fontSize: 11.5, color: T.ink, opacity: 0.6, lineHeight: 16, marginTop: 10,
  },
  logoutBtn: {
    borderWidth: 1.5, borderColor: T.riskHigh, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  logoutText: { color: T.riskHigh, fontWeight: "700", fontSize: 15 },
});
