// ============================================================================
// mock.js — THE FAKE AI
// ============================================================================
// PLAIN ENGLISH: The real AI model lives in Google Colab and isn't connected
// yet. This file PRETENDS to be it. Every time you press "Identify this dog",
// the app gets one of the 4 fake answers below (in rotation), formatted
// EXACTLY the way the real AI will format its answers.
//
// Why bother? Because it lets us build and test the whole app today. On
// integration day we flip ONE switch (in api.js) and the real AI takes over —
// and nothing else needs to change, because the "shape" of the answer is
// identical.
//
// The shape (agreed with our ML teammate — do not change without agreeing!):
//   predictions:     the AI's top-5 guesses, best first,
//                    each { breed: "name", confidence: 0-to-1 number }
//   belowThreshold:  true if even the best guess is under 40% sure
//                    (we treat that as "probably not a clear dog photo")
// ============================================================================

const SCENARIOS = [
  // Scenario 1 — the happy path: the AI is very sure (91%)
  {
    predictions: [
      { breed: "golden retriever", confidence: 0.9134 },
      { breed: "labrador retriever", confidence: 0.0512 },
      { breed: "flat-coated retriever", confidence: 0.0189 },
      { breed: "irish setter", confidence: 0.0091 },
      { breed: "cocker spaniel", confidence: 0.0044 },
    ],
    belowThreshold: false,
  },

  // Scenario 2 — lookalike breeds: husky vs malamute is a real weakness
  // of our model, so we test how the app shows a less-confident answer
  {
    predictions: [
      { breed: "siberian husky", confidence: 0.6218 },
      { breed: "malamute", confidence: 0.3067 },
      { breed: "eskimo dog", confidence: 0.0412 },
      { breed: "samoyed", confidence: 0.0203 },
      { breed: "german shepherd", confidence: 0.0055 },
    ],
    belowThreshold: false,
  },

  // Scenario 3 — below the 40% line: the app should say "no confident match"
  // instead of guessing. Tests our "not a dog / unclear photo" screen.
  {
    predictions: [
      { breed: "pug", confidence: 0.3391 },
      { breed: "french bulldog", confidence: 0.2814 },
      { breed: "boston bull", confidence: 0.1822 },
      { breed: "boxer", confidence: 0.0917 },
      { breed: "bull mastiff", confidence: 0.0521 },
    ],
    belowThreshold: true,
  },

  // Scenario 4 — a breed we have NO detailed health data for yet.
  // Tests that the app falls back to general advice instead of crashing.
  {
    predictions: [
      { breed: "otterhound", confidence: 0.8231 },
      { breed: "bloodhound", confidence: 0.0912 },
      { breed: "english foxhound", confidence: 0.0433 },
      { breed: "beagle", confidence: 0.0255 },
      { breed: "basset", confidence: 0.0102 },
    ],
    belowThreshold: false,
  },
];

// Remembers how many scans we've done, so we can rotate through the scenarios
let callCount = 0;

export function mockPredict() {
  const scenario = SCENARIOS[callCount % SCENARIOS.length]; // pick next in rotation
  callCount++;

  // Real AI takes about a second to think. We fake that delay too, so the
  // "Reading the dog…" loading spinner gets properly tested.
  return new Promise((resolve) => setTimeout(() => resolve(scenario), 1200));
}
