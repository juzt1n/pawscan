// ============================================================================
// screens/AdminScreen.js — BUSINESS APPLICATION REVIEW  (URS #29)
// ============================================================================
// PLAIN ENGLISH: The administrator's queue. Each pending application shows the
// two identifiers that must be verified against Singapore's public registers:
//
//   UEN         -> check on ACRA's BizFile register
//   AVS licence -> check on the NParks AVS list of licensed vet centres
//
// The admin approves (listing goes live) or rejects (with a reason the clinic
// will see). Verified listings can also be suspended later - licences lapse
// and clinics close, so "verified" must be revocable.
//
// DEMO LIMITATION for the report: this is a MANUAL check. The admin opens the
// registers themselves; the app does not call ACRA/AVS APIs. That is a
// deliberate scope decision, not an oversight.
// ============================================================================

import { useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useFocusEffect } from "./useFocusEffect";
import {
  getBusinesses,
  reviewBusinessApplication,
  suspendBusiness,
  logout,
} from "../lib/storage";
import { T } from "../components/shared";

const STATUS_COLOR = {
  pending: T.amber,
  approved: T.riskLow,
  rejected: T.riskHigh,
  suspended: T.riskHigh,
};

export default function AdminScreen({ onLogout }) {
  const [apps, setApps] = useState([]);
  const [filter, setFilter] = useState("pending");

  const load = useCallback(async () => setApps(await getBusinesses()), []);
  useFocusEffect(load);

  const approve = (app) => {
    Alert.alert(
      "Approve listing?",
      `Confirm that UEN ${app.uen} was found on ACRA and licence ${app.avsLicence} was found on the AVS register.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            await reviewBusinessApplication(app.id, "approved");
            load();
          },
        },
      ]
    );
  };

  const reject = (app) => {
    // Rejection always carries a reason - the clinic sees it on their screen
    Alert.alert("Reject application", "Select a reason:", [
      { text: "Cancel", style: "cancel" },
      {
        text: "UEN not found",
        onPress: async () => {
          await reviewBusinessApplication(app.id, "rejected",
            "UEN could not be found on the ACRA register.");
          load();
        },
      },
      {
        text: "Licence invalid",
        onPress: async () => {
          await reviewBusinessApplication(app.id, "rejected",
            "AVS veterinary centre licence could not be verified.");
          load();
        },
      },
    ]);
  };

  const suspend = (app) => {
    Alert.alert("Suspend listing?", "The clinic will be hidden from the vet locator.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: async () => {
          await suspendBusiness(app.id, "Licence lapsed or clinic no longer operating.");
          load();
        },
      },
    ]);
  };

  const counts = apps.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const shown = apps.filter((a) => (filter === "all" ? true : a.status === filter));

  const doLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {/* Summary counters */}
      <View style={styles.summary}>
        {["pending", "approved", "rejected"].map((s) => (
          <View key={s} style={styles.summaryBox}>
            <Text style={[styles.summaryNum, { color: STATUS_COLOR[s] }]}>
              {counts[s] || 0}
            </Text>
            <Text style={styles.summaryLabel}>{s}</Text>
          </View>
        ))}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {["pending", "approved", "all"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {shown.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>📋</Text>
          <Text style={styles.emptyText}>No {filter} applications.</Text>
        </View>
      )}

      {shown.map((app) => (
        <View key={app.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.clinic}>{app.clinicName}</Text>
            <View style={[styles.pill, { backgroundColor: STATUS_COLOR[app.status] }]}>
              <Text style={styles.pillText}>{app.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* The two identifiers the admin must verify */}
          <View style={styles.verifyBox}>
            <Text style={styles.verifyHead}>VERIFY AGAINST PUBLIC REGISTERS</Text>
            <View style={styles.verifyRow}>
              <Text style={styles.verifyKey}>UEN</Text>
              <Text style={styles.verifyVal}>{app.uen}</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://www.bizfile.gov.sg")}
              >
                <Text style={styles.checkLink}>ACRA ↗</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.verifyRow}>
              <Text style={styles.verifyKey}>AVS</Text>
              <Text style={styles.verifyVal}>{app.avsLicence}</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://www.nparks.gov.sg/avs")}
              >
                <Text style={styles.checkLink}>AVS ↗</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Row k="Email" v={app.email} />
          <Row k="Address" v={app.address} />
          <Row k="Contact" v={app.phone || "—"} />
          <Row k="Submitted" v={new Date(app.submittedAt).toLocaleString()} />
          {app.reason && <Row k="Reason" v={app.reason} />}

          {/* Actions depend on the current status */}
          {app.status === "pending" && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => approve(app)}>
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(app)}>
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
          {app.status === "approved" && (
            <TouchableOpacity style={styles.suspendBtn} onPress={() => suspend(app)}>
              <Text style={styles.rejectText}>Suspend listing</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

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
  wrap: { padding: 18, paddingBottom: 40, gap: 12 },
  summary: { flexDirection: "row", gap: 10 },
  summaryBox: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  summaryNum: { fontSize: 24, fontWeight: "800" },
  summaryLabel: {
    fontSize: 10.5, color: T.ink, opacity: 0.6,
    textTransform: "uppercase", letterSpacing: 1, marginTop: 2,
  },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: {
    flex: 1, borderWidth: 1.5, borderColor: T.moss, borderRadius: 8,
    paddingVertical: 8, alignItems: "center",
  },
  filterBtnOn: { backgroundColor: T.moss },
  filterText: { fontSize: 11, fontWeight: "800", color: T.moss, letterSpacing: 1 },
  filterTextOn: { color: "#fff" },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16,
  },
  cardHead: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  clinic: { fontSize: 16, fontWeight: "800", color: T.ink, flex: 1 },
  pill: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: "#fff", fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  verifyBox: {
    backgroundColor: T.amberSoft, borderRadius: 10, padding: 10, marginBottom: 10,
  },
  verifyHead: {
    fontSize: 9.5, fontWeight: "800", letterSpacing: 1,
    color: T.ink, opacity: 0.7, marginBottom: 6,
  },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  verifyKey: { fontSize: 11, fontWeight: "800", color: T.ink, width: 34 },
  verifyVal: {
    flex: 1, fontSize: 13.5, fontWeight: "700",
    color: T.ink, letterSpacing: 0.5,
  },
  checkLink: { fontSize: 12, fontWeight: "700", color: T.moss },
  row: { flexDirection: "row", paddingVertical: 3, gap: 10 },
  rowKey: { fontSize: 12, color: T.ink, opacity: 0.55, width: 76 },
  rowVal: { fontSize: 12.5, color: T.ink, flex: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  approveBtn: {
    flex: 1, backgroundColor: T.riskLow, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  approveText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  rejectBtn: {
    flex: 1, borderWidth: 1.5, borderColor: T.riskHigh,
    borderRadius: 10, paddingVertical: 11, alignItems: "center",
  },
  suspendBtn: {
    borderWidth: 1.5, borderColor: T.riskHigh, borderRadius: 10,
    paddingVertical: 11, alignItems: "center", marginTop: 12,
  },
  rejectText: { color: T.riskHigh, fontWeight: "800", fontSize: 14 },
  empty: { alignItems: "center", padding: 30 },
  emptyGlyph: { fontSize: 32, marginBottom: 6 },
  emptyText: { fontSize: 14, color: T.ink, opacity: 0.6 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: T.riskHigh, borderRadius: 10,
    paddingVertical: 12, alignItems: "center", marginTop: 4,
  },
  logoutText: { color: T.riskHigh, fontWeight: "700", fontSize: 15 },
});
