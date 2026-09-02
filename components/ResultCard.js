// ============================================================================
// components/ResultCard.js — HOW A RESULT LOOKS  (PRD #09, #19-#21)
// ============================================================================
// PLAIN ENGLISH: The Scan screen hands this component a finished result
// (built in api.js) and this file just draws it:
//
//   result.isDog === false → the "no confident match" card
//   result.isDog === true  → breed tag → profile → health watchlist →
//                            care tips → raw model output bars
//
// The raw output bars at the bottom show ALL top-5 guesses with their
// percentages — great for demos, because it shows the AI's actual
// "thinking" instead of hiding it behind one answer.
// ============================================================================

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { T } from "./shared";
import ConditionArticle from "../screens/ConditionArticle";

// Pick the dot/label color for a risk level
const riskColor = (r) =>
  r === "high" ? T.riskHigh : r === "moderate" ? T.riskMod : T.riskLow;

// "golden retriever" → "Golden Retriever" (capitalize each word)
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export default function ResultCard({ result, onReset, session, onUpgrade}) {
  // When a user taps a condition, we show the full article as an overlay.
  const [openCondition, setOpenCondition] = useState(null);
  // ---------- Case 1: the AI wasn't confident enough ----------
  if (!result.isDog) {
    return (
      <View style={[styles.section, { marginTop: 16 }]}>
        <Text style={styles.sectionTitle}>NO CONFIDENT MATCH</Text>
        <Text style={styles.text}>{result.notDogNote}</Text>
        {result.rawPredictions && (
          <RawPredictions preds={result.rawPredictions} />
        )}
        <TouchableOpacity style={styles.btn} onPress={onReset}>
          <Text style={styles.btnText}>Try another photo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Case 2: we have a breed ----------
  const { breed, profile, healthWatchlist, careTips, healthDataCoverage } =
    result;

  // If a condition is open, show its article instead of the result card
  if (openCondition) {
    return (
      <ConditionArticle
        condition={openCondition.condition}
        risk={openCondition.risk}
        breed={titleCase(breed.primary)}
        fallback={openCondition}
        onBack={() => setOpenCondition(null)}
      />
    );
  }

  return (
    <View style={{ marginTop: 16, gap: 14 }}>
      {/* The gold breed tag — the headline answer */}
      <View style={styles.breedTag}>
        <Text style={styles.breedName}>{titleCase(breed.primary)}</Text>
        <Text style={styles.breedMeta}>
          {(breed.confidenceScore * 100).toFixed(1)}% · {breed.confidence}{" "}
          confidence
          {breed.alternatives?.length
            ? `\nCould also be: ${breed.alternatives.map(titleCase).join(" or ")}`
            : ""}
        </Text>
      </View>

      {/* Breed profile: size, lifespan, temperament */}
      {profile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BREED PROFILE</Text>
          <Fact k="Size" v={profile.size} />
          <Fact k="Lifespan" v={profile.lifespan} />
          <Fact k="Temperament" v={profile.temperament} />
        </View>
      )}

      {/* The health watchlist. If we only had generic data (breed not in our
          database yet), we say so in the title — honesty over pretending. */}

      {session?.tier === "premium" ? (
        healthWatchlist?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              HEALTH WATCHLIST{" "}
              {healthDataCoverage === "generic"
                ? "(GENERAL — BREED NOT IN DATABASE YET)"
                : ""}
            </Text>
            {healthWatchlist.map((h, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.6}
                onPress={() => setOpenCondition(h)}
                style={[
                  styles.watchItem,
                  i > 0 && { borderTopWidth: 1, borderTopColor: T.line },
                ]}
              >
                <View style={styles.watchHeader}>
                  <View
                    style={[styles.dot, { backgroundColor: riskColor(h.risk) }]}
                  />
                  <Text style={styles.condition}>{h.condition}</Text>
                  <Text
                    style={[styles.riskLabel, { color: riskColor(h.risk) }]}
                  >
                    {h.risk?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.watchDetail}>
                  Early signs: {h.earlySigns}
                </Text>
                <Text style={styles.watchDetail}>
                  Prevention: {h.prevention}
                </Text>
                <Text style={styles.readMore}>Read more →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HEALTH REPORT</Text>
          <Text style={styles.text}>
            See this breed's health predispositions, early signs, and
            prevention.
          </Text>
          <TouchableOpacity onPress={onUpgrade}>
            <Text
              style={[
                styles.text,
                { color: T.moss, fontWeight: "700", marginTop: 8 },
              ]}
            >
              Upgrade to Premium to unlock →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Care tips on a dark card, to stand apart from the medical content */}
      {careTips?.length > 0 && (
        <View style={[styles.section, { backgroundColor: T.mossDark }]}>
          <Text style={[styles.sectionTitle, { color: T.amber }]}>
            CARE TIPS
          </Text>
          {careTips.map((t, i) => (
            <Text key={i} style={[styles.text, { color: T.paper }]}>
              • {t}
            </Text>
          ))}
        </View>
      )}

      {/* The AI's full top-3, as bars */}
      {result.rawPredictions && (
        <RawPredictions preds={result.rawPredictions} />
      )}

      <TouchableOpacity style={styles.btn} onPress={onReset}>
        <Text style={styles.btnText}>Scan another dog</Text>
      </TouchableOpacity>
    </View>
  );
}

// The top-3 bar chart. Each bar's width = that guess's percentage.
function RawPredictions({ preds }) {
  return (
    <View style={styles.rawBox}>
      <Text style={styles.rawTitle}>MODEL OUTPUT (TOP 3)</Text>
      {preds.slice(0, 3).map((p, i) => (
        <View key={i} style={styles.rawRow}>
          <Text style={styles.rawBreed}>{titleCase(p.breed)}</Text>
          <View style={styles.barTrack}>
            {/* Math.max(...,2) keeps tiny percentages visible as a sliver */}
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(p.confidence * 100, 2)}%` },
              ]}
            />
          </View>
          <Text style={styles.rawPct}>{(p.confidence * 100).toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}

// A small "LABEL over value" pair used in the profile card
const Fact = ({ k, v }) => (
  <View style={{ marginBottom: 8 }}>
    <Text style={styles.factKey}>{k.toUpperCase()}</Text>
    <Text style={styles.text}>{v || "—"}</Text>
  </View>
);

const styles = StyleSheet.create({
  breedTag: {
    backgroundColor: T.amberSoft,
    borderWidth: 2,
    borderColor: T.amber,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  breedName: { fontSize: 24, fontWeight: "700", color: T.ink },
  breedMeta: {
    fontSize: 13,
    color: T.ink,
    opacity: 0.75,
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: T.moss,
    marginBottom: 10,
  },
  text: { fontSize: 14, color: T.ink, marginBottom: 4, lineHeight: 20 },
  factKey: { fontSize: 10, letterSpacing: 1, color: T.ink, opacity: 0.55 },
  watchItem: { paddingVertical: 10 },
  watchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  condition: { fontSize: 15, fontWeight: "600", color: T.ink, flexShrink: 1 },
  readMore: { fontSize: 12.5, color: T.moss, fontWeight: "700", marginTop: 6 },
  riskLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  rawBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 16,
    marginTop: 2,
  },
  rawTitle: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: T.ink,
    opacity: 0.5,
    marginBottom: 8,
  },
  rawRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  rawBreed: { fontSize: 12, color: T.ink, width: 130 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: T.paper,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: 8, backgroundColor: T.moss, borderRadius: 4 },
  rawPct: { fontSize: 12, color: T.ink, width: 48, textAlign: "right" },
  watchDetail: {
    fontSize: 13,
    color: T.ink,
    opacity: 0.8,
    paddingLeft: 18,
    marginBottom: 2,
  },
  btn: {
    backgroundColor: T.moss,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
