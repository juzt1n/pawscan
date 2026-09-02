// ============================================================================
// screens/ConditionArticle.js — CONDITION DETAIL  (URS #3.3.2 premium)
// ============================================================================
// PLAIN ENGLISH: When a user taps a condition in a health watchlist, this
// screen opens with a fuller, plain-language article about it: what it is,
// early signs, what helps, and when to see a vet. The disclaimer is repeated
// here because this is health content.
//
// The article text is looked up from a small local library keyed by condition
// name. Anything we don't have a written article for falls back to the short
// watchlist detail that was passed in, so the screen never comes up blank.
// ============================================================================

import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { T } from "../components/shared";

// A tiny starter library. In the final system this lives in the database
// (same "data not code" principle as the breed health file) and is managed
// by moderators. Keys are matched loosely (case-insensitive, "contains").
const ARTICLES = {
  "hip dysplasia": {
    what: "A malformation of the hip joint where the ball and socket don't fit together smoothly. Over time the poor fit causes wear, inflammation and arthritis.",
    signs: ["Stiffness when getting up after rest",
            "A 'bunny-hopping' gait when running",
            "Reluctance to jump, climb stairs, or exercise",
            "Thinning muscle over the hindquarters"],
    helps: ["Keep the dog lean — body weight is the single biggest factor you control",
            "Moderate, regular exercise; avoid high-impact bursts while growing",
            "Ask the breeder for OFA or PennHIP hip-screening results of the parents",
            "Your vet may advise joint supplements or, in severe cases, surgery"],
    vet: "See a vet if you notice persistent stiffness, limping, or difficulty rising — early management slows the arthritis that follows.",
  },
  "cancer": {
    what: "Several breeds are predisposed to particular cancers. Early detection makes a large difference to the options available and the outcome.",
    signs: ["Any new or growing lump",
            "Unexplained weight loss or lasting tiredness",
            "Pale gums, or sudden weakness or collapse",
            "Sores that don't heal, or unusual bleeding"],
    helps: ["Check your dog over for lumps regularly and note anything new",
            "Twice-yearly vet checks from middle age for higher-risk breeds",
            "Don't 'wait and watch' a lump — have it examined promptly",
            "Keep the dog lean and up to date with routine care"],
    vet: "Have any new lump, or any of the signs above, checked without delay. Most lumps are harmless, but only a vet can tell.",
  },
  "brachycephalic": {
    what: "Flat-faced breeds have compressed airways, so breathing takes more effort. Heat and exertion make it worse, and it can become an emergency.",
    signs: ["Loud snoring or noisy breathing at rest",
            "Poor tolerance of heat or exercise",
            "Blue-tinged gums after exertion (EMERGENCY)",
            "Gagging or bringing up foam"],
    helps: ["Avoid the midday heat entirely — walk at dawn or dusk in Singapore",
            "Keep the dog lean; extra weight worsens breathing",
            "Use a harness, never a neck collar",
            "Severe cases can be improved with airway surgery"],
    vet: "Seek urgent care for blue gums, collapse, or severe breathing distress. Discuss airway assessment with your vet for persistent noisy breathing.",
  },
  "patellar luxation": {
    what: "The kneecap slips out of its groove, causing a skip or hop. Common in small breeds and graded by severity.",
    signs: ["A sudden skip or hop for a step or two, then normal",
            "Holding up a hind leg briefly",
            "Stiffness after rest in older dogs"],
    helps: ["Keep the dog lean to reduce load on the joint",
            "Ask your vet to grade the knees at annual checks",
            "Avoid encouraging jumps from height",
            "Higher grades may need surgical correction"],
    vet: "See a vet if the skipping becomes frequent or the dog seems in pain — grading guides whether monitoring or surgery is right.",
  },
  "dental disease": {
    what: "Plaque hardens into tartar, inflaming the gums and eventually loosening teeth. Very common, and largely preventable.",
    signs: ["Bad breath", "Yellow-brown tartar on the teeth",
            "Red or bleeding gums", "Reluctance to chew hard food"],
    helps: ["Brush the teeth daily with dog-specific toothpaste",
            "Provide vet-approved dental chews",
            "Book professional cleanings as your vet advises"],
    vet: "See a vet if gums bleed, teeth look loose, or breath is strongly unpleasant — untreated dental disease is painful and affects overall health.",
  },
};

function findArticle(condition) {
  const key = condition.toLowerCase();
  for (const k of Object.keys(ARTICLES)) {
    if (key.includes(k)) return ARTICLES[k];
  }
  return null;
}

export default function ConditionArticle({ condition, risk, breed, fallback, onBack }) {
  const article = findArticle(condition);
  const riskColor =
    risk === "high" ? T.riskHigh : risk === "moderate" ? T.riskMod : T.riskLow;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← Back to results</Text>
      </TouchableOpacity>

      {/* Condition header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: riskColor }]} />
          <Text style={styles.title}>{condition}</Text>
        </View>
        <Text style={[styles.riskLine, { color: riskColor }]}>
          {risk ? risk.toUpperCase() + " RISK" : ""}
          {breed ? `  ·  ${breed}` : ""}
        </Text>
      </View>

      {article ? (
        <>
          <Section title="What it is">
            <Text style={styles.body}>{article.what}</Text>
          </Section>

          <Section title="Early signs to watch for">
            {article.signs.map((s, i) => (
              <Text key={i} style={styles.bullet}>•  {s}</Text>
            ))}
          </Section>

          <Section title="What helps">
            {article.helps.map((s, i) => (
              <Text key={i} style={styles.bullet}>•  {s}</Text>
            ))}
          </Section>

          <View style={styles.vetCard}>
            <Text style={styles.vetHead}>WHEN TO SEE A VET</Text>
            <Text style={styles.vetBody}>{article.vet}</Text>
          </View>
        </>
      ) : (
        // Fallback for conditions without a full written article yet
        <Section title="Summary">
          <Text style={styles.body}>
            {fallback?.earlySigns ? `Early signs: ${fallback.earlySigns}\n` : ""}
            {fallback?.prevention ? `What helps: ${fallback.prevention}` : ""}
          </Text>
          <Text style={[styles.body, { opacity: 0.6, marginTop: 8, fontStyle: "italic" }]}>
            A detailed article for this condition is still being written.
          </Text>
        </Section>
      )}

    </ScrollView>
  );
}

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40 },
  back: { color: T.moss, fontWeight: "700", fontSize: 15, marginBottom: 12 },
  headerCard: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 18, fontWeight: "800", color: T.ink, flex: 1 },
  riskLine: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 6, marginLeft: 20 },
  section: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11, letterSpacing: 2, fontWeight: "700", color: T.moss, marginBottom: 10,
  },
  body: { fontSize: 13.5, color: T.ink, lineHeight: 20 },
  bullet: { fontSize: 13.5, color: T.ink, lineHeight: 21, marginBottom: 2 },
  vetCard: {
    backgroundColor: T.mossDark, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  vetHead: {
    fontSize: 11, letterSpacing: 2, fontWeight: "700", color: T.amber, marginBottom: 8,
  },
  vetBody: { fontSize: 13.5, color: T.paper, lineHeight: 20 },
});
