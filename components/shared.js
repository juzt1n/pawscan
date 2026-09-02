// ============================================================================
// components/shared.js — OUR COLORS + THE VET DISCLAIMER
// ============================================================================
// PLAIN ENGLISH: Instead of typing color codes like "#31543B" in every file
// (and typo-ing them), we name them once here and every screen imports them.
// Change a color here → the whole app changes. "T" is short for "theme".
// ============================================================================

import { View, Text, StyleSheet } from "react-native";

export const T = {
  ink: "#22301F",      // near-black text
  paper: "#F6F5EE",    // off-white background
  moss: "#31543B",     // main green (buttons, highlights)
  mossDark: "#243E2C", // darker green (header)
  amber: "#D9A03F",    // gold accent
  amberSoft: "#F3E4C2",// pale gold (quota banner, breed tag)
  line: "#DCD8C8",     // light borders
  riskHigh: "#B4452F", // red — high risk / errors / logout
  riskMod: "#C08A2D",  // orange — moderate risk
  riskLow: "#4E7A55",  // green — low risk
};

// ---------------------------------------------------------------------------
// The veterinary disclaimer. Our PRD's safety rules REQUIRE this to appear on
// every health output and to be non-dismissable — which is why this component
// deliberately has no close button. Don't add one!
// ---------------------------------------------------------------------------
export function VetDisclaimer() {
  return (
    <View style={styles.disclaimer}>
      <Text style={styles.disclaimerTitle}>NOT A VETERINARY DIAGNOSIS</Text>
      <Text style={styles.disclaimerText}>
        Health information shows breed-associated predispositions for awareness
        only. For any medical concern, consult a licensed veterinarian.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    backgroundColor: "#FBEFE2",
    borderWidth: 1.5,
    borderColor: T.riskHigh,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  disclaimerTitle: {
    color: T.riskHigh,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  disclaimerText: { color: T.ink, fontSize: 12.5, lineHeight: 18 },
});
