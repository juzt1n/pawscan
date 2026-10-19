import { useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, Modal,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { request } from "../lib/http";
import { BACKEND_URL } from "../lib/config";
import { upgradeToPremium } from "../lib/storage";
import { T } from "../components/shared";

export default function CheckoutScreen({ onBack, onSessionChange, onDone }) {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);

  // 1. Tap "Pay" → ask backend for a Stripe Checkout URL → open WebView
  const pay = async () => {
    setLoading(true);
    try {
      const { url } = await request("POST", "/stripe/create-checkout-session");
      setCheckoutUrl(url);
    } catch (e) {
      Alert.alert("Couldn't start checkout", e?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 2. WebView watches for the redirect to /api/stripe/return
  const onNavChange = (navState) => {
    const url = navState.url || "";
    if (url.includes("/api/stripe/return")) {
      const match = url.match(/[?&]session_id=([^&]+)/);
      const sessionId = match ? decodeURIComponent(match[1]) : null;
      setCheckoutUrl(null);
      if (sessionId) activatePremium(sessionId);
    } else if (url.includes("/api/stripe/cancel")) {
      setCheckoutUrl(null);
    }
  };

  // 3. Verify with backend → flip tier → update local cache
  const activatePremium = async (sessionId) => {
    setLoading(true);
    try {
      await request("POST", "/stripe/activate-premium", { sessionId });
      const updated = await upgradeToPremium();
      onSessionChange(updated);
      Alert.alert("Payment successful", "You are now a Premium member!", [
        { text: "OK", onPress: onDone },
      ]);
    } catch (e) {
      Alert.alert("Activation failed", e?.message || "Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.wrap}>
        <TouchableOpacity onPress={onBack} disabled={loading}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Checkout</Text>

        <View style={styles.card}>
          <Text style={styles.section}>Order summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>PawScan Premium (monthly)</Text>
            <Text style={styles.value}>$4.90</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.total}>Total due today</Text>
            <Text style={styles.total}>$4.90</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, loading && { opacity: 0.7 }]}
          onPress={pay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payText}>Pay $4.90</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          Test mode — use card 4242 4242 4242 4242, any future date, any CVC.
        </Text>
      </ScrollView>

      {/* Stripe Checkout WebView modal */}
      <Modal visible={!!checkoutUrl} animationType="slide" onRequestClose={() => setCheckoutUrl(null)}>
        <View style={styles.webviewWrap}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity onPress={() => setCheckoutUrl(null)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {checkoutUrl && (
            <WebView
              source={{ uri: checkoutUrl }}
              onNavigationStateChange={onNavChange}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40 },
  back: { color: T.moss, fontWeight: "700", fontSize: 15, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: "800", color: T.ink, marginBottom: 16 },
  card: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  section: { fontSize: 13, fontWeight: "800", color: T.ink, opacity: 0.6, marginBottom: 10, letterSpacing: 0.4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  label: { fontSize: 14, color: T.ink },
  value: { fontSize: 14, color: T.ink, fontWeight: "600" },
  totalRow: { borderTopWidth: 1, borderTopColor: T.line, marginTop: 8, paddingTop: 10 },
  total: { fontSize: 16, fontWeight: "800", color: T.ink },
  payBtn: {
    backgroundColor: T.moss, borderRadius: 10,
    paddingVertical: 15, alignItems: "center", marginTop: 6,
  },
  payText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  note: { fontSize: 11.5, color: T.ink, opacity: 0.6, textAlign: "center", marginTop: 12 },
  webviewWrap: { flex: 1, backgroundColor: "#fff" },
  webviewHeader: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.line,
  },
  cancelBtn: { color: T.moss, fontWeight: "700", fontSize: 15 },
});