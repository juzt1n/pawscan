// ============================================================================
// api.js — THE ONE DOOR TO "THE AI"
// ============================================================================
// PLAIN ENGLISH: Every screen that wants a dog analyzed calls ONE function
// from this file: analyzeImage(). This file then decides where the answer
// comes from:
//
//   USE_MOCK = true   →  the fake AI in mock.js (works today, no internet)
//   USE_MOCK = false  →  our real Express server on the laptop, which asks
//                        the real AI model — the app itself doesn't change!
//
// This "one door" design is the most important idea in the project:
// screens never know or care whether the answer is fake or real.
// ============================================================================

import { mockPredict } from "./mock";
import healthDB from "./data/breed_health.json";

// THE SWITCH. Flip to false on integration day (and set the address below).
export const USE_MOCK = true;

// Your laptop's address on your home Wi-Fi (find it with `ipconfig`).
// NOT "localhost" — on the phone, localhost means the phone itself!
const BACKEND_URL = "http://192.168.1.100:3001";

const THRESHOLD_NOTE =
  "The model couldn't confidently match a breed. The photo may not contain a dog, or the dog may be unclear or partially hidden.";

// ----------------------------------------------------------------------------
// Finding health data for a breed name.
// The AI says "shih tzu" but our database key might be "shih-tzu" — this
// function tries a few spellings before giving up and using "_default"
// (the general-advice entry that every unknown breed falls back to).
// ----------------------------------------------------------------------------
function healthKey(breed) {
  const key = breed.toLowerCase().trim();
  if (healthDB[key]) return key;
  const withHyphens = key.replace(/ /g, "-");
  if (healthDB[withHyphens]) return withHyphens;
  const withSpaces = key.replace(/-/g, " ");
  if (healthDB[withSpaces]) return withSpaces;
  return "_default";
}

// Used by the Breeds encyclopedia screen and the PDF export.
export function getHealthEntry(breed) {
  const key = healthKey(breed);
  return {
    entry: healthDB[key],
    coverage: key === "_default" ? "generic" : "breed-specific",
  };
}

// ----------------------------------------------------------------------------
// Turning the AI's raw answer into what the screens display.
// Raw answer  = just breed names + numbers.
// Final result = breed + confidence label + health watchlist + care tips.
// (In the finished product, the Express server will do this merging instead —
// and because the final shape stays identical, the screens won't notice.)
// ----------------------------------------------------------------------------
function buildResult(ml) {
  // The AI wasn't sure enough → tell the user honestly instead of guessing
  if (ml.belowThreshold) {
    return { isDog: false, notDogNote: THRESHOLD_NOTE, rawPredictions: ml.predictions };
  }

  const top = ml.predictions[0]; // best guess is always first
  const { entry, coverage } = getHealthEntry(top.breed);

  // Turn the 0-to-1 number into a friendly word
  const confidenceLabel =
    top.confidence >= 0.75 ? "high" : top.confidence >= 0.5 ? "medium" : "low";

  return {
    isDog: true,
    breed: {
      primary: top.breed,
      confidence: confidenceLabel,
      confidenceScore: top.confidence,
      alternatives: ml.predictions.slice(1, 3).map((p) => p.breed), // guesses #2 and #3
    },
    profile: entry.profile,
    healthWatchlist: entry.watchlist,
    careTips: entry.careTips,
    healthDataCoverage: coverage, // "generic" = we showed the fallback entry
    rawPredictions: ml.predictions.slice(0,3), // full top-3, shown as bars in the result
  };
}

// ----------------------------------------------------------------------------
// THE ONE DOOR. Screens call this and get a finished result back.
// ----------------------------------------------------------------------------
export async function analyzeImage(image) {
  if (USE_MOCK) {
    const ml = await mockPredict(); // ask the fake AI
    return buildResult(ml);
  }

  // Real mode: package the photo like an email attachment and send it to
  // our Express server, which asks the real AI and sends back the finished
  // result (already merged with health data — so no buildResult here).
  const form = new FormData();
  form.append("image", {
    uri: image.uri,
    name: "photo.jpg",
    type: image.mediaType || "image/jpeg",
  });

  const res = await fetch(`${BACKEND_URL}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// CONDITION ARTICLES (URS: tap a condition in a result to read more)
// ---------------------------------------------------------------------------
// PLAIN ENGLISH: Condition names in the breed database aren't written
// consistently — "Gastric Dilation-Volvulus (Bloat)" and
// "gastric dilatation-volvulus (bloat)" are the same thing. This normalises
// a name down to a plain key so both find the same article:
//   lowercase, drop bracketed text, drop punctuation, collapse spaces,
//   and accept the British/American spelling of dilatation/dilation.
import conditionsDB from "./data/conditions.json";

function conditionKey(name) {
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")     // remove anything in brackets
    .replace(/dilation/g, "dilatation")
    .replace(/['’]/g, "")           // cushing's -> cushings
    .replace(/[^a-z\s-]/g, " ")     // drop remaining punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Returns the article for a condition, or null if we haven't written one yet.
// The article screen handles null by showing only the breed-database facts.
export function getConditionArticle(name) {
  const key = conditionKey(name);
  if (conditionsDB[key]) return conditionsDB[key];

  // Try a looser match: does any article key appear inside this condition name?
  const hit = Object.keys(conditionsDB).find(
    (k) => !k.startsWith("_") && (key.includes(k) || k.includes(key))
  );
  return hit ? conditionsDB[hit] : null;
}
