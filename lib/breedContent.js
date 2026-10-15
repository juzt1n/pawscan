// ============================================================================
// lib/breedContent.js — ADMIN-EDITED BREED CONTENT  (URS #28)
// ============================================================================
// PLAIN ENGLISH: data/breed_health.json ships inside the app and can't be
// changed while the app runs. So when an admin edits a breed article, we save
// the edited version separately (an "override") and the app shows the override
// instead of the original wherever that breed appears — the encyclopedia,
// scan results, condition lists and the PDF vet report.
//
//   original JSON  →  admin saves an edit  →  override stored on the device
//   getHealthEntry(breed) checks overrides FIRST, then falls back to the JSON
//
// "Reset to original" deletes the override, so the shipped content returns.
//
// Overrides are kept in memory as well as in storage, because getHealthEntry()
// is called synchronously while screens draw. loadBreedOverrides() fills the
// memory copy once when the app starts (see App.js).
//
// In the real system this becomes the `breeds` / `conditions` collections in
// MongoDB, edited through the Express API — the screens won't need to change.
// ============================================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const OVERRIDES_KEY = "pawscan:breedOverrides";
const AUDIT_KEY = "pawscan:auditLog"; // same log the admin Analytics tab reads

let cache = {}; // breedKey -> edited entry (in-memory copy of storage)

// Read every saved override into memory. Call once at app start.
export async function loadBreedOverrides() {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDES_KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache;
}

// Synchronous lookup used by getHealthEntry() in api.js
export function getOverride(breedKey) {
  return cache[breedKey] || null;
}

export function isEdited(breedKey) {
  return Boolean(cache[breedKey]);
}

// Save an admin's edited version of one breed
export async function saveBreedEntry(breedKey, entry, editor) {
  cache = { ...cache, [breedKey]: { ...entry, editedAt: Date.now(), editedBy: editor } };
  await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(cache));
  await audit(`Edited encyclopedia article: ${breedKey}`, editor);
}

// Throw away the edit and go back to the shipped content
export async function resetBreedEntry(breedKey, editor) {
  const { [breedKey]: _removed, ...rest } = cache;
  cache = rest;
  await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(cache));
  await audit(`Reset encyclopedia article to original: ${breedKey}`, editor);
}

// Write to the shared append-only audit log (shown in Admin → Analytics)
async function audit(what, who) {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_KEY);
    const log = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    log.unshift({ time, who: who || "admin", what, kind: "info" });
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(0, 20)));
  } catch {
    // logging must never block the edit itself
  }
}
