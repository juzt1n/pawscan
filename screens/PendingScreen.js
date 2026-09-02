// ============================================================================
// screens/PendingScreen.js — "APPLICATION UNDER REVIEW"
// ============================================================================
// PLAIN ENGLISH: This is the state between applying (URS #02) and being
// approved (URS #29). The clinic can log in, but has NO listing powers yet.
// It also handles the rejected and suspended states, so every possible
// account status has a screen the user can actually land on.
//
// WHY THIS SCREEN MATTERS (worth saying in the report): without it, a
// business user who applies has nowhere to go after login. Defining every
// account state - and giving each one a screen - is what stops a half-
// verified account from silently getting real privileges.
// ============================================================================

import { useState, useCallback } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "./useFocusEffect";
import { getMyBusiness, logout } from "../lib/storage";
import { T } from "../components/shared";

export default function PendingScreen({ session, onSessionChange, onLogout }) {
  const [application, setApplication] = useState(null);

  // Re-read the application every time this screen appears, so an admin's
  // decision shows up without needing to reinstall the app.
  const load = useCallback(async () => {
    const app = await getMyBusiness(session.email);
    setApplication(app);
    if (app && app.status !== session.status) {
      onSessionChange({ ...session, status: app.status });
    }
  }, [session, onSessionChange]);

  useFocusEffect(load);

  const status = application?.status || session.status;

  const BANNERS = {
    pending: {
      glyph: "⏳",
      title: "Application under review",
      body: "Our team is checking your UEN against the ACRA register and your licence number against the NParks AVS register. You'll gain access to your clinic dashboard once approved.",
      color: T.amber,
      bg: T.amberSoft,
    },
    rejected: {
      glyph: "✕",
      title: "Application not approved",
      body: application?.reason
        ? `Reason given: ${application.reason}`
        : "Your submitted details could not be verified against the public registers.",
      color: T.riskHigh,
      bg: "#FBEFE2",
    },
    suspended: {
      glyph: "!",
      title: "Listing suspended",
      body: application?.reason
        ? `Reason given: ${application.reason}`
        : "This listing has been suspended and is no longer visible to users.",
      color: T.riskHigh,
      bg: "#FBEFE2",
    },
  };

  const b = BANNERS[status] || BANNERS.pending;

  const doLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {/* Status banner */}
      <View style={[styles.banner, { backgroundColor: b.bg, borderColor: b.color }]}>
        <Text style={styles.glyph}>{b.glyph}</Text>
        <Text style={[styles.bannerTitle, { color: b.color }]}>{b.title}</Text>
        <Text style={styles.bannerBody}>{b.body}</Text>
      </View>

      {/* What they submitted - so they can check it for typos */}
      {application && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SUBMITTED DETAILS</Text>
          <Row k="Clinic" v={application.clinicName} />
          <Row k="UEN" v={application.uen} />
          <Row k="AVS licence" v={application.avsLicence} />
          <Row k="Address" v={application.address} />
          <Row k="Contact" v={application.phone || "—"} />
          <Row
            k="Submitted"
            v={new Date(application.submittedAt).toLocaleString()}
          />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>WHAT HAPPENS NEXT</Text>
        <Step n="1" t="Format check" d="Your UEN was checked for valid format on submission." />
        <Step n="2" t="Registry verification" d="An administrator verifies the UEN with ACRA and the licence with NParks AVS." />
        <Step n="3" t="Decision" d="Approved listings appear in the vet locator; rejected applications receive a reason." />
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

const Step = ({ n, t, d }) => (
  <View style={styles.step}>
    <View style={styles.stepNum}>
      <Text style={styles.stepNumText}>{n}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.stepTitle}>{t}</Text>
      <Text style={styles.stepDesc}>{d}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40, gap: 14 },
  banner: { borderWidth: 1.5, borderRadius: 14, padding: 18, alignItems: "center" },
  glyph: { fontSize: 30, marginBottom: 6 },
  bannerTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  bannerBody: { fontSize: 13, color: T.ink, lineHeight: 19, textAlign: "center" },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16,
  },
  sectionTitle: {
    fontSize: 11, letterSpacing: 2, fontWeight: "700",
    color: T.moss, marginBottom: 10,
  },
  row: { flexDirection: "row", paddingVertical: 5, gap: 10 },
  rowKey: { fontSize: 12.5, color: T.ink, opacity: 0.55, width: 96 },
  rowVal: { fontSize: 13.5, color: T.ink, flex: 1, fontWeight: "600" },
  step: { flexDirection: "row", gap: 10, marginBottom: 12 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: T.moss,
    alignItems: "center", justifyContent: "center",
  },
  stepNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  stepTitle: { fontSize: 13.5, fontWeight: "700", color: T.ink },
  stepDesc: { fontSize: 12.5, color: T.ink, opacity: 0.7, lineHeight: 17, marginTop: 1 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: T.riskHigh, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  logoutText: { color: T.riskHigh, fontWeight: "700", fontSize: 15 },
});
