// ============================================================================
// screens/ScanScreen.js — THE MAIN EVENT
// ============================================================================
// PLAIN ENGLISH: The flow on this screen, matching PRD #07/#08/#09:
//   1. Show the quota banner ("Scans left this day: 4 / 5+")
//   2. User takes a photo (camera) or picks one (gallery)
//   3. User taps "Identify this dog"
//   4. We check they still have scans left (free users get 5/day; the
//      "Watch ad" link fakes a rewarded ad for +1; premium skips all this)
//   5. api.js analyzes the photo (mock AI for now)
//   6. We copy the photo to permanent storage, save the scan to history,
//      and show the result card + the mandatory vet disclaimer
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import ResultCard from "../components/ResultCard";
import { T, VetDisclaimer } from "../components/shared";
import { analyzeImage, USE_MOCK } from "../api";
import {
  remainingScans,
  consumeScan,
  grantAdBonusScan,
  addScan,
  persistImage,
  FREE_DAILY_QUOTA,
} from "../lib/storage";

export default function ScanScreen({ session, onUpgrade}) {
  const [image, setImage] = useState(null);       // the chosen photo (or null)
  const [loading, setLoading] = useState(false);  // is the AI "thinking"?
  const [result, setResult] = useState(null);     // the analysis answer
  const [remaining, setRemaining] = useState(null); // scans left this day

  // Ask storage how many scans are left, and remember the answer
  const refreshQuota = useCallback(async () => {
    setRemaining(await remainingScans(session));
  }, [session]);

  // Do that once when the screen appears
  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // -------------------------------------------------------------------------
  // Getting a photo. fromCamera=true opens the camera, false opens the
  // gallery. Both need the user's permission first (Android/iOS rule).
  // -------------------------------------------------------------------------
  const pickImage = async (fromCamera) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "PawScan needs camera or photo access.");
      return;
    }

    // quality 0.6 = compress a bit; full-size photos are slow to upload.
    // ["images"] = the new SDK 54 way to say "photos only, no videos".
    const opts = { quality: 0.6, mediaTypes: ["images"] };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    // res.canceled = user backed out. Otherwise the photo is in assets[0].
    if (!res.canceled && res.assets?.[0]) {
      const asset = res.assets[0];
      setResult(null); // a new photo clears any old result
      setImage({ uri: asset.uri, mediaType: asset.mimeType || "image/jpeg" });
    }
  };

  // -------------------------------------------------------------------------
  // The "Identify this dog" button.
  // -------------------------------------------------------------------------
  const runAnalysis = async () => {
    if (!image) return;

    // Quota gate (PRD #15/#18): free users with 0 left get stopped here
    if (session.tier !== "premium" && remaining <= 0) {
      Alert.alert(
        "Daily scans used up",
        `Free accounts get ${FREE_DAILY_QUOTA} scans per day. Watch an ad for a bonus scan, or upgrade to Premium for unlimited scans.`
      );
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeImage(image); // the one door (api.js)
      await consumeScan(session);             // use up 1 scan (premium: no-op)
      await refreshQuota();                   // update the banner number
      setResult(data);

      // Save successful identifications to history (PRD #11).
      // persistImage copies the photo out of the temporary cache folder so
      // it still exists later for the History thumbnail and the PDF report.
      if (data.isDog) {
        await addScan({
          breed: data.breed.primary,
          confidence: data.breed.confidenceScore,
          imageUri: await persistImage(image.uri),
        });
      }
    } catch (err) {
      console.error(err); // full details go to the Expo terminal
      Alert.alert(
        "Analysis failed",
        USE_MOCK
          ? "Unexpected mock error — check the terminal."
          : "Couldn't reach the PawScan server. Is the backend running?"
      );
    } finally {
      setLoading(false); // stop the spinner whether it worked or not
    }
  };

  // The "Watch ad" link (PRD #16). A real rewarded ad would play here;
  // in the demo, pressing "Finish ad" instantly grants the bonus scan.
  const watchAd = () => {
    Alert.alert("Ad", "(Demo: a 30s rewarded ad would play here)", [
      {
        text: "Finish ad",
        onPress: async () => {
          await grantAdBonusScan();
          await refreshQuota();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // Start over with a fresh photo
  const reset = () => {
    setImage(null);
    setResult(null);
  };

  // -------------------------------------------------------------------------
  // What's on screen (top to bottom): quota banner → photo area → result
  // -------------------------------------------------------------------------
  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* Quota banner — PRD #15 */}
      <View style={styles.quotaBar}>
        <Text style={styles.quotaText}>
          {session.tier === "premium"
            ? "★ Premium — unlimited scans"
            : `Scans left this day: ${remaining ?? "…"} / ${FREE_DAILY_QUOTA}+`}
        </Text>
        {session.tier !== "premium" && (
          <TouchableOpacity onPress={watchAd}>
            <Text style={styles.adLink}>Watch ad · +1 scan</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* No photo yet → the dashed upload box */}
      {!image && (
        <View style={styles.uploadZone}>
          <Text style={styles.pawGlyph}>🐾</Text>
          <Text style={styles.uploadTitle}>Snap or upload a dog photo</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)}>
            <Text style={styles.primaryBtnText}>Open camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)}>
            <Text style={styles.secondaryBtnText}>Choose from gallery</Text>
          </TouchableOpacity>
          {USE_MOCK && (
            <Text style={styles.mockHint}>
              Demo mode: results rotate through 4 test scenarios. Any photo works.
            </Text>
          )}
        </View>
      )}

      {/* Photo chosen → preview + buttons (or the loading spinner) */}
      {image && (
        <View style={styles.card}>
          <Image source={{ uri: image.uri }} style={styles.preview} />
          {!result && !loading && (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={runAnalysis}
              >
                <Text style={styles.primaryBtnText}>Identify this dog</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtnSlim} onPress={reset}>
                <Text style={styles.secondaryBtnText}>New photo</Text>
              </TouchableOpacity>
            </View>
          )}
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={T.moss} />
              <Text style={styles.loadingText}>Reading the dog…</Text>
            </View>
          )}
        </View>
      )}

      {/* The result, plus the mandatory disclaimer on health outputs */}
      {result && <ResultCard result={result} onReset={reset}  session={session} onUpgrade={onUpgrade}/>}
      {result?.isDog && <VetDisclaimer />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 48 },
  quotaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: T.amberSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  quotaText: { color: T.ink, fontWeight: "600", fontSize: 13 },
  adLink: { color: T.moss, fontWeight: "700", fontSize: 13 },
  uploadZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: T.moss,
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  pawGlyph: { fontSize: 36 },
  uploadTitle: { fontSize: 18, fontWeight: "600", color: T.ink, marginBottom: 6 },
  primaryBtn: {
    backgroundColor: T.moss,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    alignSelf: "stretch",
  },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: T.moss,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    alignSelf: "stretch",
  },
  secondaryBtnSlim: {
    borderWidth: 1.5,
    borderColor: T.moss,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: T.moss, fontWeight: "600", fontSize: 15 },
  mockHint: { fontSize: 12, color: T.ink, opacity: 0.55, textAlign: "center", lineHeight: 17 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: T.line,
  },
  preview: { width: "100%", height: 280 },
  row: { flexDirection: "row", gap: 10, padding: 12 },
  loadingRow: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: T.ink, fontSize: 15 },
});
