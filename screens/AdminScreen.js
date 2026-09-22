// ============================================================================
// screens/AdminScreen.js — ADMIN SHELL  (URS #27 / #29 / #30)
// ============================================================================
// PLAIN ENGLISH: The admin area has three sections. This shell shows a section
// switcher at the top and renders one of the three sub-screens below it:
//
//   Businesses → review clinic applications (approve / reject / suspend)  #29
//   Users      → manage user accounts (search, suspend, reinstate)        #27
//   Analytics  → system statistics and the audit log                      #30
//
// Logout lives here in the shell, so it is available from every section.
// ============================================================================

import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { logout } from "../lib/storage";
import { T } from "../components/shared";
import AdminBusinessReview from "./admin/AdminBusinessReview";
import AdminUsers from "./admin/AdminUsers";
import AdminAnalytics from "./admin/AdminAnalytics";

const SECTIONS = [
  ["businesses", "Businesses"],
  ["users", "Users"],
  ["analytics", "Analytics"],
];

export default function AdminScreen({ onLogout }) {
  const [section, setSection] = useState("businesses");

  const doLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.paper }}>
      {/* Section switcher */}
      <View style={styles.switcher}>
        {SECTIONS.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, section === key && styles.tabOn]}
            onPress={() => setSection(key)}
          >
            <Text style={[styles.tabText, section === key && styles.tabTextOn]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.logout} onPress={doLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Active section */}
      <View style={{ flex: 1 }}>
        {section === "businesses" && <AdminBusinessReview />}
        {section === "users" && <AdminUsers />}
        {section === "analytics" && <AdminAnalytics />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: T.line,
  },
  tab: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1.5, borderColor: T.moss,
  },
  tabOn: { backgroundColor: T.moss },
  tabText: { fontSize: 12, fontWeight: "800", color: T.moss, letterSpacing: 0.5 },
  tabTextOn: { color: "#fff" },
  logout: { marginLeft: "auto", paddingVertical: 7, paddingHorizontal: 10 },
  logoutText: { color: T.riskHigh, fontWeight: "700", fontSize: 13 },
});
