// ============================================================================
// screens/UpgradeScreen.js — PLAN COMPARISON  (PRD #17, URS upgrade flow)
// ============================================================================
// PLAIN ENGLISH: A proper side-by-side of Free vs Premium, replacing the old
// pop-up alert. The user sees exactly what upgrading unlocks before paying.
//
// Payment itself is SIMULATED in this demo build (stated on screen). Pressing
// "Upgrade" calls upgradeToPremium() in storage, which flips the tier; App.js
// then receives the refreshed session so the quota banner and premium badges
// update across the whole app immediately.
// ============================================================================

import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { upgradeToPremium } from "../lib/storage";
import { T } from "../components/shared";

const FREE = ["5 scans per month", "Breed encyclopaedia", "Scan history", "Bookmarks"];
const PREMIUM = [
  "Unlimited scans",
  "Dog profiles with health tracking",
  "PDF vet report export",
  "Full condition articles",
  "Find nearby vets",
  "No advertisements",
];

export default function UpgradeScreen({ onBack, onSessionChange }) {
  const buy = () => {
    Alert.alert(
      "Confirm upgrade",
      "Demo build: no real payment is taken. Continue to unlock Premium?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upgrade",
          onPress: async () => {
            const updated = await upgradeToPremium();
            onSessionChange(updated);
            onBack();
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Choose your plan</Text>
      <Text style={styles.sub}>Cancel anytime.</Text>

      {/* Free tier */}
      <View style={styles.freeCard}>
        <View style={styles.planHead}>
          <Text style={styles.planName}>Free</Text>
          <Text style={styles.planPrice}>$0</Text>
        </View>
        {FREE.map((f) => (
          <Text key={f} style={styles.freeFeature}>–  {f}</Text>
        ))}
        <View style={styles.currentPill}>
          <Text style={styles.currentText}>CURRENT PLAN</Text>
        </View>
      </View>

      {/* Premium tier — highlighted */}
      <View style={styles.premiumCard}>
        <View style={styles.bestBadge}>
          <Text style={styles.bestText}>BEST VALUE</Text>
        </View>
        <View style={styles.planHead}>
          <Text style={styles.planName}>Premium</Text>
          <Text style={styles.planPrice}>$4.90<Text style={styles.perMo}>/mo</Text></Text>
        </View>
        {PREMIUM.map((f) => (
          <Text key={f} style={styles.premiumFeature}>+  {f}</Text>
        ))}
        <TouchableOpacity style={styles.buyBtn} onPress={buy}>
          <Text style={styles.buyText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>
        Billing would be handled by the platform app store. Demo build: payment
        is simulated and no charge is made.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40 },
  back: { color: T.moss, fontWeight: "700", fontSize: 15, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: "800", color: T.ink },
  sub: { fontSize: 13, color: T.ink, opacity: 0.65, marginBottom: 16 },
  freeCard: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  premiumCard: {
    backgroundColor: T.amberSoft, borderWidth: 2, borderColor: T.amber,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  planHead: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "baseline", marginBottom: 10,
  },
  planName: { fontSize: 18, fontWeight: "800", color: T.ink },
  planPrice: { fontSize: 20, fontWeight: "800", color: T.ink },
  perMo: { fontSize: 13, fontWeight: "600", color: T.ink },
  freeFeature: { fontSize: 13.5, color: T.ink, opacity: 0.8, lineHeight: 24 },
  premiumFeature: { fontSize: 13.5, color: T.ink, lineHeight: 24, fontWeight: "500" },
  currentPill: {
    alignSelf: "flex-start", backgroundColor: T.line,
    borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10,
  },
  currentText: { fontSize: 9.5, fontWeight: "800", color: T.ink, letterSpacing: 0.6 },
  bestBadge: {
    alignSelf: "flex-end", backgroundColor: T.amber,
    borderRadius: 5, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 2,
  },
  bestText: { fontSize: 9.5, fontWeight: "800", color: T.mossDark, letterSpacing: 0.6 },
  buyBtn: {
    backgroundColor: T.moss, borderRadius: 10,
    paddingVertical: 14, alignItems: "center", marginTop: 14,
  },
  buyText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  note: { fontSize: 11.5, color: T.ink, opacity: 0.6, lineHeight: 17, textAlign: "center" },
});
