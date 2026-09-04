// ============================================================================
// screens/ForgotPasswordScreen.js — PASSWORD RESET REQUEST  (URS #05)
// ============================================================================
// PLAIN ENGLISH: The user types their email and we say "if that account
// exists, we've sent a link".
//
// SECURITY POINT WORTH KNOWING (good material for the report): we show the
// SAME confirmation whether or not the email is registered. If we said
// "no such account", an attacker could type addresses one by one and learn
// who has a PawScan account — that's called account enumeration. Identical
// responses close that hole. The cost is a slightly vaguer message; the
// benefit is that the form can't be used as a lookup tool.
//
// DEMO LIMITATION: no email is actually sent. The real system sends a
// single-use, time-limited token via the backend.
// ============================================================================

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { T } from "../components/shared";

export default function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const submit = () => {
    setError(null);
    if (!email.trim()) return setError("Please enter your email address.");
    // Deliberately no check for whether the account exists - see note above.
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.logo}>🐾 PawScan</Text>

      {!sent ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Forgot your password?</Text>
          <Text style={styles.text}>
            Enter the email address linked to your account and we'll send you a
            link to set a new password.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.primaryBtn} onPress={submit}>
            <Text style={styles.primaryBtnText}>Send reset link</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack}>
            <Text style={styles.link}>Back to login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.tickCircle}>
            <Text style={styles.tick}>✓</Text>
          </View>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.text}>
            If an account exists for {email.trim()}, a password reset link is on
            its way. The link expires in 30 minutes and can only be used once.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onBack}>
            <Text style={styles.primaryBtnText}>Back to login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSent(false)}>
            <Text style={styles.link}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* The security rationale, shown in-app so the demo explains itself */}
      {/* <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>WHY THE MESSAGE IS VAGUE</Text>
        <Text style={styles.noteText}>
          The same confirmation appears whether or not the address is
          registered. This prevents the form from being used to discover which
          email addresses have PawScan accounts.
        </Text>
      </View> */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.mossDark, padding: 24, justifyContent: "center" },
  logo: {
    fontSize: 28, fontWeight: "800", color: T.paper,
    textAlign: "center", marginBottom: 22,
  },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  heading: { fontSize: 19, fontWeight: "700", color: T.ink, marginBottom: 8 },
  text: { fontSize: 13.5, color: T.ink, opacity: 0.75, lineHeight: 20, marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: T.ink, backgroundColor: T.paper, marginBottom: 12,
  },
  error: { color: T.riskHigh, fontSize: 13, marginBottom: 8 },
  primaryBtn: {
    backgroundColor: T.moss, borderRadius: 10,
    paddingVertical: 13, alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { color: T.moss, textAlign: "center", marginTop: 14, fontWeight: "600", fontSize: 14 },
  tickCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: T.riskLow,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  tick: { color: "#fff", fontSize: 24, fontWeight: "800" },
  noteBox: {
    backgroundColor: T.amber, borderRadius: 12, padding: 14, marginTop: 18, opacity: 0.95,
  },
  noteTitle: {
    fontSize: 10, fontWeight: "800", letterSpacing: 1.2,
    color: T.mossDark, marginBottom: 5,
  },
  noteText: { fontSize: 11.5, color: T.mossDark, lineHeight: 17 },
});
