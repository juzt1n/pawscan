// ============================================================================
// screens/admin/AdminEncyclopedia.js — MANAGE BREED ENCYCLOPEDIA  (URS #28)
// ============================================================================
// PLAIN ENGLISH: The admin can open any of the 120 breed articles and edit it:
//   • breed profile (size, lifespan, temperament)
//   • health conditions — edit, add a new one, or remove one
//   • care tips (one per line)
// Saving stores the edit as an override (lib/breedContent.js), so it appears
// immediately in the encyclopedia, scan results and PDF report. "Reset to
// original" brings back the shipped content.
//
// Why the admin can't add or delete whole BREEDS: the list must match the 120
// classes the AI model was trained on. A breed the model can't predict would
// never be reached, and deleting one would leave scan results with no health
// data. So the admin manages the CONTENT of each breed article instead.
// ============================================================================

import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from "react-native";
import { BREEDS } from "../../data/breeds";
import { getHealthEntry, getOriginalHealthEntry } from "../../api";
import { isEdited, saveBreedEntry, resetBreedEntry } from "../../lib/breedContent";
import { DEMO_ADMIN_EMAIL } from "../../lib/storage";
import { T } from "../../components/shared";

const RISKS = ["high", "moderate", "low"];
const RISK_COLOR = { high: T.riskHigh, moderate: T.riskMod, low: T.riskLow };
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminEncyclopedia() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // breed key being edited
  const [, refresh] = useState(0);              // re-render after save/reset

  if (editing) {
    return (
      <BreedEditor
        breedKey={editing}
        onClose={() => {
          setEditing(null);
          refresh((n) => n + 1);
        }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const list = BREEDS.filter((b) => !q || b.includes(q));
  const editedCount = BREEDS.filter(isEdited).length;

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.summary}>
        <Summary n={BREEDS.length} label="articles" color={T.moss} />
        <Summary n={editedCount} label="edited" color={T.riskMod} />
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search 120 breed articles"
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {list.map((b) => {
        const { entry } = getHealthEntry(b);
        const edited = isEdited(b);
        return (
          <TouchableOpacity key={b} style={styles.row} onPress={() => setEditing(b)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{titleCase(b)}</Text>
              <Text style={styles.rowMeta}>
                {entry?.watchlist?.length || 0} conditions
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: edited ? T.riskMod : T.riskLow }]}>
              <Text style={styles.pillText}>{edited ? "EDITED" : "ORIGINAL"}</Text>
            </View>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        );
      })}

      {list.length === 0 && <Text style={styles.empty}>No breeds match "{query}".</Text>}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Articles cover the 120 breeds the AI model can identify. Edits apply
          everywhere the breed appears and are recorded in the audit log.
        </Text>
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------------------------------
// The edit form for one breed
// ----------------------------------------------------------------------------
function BreedEditor({ breedKey, onClose }) {
  const start = getHealthEntry(breedKey).entry || {};
  const [size, setSize] = useState(start.profile?.size || "");
  const [lifespan, setLifespan] = useState(start.profile?.lifespan || "");
  const [temperament, setTemperament] = useState(start.profile?.temperament || "");
  const [conditions, setConditions] = useState(
    (start.watchlist || []).map((c) => ({ ...c }))
  );
  const [tips, setTips] = useState((start.careTips || []).join("\n"));

  const updateCondition = (i, field, value) =>
    setConditions((cs) => cs.map((c, n) => (n === i ? { ...c, [field]: value } : c)));

  const addCondition = () =>
    setConditions((cs) => [
      ...cs,
      { condition: "", risk: "moderate", earlySigns: "", prevention: "" },
    ]);

  const removeCondition = (i) =>
    Alert.alert("Remove condition?", conditions[i].condition || "Untitled condition", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => setConditions((cs) => cs.filter((_, n) => n !== i)),
      },
    ]);

  const save = async () => {
    // Required fields: every condition needs a name, early signs and prevention
    const incomplete = conditions.findIndex(
      (c) => !c.condition.trim() || !c.earlySigns.trim() || !c.prevention.trim()
    );
    if (incomplete !== -1) {
      return Alert.alert(
        "Incomplete condition",
        `Condition ${incomplete + 1} needs a name, early signs and prevention.`
      );
    }
    if (conditions.length === 0) {
      return Alert.alert("No conditions", "An article needs at least one condition.");
    }

    await saveBreedEntry(
      breedKey,
      {
        profile: {
          size: size.trim(),
          lifespan: lifespan.trim(),
          temperament: temperament.trim(),
        },
        watchlist: conditions.map((c) => ({
          condition: c.condition.trim(),
          risk: c.risk,
          earlySigns: c.earlySigns.trim(),
          prevention: c.prevention.trim(),
        })),
        careTips: tips.split("\n").map((t) => t.trim()).filter(Boolean),
      },
      DEMO_ADMIN_EMAIL
    );
    Alert.alert("Saved", `${titleCase(breedKey)} article updated.`);
    onClose();
  };

  const reset = () =>
    Alert.alert(
      "Reset to original?",
      "This discards all edits to this article and restores the shipped content.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetBreedEntry(breedKey, DEMO_ADMIN_EMAIL);
            onClose();
          },
        },
      ]
    );

  const hasOriginal = Boolean(getOriginalHealthEntry(breedKey));

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.back}>← All articles</Text>
      </TouchableOpacity>
      <Text style={styles.editorTitle}>{titleCase(breedKey)}</Text>
      {isEdited(breedKey) && (
        <Text style={styles.editedNote}>This article has been edited.</Text>
      )}

      {/* Profile */}
      <Text style={styles.section}>BREED PROFILE</Text>
      <Field label="Size" value={size} onChange={setSize} />
      <Field label="Lifespan" value={lifespan} onChange={setLifespan} />
      <Field label="Temperament" value={temperament} onChange={setTemperament} multiline />

      {/* Conditions */}
      <Text style={styles.section}>HEALTH CONDITIONS</Text>
      {conditions.map((c, i) => (
        <View
          key={i}
          style={[styles.condCard, { borderLeftColor: RISK_COLOR[c.risk] || T.line }]}
        >
          <View style={styles.condHead}>
            <Text style={styles.condNum}>Condition {i + 1}</Text>
            <TouchableOpacity onPress={() => removeCondition(i)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
          <Field label="Name" value={c.condition} onChange={(v) => updateCondition(i, "condition", v)} />

          <Text style={styles.fieldLabel}>RISK LEVEL</Text>
          <View style={styles.riskRow}>
            {RISKS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.riskBtn,
                  { borderColor: RISK_COLOR[r] },
                  c.risk === r && { backgroundColor: RISK_COLOR[r] },
                ]}
                onPress={() => updateCondition(i, "risk", r)}
              >
                <Text style={[styles.riskBtnText, { color: c.risk === r ? "#fff" : RISK_COLOR[r] }]}>
                  {r.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Early signs" value={c.earlySigns} onChange={(v) => updateCondition(i, "earlySigns", v)} multiline />
          <Field label="Prevention" value={c.prevention} onChange={(v) => updateCondition(i, "prevention", v)} multiline />
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={addCondition}>
        <Text style={styles.addBtnText}>+ Add condition</Text>
      </TouchableOpacity>

      {/* Care tips */}
      <Text style={styles.section}>CARE TIPS</Text>
      <Field label="One tip per line" value={tips} onChange={setTips} multiline tall />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveBtnText}>Save article</Text>
      </TouchableOpacity>
      {isEdited(breedKey) && hasOriginal && (
        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>Reset to original</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const Field = ({ label, value, onChange, multiline, tall }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
    <TextInput
      style={[styles.input, multiline && { textAlignVertical: "top" }, tall && { minHeight: 90 }]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      placeholderTextColor="#999"
    />
  </View>
);

const Summary = ({ n, label, color }) => (
  <View style={styles.sumBox}>
    <Text style={[styles.sumNum, { color }]}>{n}</Text>
    <Text style={styles.sumLabel}>{label.toUpperCase()}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  summary: { flexDirection: "row", gap: 10, marginBottom: 12 },
  sumBox: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  sumNum: { fontSize: 22, fontWeight: "800" },
  sumLabel: { fontSize: 10, color: T.ink, opacity: 0.6, letterSpacing: 1, marginTop: 2 },
  search: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: T.ink, marginBottom: 10,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff",
    borderWidth: 1, borderColor: T.line, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: T.ink },
  rowMeta: { fontSize: 11.5, color: T.ink, opacity: 0.6, marginTop: 2 },
  pill: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  pillText: { color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.4 },
  editLink: { color: T.moss, fontWeight: "800", fontSize: 13 },
  empty: { fontSize: 13, color: T.ink, opacity: 0.6, textAlign: "center", padding: 20 },
  note: { backgroundColor: T.amberSoft, borderRadius: 10, padding: 12, marginTop: 6 },
  noteText: { fontSize: 11.5, color: T.ink, opacity: 0.8, lineHeight: 16 },

  back: { color: T.moss, fontWeight: "700", fontSize: 15, marginBottom: 8 },
  editorTitle: { fontSize: 22, fontWeight: "800", color: T.ink },
  editedNote: { fontSize: 12, color: T.riskMod, fontWeight: "700", marginTop: 2 },
  section: {
    fontSize: 11, letterSpacing: 1.5, fontWeight: "800", color: T.moss,
    marginTop: 18, marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 9.5, letterSpacing: 1, fontWeight: "700", color: T.ink,
    opacity: 0.55, marginBottom: 4,
  },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink,
  },
  condCard: {
    backgroundColor: T.paper, borderWidth: 1, borderColor: T.line, borderLeftWidth: 4,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  condHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  condNum: { fontSize: 12, fontWeight: "800", color: T.ink },
  remove: { fontSize: 12, fontWeight: "700", color: T.riskHigh },
  riskRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  riskBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, alignItems: "center",
  },
  riskBtnText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 },
  addBtn: {
    borderWidth: 1.5, borderColor: T.moss, borderStyle: "dashed", borderRadius: 10,
    paddingVertical: 11, alignItems: "center",
  },
  addBtnText: { color: T.moss, fontWeight: "800", fontSize: 14 },
  saveBtn: {
    backgroundColor: T.moss, borderRadius: 10, paddingVertical: 13,
    alignItems: "center", marginTop: 20,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  resetBtn: {
    borderWidth: 1.5, borderColor: T.riskHigh, borderRadius: 10, paddingVertical: 12,
    alignItems: "center", marginTop: 10,
  },
  resetBtnText: { color: T.riskHigh, fontWeight: "800", fontSize: 14 },
});
