// ============================================================================
// lib/storageRemote.js - the REAL version of everything lib/storageLocal.js did
// ============================================================================
// Same function names and return shapes as the old AsyncStorage file, but the
// data now lives in MongoDB behind the Express API. Screens don't change.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { request, getToken, setToken, clearToken } from "./http";
import { imageFile } from "./imageFile";
import * as local from "./storageLocal"; // only for device-side helpers (PDF/CSV builders, photo copy, onboarding)

export { persistImage, hasSeenOnboarding, markOnboardingSeen } from "./storageLocal";

const SESSION_KEY = "pawscan:session";
const IMAGE_MAP_KEY = "pawscan:scanImages"; // scan id -> photo file on THIS phone

async function readJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
const saveSession = async (session) => {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

// ---------------------------------------------------------------- session ---
export async function getSession() {
  if (!(await getToken())) return null;
  return readJSON(SESSION_KEY, null);
}

// login(email, name, password). If name is given and no account exists yet, this
// registers one (the old mock used one function for both).
export async function login(email, name, password) {
  if (!email || !password) throw new Error("Please fill up email/password.");
  try {
    const { token, session } = await request("POST", "/auth/login", { email, password });
    await setToken(token);
    return saveSession(session);
  } catch (e) {
    if (e.status === 401 && name) {
      const { token, session } = await request("POST", "/auth/register", { email, password, name });
      await setToken(token); // a 409 here (email taken) is thrown to the screen as-is
      return saveSession(session);
    }
    throw e;
  }
}

export async function logout() {
  await clearToken();
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function upgradeToPremium() {
  return saveSession(await request("POST", "/me/upgrade"));
}

export async function updateProfile({ name, phone }) {
  return saveSession(await request("PATCH", "/me", { name, phone }));
}

// Re-read the account from the server (the admin may have approved/suspended it)
export async function refreshSessionStatus() {
  if (!(await getToken())) return null;
  try {
    return await saveSession(await request("GET", "/me"));
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      await logout();
      return null;
    }
    throw e;
  }
}

// ------------------------------------------------------------------ quota ---
// The SERVER is the source of truth for quota (it can't be cheated from the phone).
export const getQuota = () => request("GET", "/quota");

export async function remainingScans() {
  const q = await request("GET", "/quota");
  return q.remaining === null ? Infinity : q.remaining; // null = premium
}

// /analyze already deducts a scan on the server after a successful result,
// so this is intentionally empty. Kept so the Scan screen's call still works.
export async function consumeScan() {}

export async function grantAdBonusScan() {
  return request("POST", "/quota/ad-bonus");
}

// ---------------------------------------------------------------- history ---
async function imageMap() {
  return readJSON(IMAGE_MAP_KEY, {});
}

export async function getHistory() {
  const [rows, map] = await Promise.all([request("GET", "/scans"), imageMap()]);
  return rows.map((r) => ({ ...r, imageUri: map[r.id] }));
}

export async function addScan(record) {
  const { imageUri, ...rest } = record;
  const form = new FormData();
  form.append("record", JSON.stringify(rest));
  if (imageUri) form.append("image", imageFile(imageUri));
  const entry = await request("POST", "/scans", undefined, { form });
  if (imageUri) {
    const map = await imageMap();
    map[entry.id] = imageUri;
    await AsyncStorage.setItem(IMAGE_MAP_KEY, JSON.stringify(map));
  }
  return { ...entry, imageUri };
}

export async function deleteScan(id) {
  await request("DELETE", `/scans/${id}`);
  const map = await imageMap();
  delete map[id];
  await AsyncStorage.setItem(IMAGE_MAP_KEY, JSON.stringify(map));
}

// -------------------------------------------------- bookmarks / dog profiles
export const getBookmarks = () => request("GET", "/bookmarks");
export const toggleBookmark = (breed) => request("POST", "/bookmarks/toggle", { breed });
export const getDogs = () => request("GET", "/dogs");
export const addDog = (dog) => request("POST", "/dogs", dog);

// ---------------------------------------------------------------- exports ---
// Same PDF/CSV builders as before, fed with the history from the server.
export const exportHistoryCSV = async () => local.exportHistoryCSV(await getHistory());
export const exportVetReportPDF = async () => local.exportVetReportPDF(await getHistory());

// ------------------------------------------------------------- businesses ---
export async function getBusinesses() {
  try {
    return await request("GET", "/businesses"); // admin only
  } catch (e) {
    if (e.status === 403) return [];
    throw e;
  }
}

export async function getMyBusiness() {
  try {
    return await request("GET", "/businesses/me");
  } catch (e) {
    if (e.status === 404 || e.status === 403) return null;
    throw e;
  }
}

// NOTE: now needs a `password` field in the object (new account is created)
export async function registerBusiness(fields) {
  const { token, session } = await request("POST", "/businesses/register", fields);
  await setToken(token);
  return saveSession(session);
}

export const reviewBusinessApplication = (id, decision, reason) =>
  request("POST", `/businesses/${id}/review`, { decision, reason });
export const suspendBusiness = (id, reason) => reviewBusinessApplication(id, "suspended", reason);
export const updateBusinessListing = (id, fields) => request("PATCH", `/businesses/${id}`, fields);
// Sorted by distance when the user allows location; otherwise newest first.
export async function getNearbyClinics() {
  let qs = "";
  try {
    const Location = await import("expo-location");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      qs = `?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`;
    }
  } catch {
    /* no location: the server still returns the verified clinics */
  }
  return request("GET", `/clinics/nearby${qs}`);
}

// Anonymous referral counts for the clinic dashboard (no user ids are stored)
export async function logClinicEvent(id, type) {
  try {
    await request("POST", `/clinics/${id}/events`, { type });
  } catch {
    /* statistics must never block the user */
  }
}
export const getBusinessStats = () => request("GET", "/businesses/me/stats");

// PRD #05: the server always answers the same way, whether or not the email exists
export const requestPasswordReset = (email) => request("POST", "/auth/forgot", { email });

// ------------------------------------------------------------------ admin ---
export const getUsers = () => request("GET", "/admin/users");
export async function setUserStatus(id, status) {
  await request("PATCH", `/admin/users/${id}/status`, { status });
  return getUsers();
}
export const getAnalytics = () => request("GET", "/admin/analytics");
export const getAuditLog = () => request("GET", "/admin/audit");
// The server already writes an audit entry for every admin action it performs
// (suspend/reinstate, approve/reject, encyclopedia edits), so the screens' extra
// call is skipped here to avoid duplicate lines. Use logAdminNote() for free-text notes.
export async function addAuditEntry() {}
export async function logAdminNote(what, kind = "ok") {
  try {
    await request("POST", "/admin/audit", { what, kind });
  } catch {
    /* an audit-log hiccup must never break the admin action itself */
  }
}
