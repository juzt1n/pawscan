// ============================================================================
// App.js — THE FRONT DOOR OF THE APP
// ============================================================================
// PLAIN ENGLISH: This file decides what you see, in this order:
//   1. A brief spinner while we check the phone's storage: "was someone
//      already logged in?"
//   2. If nobody is logged in → the login/register screen.
//   3. If someone is logged in → the main app: a header, the current tab's
//      screen, and the tab bar at the bottom (Scan / History / Breeds /
//      Profile).
//
// "Which tab is open" is just a piece of state (a variable React watches).
// Tapping a tab changes that variable, and React re-draws the screen area.
//
// SAFE AREA NOTE: modern Androids let apps draw UNDER the clock/status bar
// and UNDER the system buttons at the bottom. Without protection, our header
// collides with the clock and our tab bar becomes untappable (we hit this
// bug for real!). The SafeAreaProvider/SafeAreaView pair from
// react-native-safe-area-context measures those zones and pads around them.
// ============================================================================

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
// SafeAreaView comes from this library, NOT from "react-native" — the
// built-in one ignores Android. Same name, smarter implementation.
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import AuthScreen from "./screens/AuthScreen";
import ScanScreen from "./screens/ScanScreen";
import HistoryScreen from "./screens/HistoryScreen";
import UpgradeScreen from "./screens/UpgradeScreen";
import BreedsScreen from "./screens/BreedsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import PendingScreen from "./screens/PendingScreen";
import BusinessDashboard from "./screens/BusinessDashboard";
import AdminScreen from "./screens/AdminScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import {
  getSession,
  refreshSessionStatus,
  hasSeenOnboarding,
  markOnboardingSeen,
} from "./lib/storage";
import { T } from "./components/shared";

// The four tabs. Adding a 5th tab = add a line here + a screen below.
const TABS = [
  { key: "scan", label: "Scan", glyph: "🐾" },
  { key: "history", label: "History", glyph: "🕘" },
  { key: "breeds", label: "Breeds", glyph: "📖" },
  { key: "profile", label: "Profile", glyph: "👤" },
];

export default function App() {
  // Three pieces of state this screen watches:
  const [session, setSession] = useState(null); // who's logged in (null = nobody)
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [booting, setBooting] = useState(true); // still checking storage?
  const [tab, setTab] = useState("scan");       // which tab is open
  const [showOnboarding, setShowOnboarding] = useState(false); // first launch?
  const [showForgot, setShowForgot] = useState(false);         // reset-password screen open?

  // Runs once when the app starts: ask storage if someone was logged in
  useEffect(() => {
    // Read the saved session, then (for business accounts) re-check whether an
    // admin has changed their status since last login.
    (async () => {
      // First-launch tutorial: show it only if it hasn't been seen before
      const seen = await hasSeenOnboarding();
      if (!seen) setShowOnboarding(true);

      let saved = await getSession();
      if (saved?.accountType === "business") saved = await refreshSessionStatus();
      setSession(saved);   // null if nobody
      setBooting(false);   // done checking → stop showing the spinner
    })();
  }, []);

  const finishOnboarding = async () => {
    await markOnboardingSeen();
    setShowOnboarding(false);
  };


if (showUpgrade) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <UpgradeScreen
          onBack={() => setShowUpgrade(false)}
          onSessionChange={(s) => { setSession(s); setShowUpgrade(false); }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
  // ------- 1. Still checking storage → spinner -------
  if (booting) {
    return (
      <SafeAreaProvider>
        <View style={styles.boot}>
          <ActivityIndicator color={T.amber} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  // ------- 1b. First launch → welcome tutorial (before anything else) -------
  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OnboardingScreen onDone={finishOnboarding} />
      </SafeAreaProvider>
    );
  }

  // ------- 2. Nobody logged in → login/register screen -------
  if (!session) {
    // Forgot-password is a sub-screen of the logged-out state
    if (showForgot) {
      return (
        <SafeAreaProvider>
          <StatusBar style="light" />
          <ForgotPasswordScreen onBack={() => setShowForgot(false)} />
        </SafeAreaProvider>
      );
    }
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/* When AuthScreen finishes logging in, it hands us the session */}
        <AuthScreen
          onAuthed={setSession}
          onForgotPassword={() => setShowForgot(true)}
        />
      </SafeAreaProvider>
    );
  }

  // ------- 3. Admin → application review queue (URS #29) -------
  if (session.accountType === "admin") {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Admin</Text>
            <Text style={styles.premiumStar}>⚙</Text>
          </View>
          <AdminScreen onLogout={() => setSession(null)} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ------- 4. Business account → depends on verification status -------
  // approved  → clinic dashboard
  // pending / rejected / suspended → status screen (no listing powers)
  if (session.accountType === "business") {
    const approved = session.status === "approved";
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {approved ? "Clinic Dashboard" : "Business Account"}
            </Text>
            {approved && <Text style={styles.premiumStar}>✓</Text>}
          </View>
          {approved ? (
            <BusinessDashboard session={session} onLogout={() => setSession(null)} />
          ) : (
            <PendingScreen
              session={session}
              onSessionChange={setSession}
              onLogout={() => setSession(null)}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ------- 5. Personal account → the main tabbed app -------
  return (
    <SafeAreaProvider>
      {/* edges=["top","bottom"] = pad around the clock AND the system buttons */}
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />

        {/* Header: shows "PawScan" on the Scan tab, else the tab's name */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {tab === "scan" ? "PawScan" : TABS.find((t) => t.key === tab)?.label}
          </Text>
          {session.tier === "premium" && <Text style={styles.premiumStar}>★</Text>}
        </View>

        {/* The screen area: exactly one of these renders, based on `tab` */}
        <View style={{ flex: 1 }}>
          {tab === "scan" && <ScanScreen session={session} onUpgrade={() => setShowUpgrade(true)} />}
          {tab === "history" && <HistoryScreen />}
          {tab === "breeds" && <BreedsScreen />}
          {tab === "profile" && (
            <ProfileScreen
              session={session}
              onSessionChange={setSession} // e.g. after upgrading to premium
              onLogout={() => {
                setSession(null); // back to the login screen
                setTab("scan");   // and reset to the first tab for next time
              }}
            />
          )}
        </View>

        {/* The tab bar. Tapping a button changes `tab`, which re-renders above. */}
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={styles.tabBtn} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabGlyph, tab === t.key && styles.tabActive]}>
                {t.glyph}
              </Text>
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: T.mossDark,
    alignItems: "center",
    justifyContent: "center",
  },
  safe: { flex: 1, backgroundColor: T.paper },
  header: {
    backgroundColor: T.mossDark,
    borderBottomWidth: 3,
    borderBottomColor: T.amber,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: T.paper, fontSize: 22, fontWeight: "800" },
  premiumStar: { color: T.amber, fontSize: 20 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingBottom: 6,
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 2 },
  tabGlyph: { fontSize: 20, opacity: 0.45 },   // dimmed when not selected
  tabActive: { opacity: 1 },                    // full color when selected
  tabLabel: { fontSize: 11, color: T.ink, opacity: 0.5, fontWeight: "600" },
  tabLabelActive: { opacity: 1, color: T.moss },
});
