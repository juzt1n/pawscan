import { getDb } from "./db.js";

const THRESHOLD_NOTE =
  "The model couldn't confidently match a breed. The photo may not contain a dog, or the dog may be unclear or partially hidden.";

const FALLBACK = {
  profile: { size: "Varies", lifespan: "10-14 years typical", temperament: "Varies by breed and individual" },
  watchlist: [],
  careTips: ["Annual vet checkups; ask a vet about breed-specific screening."],
};

// Same spelling-tolerant lookup as healthKey() in the app's api.js
export async function getHealthEntry(breed) {
  const key = String(breed).toLowerCase().trim();
  const candidates = [key, key.replace(/ /g, "-"), key.replace(/-/g, " ")];
  const docs = await getDb().collection("breeds").find({ _id: { $in: [...candidates, "_default"] } }).toArray();
  const byId = Object.fromEntries(docs.map((d) => [d._id, d]));
  const hit = candidates.find((c) => byId[c]);
  return { entry: byId[hit || "_default"] || FALLBACK, coverage: hit ? "breed-specific" : "generic" };
}

// Same output shape as buildResult() in the app's api.js (that is what the screens expect)
export async function buildResult(ml) {
  if (ml.belowThreshold) {
    return { isDog: false, notDogNote: THRESHOLD_NOTE, rawPredictions: ml.predictions };
  }
  const top = ml.predictions[0];
  const { entry, coverage } = await getHealthEntry(top.breed);
  const confidenceLabel = top.confidence >= 0.75 ? "high" : top.confidence >= 0.5 ? "medium" : "low";
  return {
    isDog: true,
    breed: {
      primary: top.breed,
      confidence: confidenceLabel,
      confidenceScore: top.confidence,
      alternatives: ml.predictions.slice(1, 3).map((p) => p.breed),
    },
    profile: entry.profile,
    healthWatchlist: entry.watchlist,
    careTips: entry.careTips,
    healthDataCoverage: coverage,
    rawPredictions: ml.predictions.slice(0, 3),
  };
}
