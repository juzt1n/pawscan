// ============================================================================
// screens/AuthScreen.js — LOGIN & REGISTER  (URS #01 personal, #02 business)
// ============================================================================
// PLAIN ENGLISH: One screen, three shapes:
//   login              -> email + password
//   register personal  -> name + email + password + confirm + terms
//   register business  -> the above PLUS clinic name, UEN, AVS licence,
//                         address and phone (URS use case #02)
//
// A business registration does NOT create a verified clinic. It creates an
// APPLICATION with status "pending". An admin must approve it (URS #29) after
// checking the UEN against ACRA and the licence against the AVS register.
// That two-step design is the whole point: anyone can type a number, so the
// trust boundary is the admin review, not the form.
// ============================================================================

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { login, registerBusiness } from "../lib/storage";
import { T } from "../components/shared";

// Singapore UENs are 9-10 characters, letters and digits.
// This is FORMAT validation only - it proves nothing about whether the
// business actually exists. Real verification happens in the admin review.
const UEN_PATTERN = /^[0-9A-Z]{9,10}$/i;

export default function AuthScreen({ onAuthed, onForgotPassword }) {
  const [mode, setMode] = useState("login");                  // "login" | "register"
  const [accountType, setAccountType] = useState("personal"); // "personal" | "business"

  // shared fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);

  // business-only fields
  const [clinicName, setClinicName] = useState("");
  const [uen, setUen] = useState("");
  const [avsLicence, setAvsLicence] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [error, setError] = useState(null);

  const isBusiness = mode === "register" && accountType === "business";

  const submit = async () => {
    setError(null);

    // Rule 7a - required fields (applies to every shape of this form)
    if (!email.trim() || !password) return setError("Please fill in all fields.");

    if (mode === "login") {
      return onAuthed(await login(email.trim()));
    }

    // ---- registration checks ----
    if (password !== confirm) {
      setConfirm("");                       // PRD says: clear the confirm box
      return setError("Passwords do not match.");
    }
    if (!agreed)
      return setError("Please accept the terms, including the veterinary disclaimer.");

    if (isBusiness) {
      if (!clinicName.trim() || !uen.trim() || !avsLicence.trim() || !address.trim())
        return setError("Please complete all clinic details.");
      if (!UEN_PATTERN.test(uen.trim()))
        return setError("UEN must be 9-10 letters or digits (e.g. 53412345X).");

      // URS #02 - creates a PENDING application, not a verified listing
      return onAuthed(
        await registerBusiness({
          email: email.trim(), clinicName, uen, avsLicence, address, phone,
        })
      );
    }

    if (!name.trim()) return setError("Please fill in all fields.");
    onAuthed(await login(email.trim(), name.trim()));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.mossDark }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.logo}>🐾 PawScan</Text>
        <Text style={styles.tagline}>
          Identify the breed. Know the health risks before they arrive.
        </Text>

        <View style={styles.card}>
          <Text style={styles.heading}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>

          {/* Account type switch - only shown when registering */}
          {mode === "register" && (
            <View style={styles.segment}>
              {[["personal", "Personal"], ["business", "Vet Clinic"]].map(
                ([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.segBtn, accountType === value && styles.segBtnOn]}
                    onPress={() => {
                      setAccountType(value);
                      setError(null);
                    }}
                  >
                    <Text
                      style={[styles.segText, accountType === value && styles.segTextOn]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}

          {mode === "register" && accountType === "personal" && (
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === "register" && (
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#999"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
          )}

          {/* ---- Business-only block (URS #02) ---- */}
          {isBusiness && (
            <>
              <Text style={styles.sectionLabel}>CLINIC VERIFICATION DETAILS</Text>
              <TextInput
                style={styles.input}
                placeholder="Clinic name"
                placeholderTextColor="#999"
                value={clinicName}
                onChangeText={setClinicName}
              />
              <TextInput
                style={styles.input}
                placeholder="UEN (ACRA business number)"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                value={uen}
                onChangeText={setUen}
              />
              <TextInput
                style={styles.input}
                placeholder="AVS veterinary centre licence no."
                placeholderTextColor="#999"
                autoCapitalize="characters"
                value={avsLicence}
                onChangeText={setAvsLicence}
              />
              <TextInput
                style={styles.input}
                placeholder="Clinic address"
                placeholderTextColor="#999"
                value={address}
                onChangeText={setAddress}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Text style={styles.verifyNote}>
                Your UEN and licence number will be checked against ACRA and the
                NParks AVS registers by our team before your listing goes live.
              </Text>
            </>
          )}

          {mode === "register" && (
            <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(!agreed)}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed && <Text style={styles.checkmark}>OK</Text>}
              </View>
              <Text style={styles.checkText}>
                I accept the terms & conditions, privacy policy, and understand
                PawScan does not provide veterinary diagnoses.
              </Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.primaryBtn} onPress={submit}>
            <Text style={styles.primaryBtnText}>
              {mode === "login"
                ? "Login"
                : isBusiness
                ? "Submit application"
                : "Register"}
            </Text>
          </TouchableOpacity>

          {mode === "login" && onForgotPassword && (
            <TouchableOpacity onPress={onForgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            <Text style={styles.switchText}>
              {mode === "login"
                ? "New to PawScan? Sign up"
                : "Already have an account? Login"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.mockNote}>
            Demo build: authentication is mocked locally. Log in as
            admin@pawscan.demo to review business applications.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  logo: { fontSize: 34, fontWeight: "800", color: T.paper, textAlign: "center" },
  tagline: {
    color: T.paper, opacity: 0.8, textAlign: "center",
    marginTop: 6, marginBottom: 24, fontSize: 14,
  },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  heading: { fontSize: 20, fontWeight: "700", color: T.ink, marginBottom: 14 },
  segment: {
    flexDirection: "row", backgroundColor: T.paper, borderRadius: 10,
    padding: 4, marginBottom: 14,
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  segBtnOn: { backgroundColor: T.moss },
  segText: { fontSize: 14, fontWeight: "700", color: T.moss },
  segTextOn: { color: "#fff" },
  sectionLabel: {
    fontSize: 10, letterSpacing: 1.5, fontWeight: "800",
    color: T.moss, marginTop: 6, marginBottom: 8,
  },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: T.ink, marginBottom: 10, backgroundColor: T.paper,
  },
  verifyNote: {
    fontSize: 11.5, color: T.ink, opacity: 0.6,
    lineHeight: 16, marginBottom: 12,
  },
  checkRow: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: T.moss, alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxOn: { backgroundColor: T.moss },
  checkmark: { color: "#fff", fontSize: 10, fontWeight: "800" },
  checkText: { flex: 1, fontSize: 12.5, color: T.ink, lineHeight: 18 },
  error: { color: T.riskHigh, fontSize: 13, marginBottom: 8 },
  primaryBtn: {
    backgroundColor: T.moss, borderRadius: 10,
    paddingVertical: 13, alignItems: "center", marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  forgotText: { color: T.moss, textAlign: "center", marginTop: 12, fontWeight: "600", fontSize: 13 },
  switchText: { color: T.moss, textAlign: "center", marginTop: 14, fontWeight: "600" },
  mockNote: { fontSize: 11, color: T.ink, opacity: 0.5, marginTop: 14, lineHeight: 16 },
});
