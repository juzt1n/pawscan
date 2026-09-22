// ============================================================================
// screens/admin/AdminAnalytics.js — ANALYTICS & AUDIT LOG  (URS #30)
// ============================================================================
// PLAIN ENGLISH: A dashboard of system statistics and an append-only audit log
// of administrator actions. Figures are demo values (see lib/storage.js); the
// real system aggregates these from the database. The audit log updates live
// as the admin acts elsewhere (e.g. suspending a user).
// ============================================================================

import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "../useFocusEffect";
import { getAnalytics, getAuditLog } from "../../lib/storage";
import { T } from "../../components/shared";

const KIND_COLOR = { ok: T.riskLow, warn: T.riskHigh, info: T.moss };

export default function AdminAnalytics() {
  const [stats, setStats] = useState(null);
  const [log, setLog] = useState([]);

  const load = useCallback(async () => {
    setStats(await getAnalytics());
    setLog(await getAuditLog());
  }, []);
  useFocusEffect(load);

  if (!stats) return null;

  const maxTrend = Math.max(...stats.scanTrend);

  const kpis = [
    ["Total users", stats.totalUsers.toLocaleString()],
    ["Active subs", stats.activeSubscriptions.toLocaleString()],
    ["Scans / month", stats.scansThisMonth.toLocaleString()],
    ["Success rate", stats.successRate],
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.section}>SYSTEM ANALYTICS · LAST 30 DAYS</Text>

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        {kpis.map(([label, val]) => (
          <View key={label} style={styles.kpi}>
            <Text style={styles.kpiVal}>{val}</Text>
            <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* Scan trend mini bar chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SCANS PER DAY</Text>
        <View style={styles.chart}>
          {stats.scanTrend.map((v, i) => (
            <View key={i} style={styles.barWrap}>
              <View style={[styles.bar, { height: `${(v / maxTrend) * 100}%` }]} />
            </View>
          ))}
        </View>
        <View style={styles.chartAxis}>
          <Text style={styles.axisLabel}>12 days ago</Text>
          <Text style={styles.axisLabel}>today</Text>
        </View>
      </View>

      {/* Attention row */}
      <View style={styles.attnRow}>
        <View style={[styles.attn, { borderColor: T.amber }]}>
          <Text style={[styles.attnNum, { color: T.riskMod }]}>{stats.pendingBusinesses}</Text>
          <Text style={styles.attnLabel}>businesses pending review</Text>
        </View>
        <View style={[styles.attn, { borderColor: T.riskHigh }]}>
          <Text style={[styles.attnNum, { color: T.riskHigh }]}>{stats.suspendedUsers}</Text>
          <Text style={styles.attnLabel}>users suspended</Text>
        </View>
      </View>

      {/* Audit log */}
      <Text style={styles.section}>AUDIT LOG</Text>
      {log.map((e, i) => (
        <View key={i} style={styles.logRow}>
          <View style={[styles.logStripe, { backgroundColor: KIND_COLOR[e.kind] || T.moss }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.logWhat}>{e.what}</Text>
            <Text style={styles.logMeta}>{e.time} · {e.who}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.footNote}>
        Audit entries are append-only and retained for 12 months.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  section: {
    fontSize: 11, letterSpacing: 1.5, fontWeight: "800",
    color: T.moss, marginBottom: 10, marginTop: 6,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  kpi: {
    width: "47%", flexGrow: 1, backgroundColor: "#fff", borderWidth: 1,
    borderColor: T.line, borderRadius: 12, padding: 14,
  },
  kpiVal: { fontSize: 22, fontWeight: "800", color: T.moss },
  kpiLabel: { fontSize: 9.5, fontWeight: "700", color: T.ink, opacity: 0.6, letterSpacing: 0.8, marginTop: 3 },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  cardTitle: { fontSize: 11, letterSpacing: 1.5, fontWeight: "800", color: T.moss, marginBottom: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 90, gap: 5 },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { backgroundColor: T.moss, borderRadius: 3, minHeight: 4 },
  chartAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisLabel: { fontSize: 9.5, color: T.ink, opacity: 0.5 },
  attnRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  attn: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderRadius: 12,
    padding: 12, alignItems: "center",
  },
  attnNum: { fontSize: 24, fontWeight: "800" },
  attnLabel: { fontSize: 11, color: T.ink, opacity: 0.7, textAlign: "center", marginTop: 2, lineHeight: 15 },
  logRow: {
    flexDirection: "row", backgroundColor: "#fff", borderWidth: 1,
    borderColor: T.line, borderRadius: 8, marginBottom: 7, overflow: "hidden",
  },
  logStripe: { width: 4 },
  logWhat: { fontSize: 12.5, fontWeight: "600", color: T.ink, paddingTop: 9, paddingHorizontal: 11 },
  logMeta: { fontSize: 10, color: T.ink, opacity: 0.6, paddingBottom: 9, paddingHorizontal: 11, paddingTop: 2 },
  footNote: { fontSize: 11, color: T.ink, opacity: 0.55, marginTop: 6, lineHeight: 15 },
});
