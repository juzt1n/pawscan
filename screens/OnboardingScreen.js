// ============================================================================
// screens/OnboardingScreen.js — FIRST LAUNCH TUTORIAL  (URS 2.6)
// ============================================================================
// PLAIN ENGLISH: Three swipeable slides shown once, the very first time the
// app opens. The URS promises "an in-app onboarding tutorial shown on first
// launch, explaining scanning, health reports, and the veterinary disclaimer"
// — so slide 3 is the disclaimer, deliberately, and it is the last thing the
// user reads before reaching the app.
//
// "Shown once" is handled by a flag in storage (pawscan:onboarded), so it
// survives closing the app but is cleared by "reset app data".
// ============================================================================

import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { T } from "../components/shared";

const SLIDES = [
  {
    glyph: "🐾",
    title: "Scan any dog",
    body: "Point your camera at a dog, or pick a photo from your gallery. Our model compares it against 120 breeds and shows the closest matches with confidence scores.",
    points: ["Works from a photo or the camera", "Shows the top candidates, not just one guess"],
  },
  {
    glyph: "❤",
    title: "Know the risks early",
    body: "Every breed carries its own health predispositions. PawScan shows what to watch for, the earliest signs an owner would notice, and what helps prevent it.",
    points: ["Curated from published veterinary sources", "Early signs written in plain language"],
  },
  {
    glyph: "!",
    title: "Always ask a vet",
    body: "PawScan describes what a breed is prone to. It cannot examine your dog, and it never diagnoses. Anything that worries you belongs in front of a licensed veterinarian.",
    points: ["Awareness information, not a diagnosis", "A disclaimer appears on every health result"],
    warning: true,
  },
];

export default function OnboardingScreen({ onDone }) {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <View style={styles.wrap}>
      {/* Skip is available until the final (disclaimer) slide */}
      <View style={styles.topBar}>
        {!last ? (
          <TouchableOpacity onPress={onDone}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.body}>
        <View style={[styles.glyphCircle, slide.warning && styles.glyphWarn]}>
          <Text style={styles.glyph}>{slide.glyph}</Text>
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.body}</Text>

        <View style={styles.points}>
          {slide.points.map((p) => (
            <View key={p} style={styles.pointRow}>
              <Text style={styles.tick}>✓</Text>
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, n) => (
          <View key={n} style={[styles.dot, n === i && styles.dotOn]} />
        ))}
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => (last ? onDone() : setI(i + 1))}
      >
        <Text style={styles.ctaText}>{last ? "I understand — get started" : "Next"}</Text>
      </TouchableOpacity>

      {i > 0 && (
        <TouchableOpacity onPress={() => setI(i - 1)}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.mossDark, padding: 24, paddingTop: 20 },
  topBar: { flexDirection: "row", justifyContent: "flex-end", height: 30 },
  skip: { color: T.paper, opacity: 0.7, fontSize: 14, fontWeight: "600" },
  body: { flex: 1, justifyContent: "center" },
  glyphCircle: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: T.amber,
    alignItems: "center", justifyContent: "center", marginBottom: 22,
  },
  glyphWarn: { backgroundColor: T.riskHigh },
  glyph: { fontSize: 32, color: "#fff", fontWeight: "800" },
  title: { color: T.paper, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  text: { color: T.paper, opacity: 0.85, fontSize: 15, lineHeight: 23 },
  points: { marginTop: 22, gap: 10 },
  pointRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tick: { color: T.amber, fontSize: 14, fontWeight: "800" },
  pointText: { color: T.paper, opacity: 0.8, fontSize: 13.5, flex: 1, lineHeight: 19 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.paper, opacity: 0.3,
  },
  dotOn: { backgroundColor: T.amber, opacity: 1, width: 22 },
  cta: {
    backgroundColor: T.amber, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
  },
  ctaText: { color: T.mossDark, fontSize: 15.5, fontWeight: "800" },
  back: {
    color: T.paper, opacity: 0.7, textAlign: "center",
    marginTop: 14, fontSize: 14, fontWeight: "600",
  },
});
