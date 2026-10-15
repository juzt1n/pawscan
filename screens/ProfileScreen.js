// ============================================================================
// screens/ProfileScreen.js — ACCOUNT, PREMIUM, DOGS, EXPORTS, LOGOUT
// ============================================================================

import { useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "./useFocusEffect";
import {
  updateProfile,
  logout,
  getDogs,
  addDog,
  getHistory,
  exportHistoryCSV,
  exportVetReportPDF,
} from "../lib/storage";
import { T } from "../components/shared";
import { BREEDS } from "../data/breeds";
import UpgradeScreen from "./UpgradeScreen";
import VetLocatorScreen from "./VetLocatorScreen";

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export default function ProfileScreen({ session, onSessionChange, onLogout }) {
  const [dogs, setDogs] = useState([]);
  const [showDogForm, setShowDogForm] = useState(false); // is the add-dog form open?
  const [dogName, setDogName] = useState("");
  const [dogBreed, setDogBreed] = useState("");
  const [dogAge, setDogAge] = useState("");

  // Profile editing (URS: edit profile)
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(session.name || "");
  const [editPhone, setEditPhone] = useState(session.phone || "");

  // Upgrade screen is shown as a full-screen overlay when true
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showVets, setShowVets] = useState(false);

  const saveProfile = async () => {
    if (!editName.trim()) return Alert.alert("Name required", "Please enter a display name.");
    const updated = await updateProfile({ name: editName.trim(), phone: editPhone.trim() });
    onSessionChange(updated);
    setEditing(false);
  };

  // Reload the dog list whenever the user arrives on this tab
  useFocusEffect(useCallback(() => getDogs().then(setDogs), []));

  // ----- Upgrade (PRD #17). Opens the full plan-comparison screen. -----
  const doUpgrade = () => setShowUpgrade(true);

  // ----- Save a dog (PRD #23), with simple validation -----
  const saveDog = async () => {
    if (!dogName.trim()) return Alert.alert("Missing name", "Give your dog a name.");
    const breedKey = dogBreed.trim().toLowerCase();
    // If they typed a breed, it must be one our model knows (or left blank)
    if (breedKey && !BREEDS.includes(breedKey)) {
      return Alert.alert(
        "Unknown breed",
        "Breed must be one of the 120 supported breeds (or leave blank for mixed/unknown)."
      );
    }
    await addDog({
      name: dogName.trim(),
      breed: breedKey || "mixed / unknown",
      age: dogAge.trim() || "unknown",
    });
    setDogs(await getDogs()); // refresh the list
    // Clear and close the form
    setDogName("");
    setDogBreed("");
    setDogAge("");
    setShowDogForm(false);
  };

  // ----- Exports. Check for data FIRST so the error message is honest. -----
  const doExportCSV = async () => {
    const history = await getHistory();
    if (!history.length)
      return Alert.alert("Nothing to export", "Scan a dog first, then export.");
    try {
      await exportHistoryCSV();
    } catch (e) {
      console.error(e);
      Alert.alert("Export failed", String(e?.message || e)); // show the REAL error
    }
  };

  const doExportPDF = async () => {
    const history = await getHistory();
    if (!history.length)
      return Alert.alert("Nothing to export", "Scan a dog first, then export.");
    try {
      await exportVetReportPDF();
    } catch (e) {
      console.error(e);
      Alert.alert("Export failed", String(e?.message || e));
    }
  };

  // ----- Logout (PRD #04) -----
  const doLogout = async () => {
    await logout();  // erase the session note from storage
    onLogout();      // tell App.js → it shows the login screen again
  };

  // Full-screen upgrade overlay takes priority when open
  if (showUpgrade) {
    return (
      <UpgradeScreen
        onBack={() => setShowUpgrade(false)}
        onSessionChange={onSessionChange}
      />
    );
  }

  if (showVets) {
    return <VetLocatorScreen onBack={() => setShowVets(false)} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {/* 1. Account card — view or edit */}
      <View style={styles.card}>
        {!editing ? (
          <>
            <View style={styles.accountHead}>
              <Text style={styles.name}>{session.name}</Text>
              <TouchableOpacity onPress={() => {
                setEditName(session.name || "");
                setEditPhone(session.phone || "");
                setEditing(true);
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.email}>{session.email}</Text>
            {session.phone ? <Text style={styles.email}>{session.phone}</Text> : null}
            <View style={[styles.tierBadge, session.tier === "premium" && styles.tierPremium]}>
              <Text style={styles.tierText}>
                {session.tier === "premium" ? "★ PREMIUM" : "FREE TIER"}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>EDIT PROFILE</Text>
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="#999"
            />
            <Text style={styles.fieldLabel}>CONTACT NUMBER</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Optional"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <Text style={styles.readonlyField}>{session.email}</Text>
            <Text style={styles.readonlyHint}>
              Email is your account ID and can't be changed in this demo.
            </Text>
            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveText}>Save changes</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* 2. Upgrade — hidden once you're already premium */}
      {session.tier !== "premium" && (
        <TouchableOpacity style={styles.upgradeCard} onPress={doUpgrade}>
          <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
          <Text style={styles.upgradeText}>
            Unlimited scans · dog profiles · longitudinal tracking · PDF reports
          </Text>
        </TouchableOpacity>
      )}

      {/* 3. My Dogs — premium feature */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>MY DOGS</Text>
        {session.tier !== "premium" ? (
          <Text style={styles.lockedText}>
            Dog profiles are a Premium feature — upgrade to track your dogs'
            scans over time.
          </Text>
        ) : (
          <>
            {dogs.map((d) => (
              <View key={d.id} style={styles.dogRow}>
                <Text style={styles.dogName}>🐶 {d.name}</Text>
                <Text style={styles.dogMeta}>
                  {titleCase(d.breed)} · {d.age}
                </Text>
              </View>
            ))}
            {!showDogForm ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setShowDogForm(true)}
              >
                <Text style={styles.secondaryBtnText}>+ Add a dog</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 8, marginTop: 6 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor="#999"
                  value={dogName}
                  onChangeText={setDogName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Breed (optional, e.g. golden retriever)"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  value={dogBreed}
                  onChangeText={setDogBreed}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Age (e.g. 3 years)"
                  placeholderTextColor="#999"
                  value={dogAge}
                  onChangeText={setDogAge}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={saveDog}>
                  <Text style={styles.primaryBtnText}>Save dog</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* 4. Vet locator — verified clinics near the user (URS #22) */}
      <TouchableOpacity style={styles.card} onPress={() => setShowVets(true)}>
        <Text style={styles.sectionTitle}>NEARBY VET CLINICS</Text>
        <Text style={styles.lockedText}>
          Find verified vet clinics near you, with directions and contact details.
        </Text>
        <Text style={[styles.lockedText, { color: T.moss, fontWeight: "700", marginTop: 6, opacity: 1 }]}>
          Open vet locator →
        </Text>
      </TouchableOpacity>

      {/* 5. Exports — debug tool today, PDPA data-portability story later */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>MY DATA</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={doExportCSV}>
          <Text style={styles.secondaryBtnText}>Export scan history (CSV)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={doExportPDF}>
          <Text style={styles.secondaryBtnText}>Export vet report (PDF)</Text>
        </TouchableOpacity>
      </View>

      {/* 6. Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={doLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  accountHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editLink: { color: T.moss, fontWeight: "700", fontSize: 14 },
  fieldLabel: {
    fontSize: 9.5, letterSpacing: 1, fontWeight: "700",
    color: T.ink, opacity: 0.55, marginTop: 10, marginBottom: 5,
  },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    color: T.ink, backgroundColor: T.paper,
  },
  readonlyField: { fontSize: 15, color: T.ink, opacity: 0.7, paddingVertical: 2 },
  readonlyHint: { fontSize: 11, color: T.ink, opacity: 0.5, marginTop: 4, lineHeight: 15 },
  editButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: T.line, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  cancelText: { color: T.ink, fontWeight: "700", fontSize: 14, opacity: 0.7 },
  saveBtn: {
    flex: 1, backgroundColor: T.moss, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  wrap: { padding: 18, paddingBottom: 48, gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 16,
  },
  name: { fontSize: 20, fontWeight: "800", color: T.ink },
  email: { fontSize: 13, color: T.ink, opacity: 0.6, marginTop: 2 },
  tierBadge: {
    alignSelf: "flex-start",
    backgroundColor: T.line,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  tierPremium: { backgroundColor: T.amber },
  tierText: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: T.ink },
  upgradeCard: {
    backgroundColor: T.mossDark,
    borderRadius: 14,
    padding: 16,
  },
  upgradeTitle: { color: T.amber, fontWeight: "800", fontSize: 16 },
  upgradeText: { color: T.paper, opacity: 0.85, fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: T.moss,
    marginBottom: 10,
  },
  lockedText: { fontSize: 13.5, color: T.ink, opacity: 0.65, lineHeight: 19 },
  dogRow: {
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    paddingVertical: 8,
  },
  dogName: { fontSize: 15, fontWeight: "700", color: T.ink },
  dogMeta: { fontSize: 12.5, color: T.ink, opacity: 0.6, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: T.paper,
    color: T.ink,
  },
  primaryBtn: {
    backgroundColor: T.moss,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: T.moss,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: { color: T.moss, fontWeight: "700", fontSize: 14 },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: T.riskHigh,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: { color: T.riskHigh, fontWeight: "700", fontSize: 15 },
});