// ============================================================================
// lib/storage.js — EVERYTHING THE APP REMEMBERS
// ============================================================================
// PLAIN ENGLISH: Phones give every app a small private notebook that survives
// closing the app. It's called AsyncStorage. This file is the ONLY place in
// our project allowed to write in that notebook. Everything else asks this
// file to save or fetch things.
//
// What we keep in the notebook (each under its own label, called a "key"):
//   pawscan:session    who is "logged in" (name, email, free or premium)
//   pawscan:quota      how many scans used this day + bonus scans from ads
//   pawscan:history    the list of past scans
//   pawscan:bookmarks  breeds the user starred in the encyclopedia
//   pawscan:dogs       the user's own dogs (premium feature)
//
// IMPORTANT HONESTY NOTES (also good for the report):
// 1. This notebook is NOT encrypted. Fine for bookmarks; NOT fine for real
//    passwords/tokens — those must go in the phone's secure storage later.
// 2. There is no real login yet. "Logging in" just writes a note that says
//    you're logged in. Real accounts move to our server + database later —
//    and because screens only ever call the functions below, we'll only have
//    to rewrite THIS file, not the screens.
// ============================================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
// NOTE the "/legacy" — Expo SDK 54 changed its file-system library, and the
// simple functions we use live at this legacy address now. Without /legacy
// the export features crash.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { getHealthEntry } from "../api";

// All our notebook labels in one place, so we never mistype them
const KEYS = {
  session: "pawscan:session",
  onboarded: "pawscan:onboarded",
  history: "pawscan:history",
  bookmarks: "pawscan:bookmarks",
  dogs: "pawscan:dogs",
  businesses: "pawscan:businesses",
};

// Demo-only admin account. In the real system, admin is a role stored in the
// database and granted deliberately - never a hardcoded email.
export const DEMO_ADMIN_EMAIL = "admin@pawscan.demo";

// Free accounts get this many scans per day (premium = unlimited)
export const FREE_DAILY_QUOTA = 3;

// ---------------------------------------------------------------------------
// Two tiny helpers. The notebook can only store TEXT, so we convert our data
// to text when saving (JSON.stringify) and back when reading (JSON.parse).
// ---------------------------------------------------------------------------
async function getJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback; // nothing saved yet → fallback
  } catch {
    return fallback; // corrupted data → fallback rather than crash
  }
}
const setJSON = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

// ===========================================================================
// SESSION — who is logged in  (mock version of PRD #01 register / #03 login)
// ===========================================================================
export const getSession = () => getJSON(KEYS.session, null);

export async function login(email, name) {
  const addr = email.trim().toLowerCase();

  // Is this the demo admin account?
  if (addr === DEMO_ADMIN_EMAIL) {
    const session = { email: addr, name: "System Admin", tier: "free",
                      accountType: "admin", status: "active", createdAt: Date.now() };
    await setJSON(KEYS.session, session);
    return session;
  }

  // Is there a business application under this email? If so, log them back in
  // as a business user, carrying whatever status the admin has set.
  const app = await getMyBusiness(addr);
  if (app) {
    const session = { email: addr, name: app.clinicName, tier: "free",
                      accountType: "business", status: app.status,
                      businessId: app.id, createdAt: Date.now() };
    await setJSON(KEYS.session, session);
    return session;
  }

  // Otherwise: an ordinary personal account
  const session = {
    email: addr,
    name: name || addr.split("@")[0], // no name given? use the email's front part
    tier: "free",                     // everyone starts free; see upgradeToPremium
    accountType: "personal",
    status: "active",
    createdAt: Date.now(),
  };
  await setJSON(KEYS.session, session);
  return session;
}

// PRD #04 Logout — simply erase the session note
export const logout = () => AsyncStorage.removeItem(KEYS.session);

// PRD #17 Upgrade — in the real app a payment would happen first
export async function upgradeToPremium() {
  const s = await getSession();
  if (!s) return null;
  const updated = { ...s, tier: "premium" };
  await setJSON(KEYS.session, updated);
  return updated;
}

// Edit the account's display name and contact number (URS profile editing).
// Email is the account key here, so it is not editable in this demo build.
export async function updateProfile({ name, phone }) {
  const s = await getSession();
  if (!s) return null;
  const updated = { ...s };
  if (name !== undefined) updated.name = name;
  if (phone !== undefined) updated.phone = phone;
  await setJSON(KEYS.session, updated);
  return updated;
}

// ===========================================================================
// SCAN QUOTA — PRD #15 (show remaining), #16 (ad bonus), #18 (premium = ∞)
// ===========================================================================
// Quota is stored PER ACCOUNT so it never carries between users.
// Each account gets its own key: "pawscan:quota:their@email.com"
function quotaKey(session) {
  return `pawscan:quota:${session.email}`;
}
// "2026-7" style label for the current day — when it changes, quota resets
function currentDay() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getDay() + 1}`;
}

export async function getQuota(session) {
  const key = quotaKey(session);
  const q = await getJSON(key, null);
  if (!q || q.day !== currentDay()) {
    const fresh = { day: currentDay(), used: 0, bonus: 0 };
    await setJSON(key, fresh);
    return fresh;
  }
  return q;
}

export async function remainingScans(session) {
  if (session?.tier === "premium") return Infinity; // unlimited
  const q = await getQuota(session);
  return Math.max(FREE_DAILY_QUOTA + q.bonus - q.used, 0); // never below 0
}

export async function consumeScan(session) {
  if (session.tier === "premium") return;   // premium = unlimited, keep this line
  const q = await getQuota(session);
  await setJSON(quotaKey(session), { ...q, used: q.used + 1 });
}

// "Watch ad → +1 scan". The ad itself is faked in the Scan screen.
export async function grantAdBonusScan() {
  const q = await getQuota();
  await setJSON(KEYS.quota, { ...q, bonus: q.bonus + 1 });
}

// ===========================================================================
// SCAN HISTORY — PRD #11 (view), #12 (delete)
// ===========================================================================
export const getHistory = () => getJSON(KEYS.history, []);

export async function addScan(record) {
  const history = await getHistory();
  const entry = { id: String(Date.now()), timestamp: Date.now(), ...record };
  // Newest first; keep at most 100 so the notebook doesn't grow forever
  await setJSON(KEYS.history, [entry, ...history].slice(0, 100));
  return entry;
}

export async function deleteScan(id) {
  const history = await getHistory();
  await setJSON(KEYS.history, history.filter((h) => h.id !== id));
}

// ===========================================================================
// BOOKMARKS — PRD #14 (star a breed in the encyclopedia)
// ===========================================================================
export const getBookmarks = () => getJSON(KEYS.bookmarks, []);

export async function toggleBookmark(breed) {
  const bookmarks = await getBookmarks();
  const next = bookmarks.includes(breed)
    ? bookmarks.filter((b) => b !== breed) // already starred → remove it
    : [...bookmarks, breed];               // not starred → add it
  await setJSON(KEYS.bookmarks, next);
  return next;
}

// ===========================================================================
// DOG PROFILES — PRD #23 (premium feature)
// ===========================================================================
export const getDogs = () => getJSON(KEYS.dogs, []);

export async function addDog(dog) {
  const dogs = await getDogs();
  const entry = { id: String(Date.now()), ...dog };
  await setJSON(KEYS.dogs, [...dogs, entry]);
  return entry;
}

// ===========================================================================
// PHOTO KEEPING
// ===========================================================================
// PLAIN ENGLISH: When you take a photo, the phone puts it in a TEMPORARY
// folder that the system may clean out at any time. If we want the photo to
// still exist next week (for history thumbnails and PDF reports), we must
// copy it into our app's PERMANENT folder. This does that and returns the
// new, safe address of the photo.
export async function persistImage(tempUri) {
  try {
    const dest = FileSystem.documentDirectory + "scan_" + Date.now() + ".jpg";
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  } catch {
    return tempUri; // copying failed → keep the temp address (better than nothing)
  }
}

// ===========================================================================
// EXPORT 1: CSV — a simple table of scans that Excel/Sheets can open
// ===========================================================================
export async function exportHistoryCSV() {
  const history = await getHistory();

  // CSV = plain text where commas separate columns and newlines separate rows
  const header = "Date,Time,Breed,Confidence\n";
  const rows = history
    .map((h) => {
      const d = new Date(h.timestamp);
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        `"${h.breed}"`, // quotes protect breed names that contain commas
        (h.confidence * 100).toFixed(1) + "%",
      ].join(",");
    })
    .join("\n");

  // Write the text into a file, then open the phone's Share menu with it
  const fileUri = FileSystem.documentDirectory + "pawscan_history.csv";
  await FileSystem.writeAsStringAsync(fileUri, header + rows);
  await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
}

// ===========================================================================
// EXPORT 2: PDF VET REPORT — photo + breed + health watchlist per scan
// (This is the PRD's premium "exportable report" feature.)
// ===========================================================================
// HOW IT WORKS: we build a small web page (HTML) as a big text string, and
// expo-print turns that page into a PDF file. To put photos INSIDE the PDF,
// each photo is converted to base64 (the photo written out as text) and
// embedded directly in the page.
export async function exportVetReportPDF() {
  const history = await getHistory();
  if (!history.length) throw new Error("No scans to export.");

  const sections = [];
  for (const scan of history) {
    // Try to embed the photo; if it's gone, say so instead of crashing
    let imgTag = "";
    try {
      const b64 = await FileSystem.readAsStringAsync(scan.imageUri, {
        encoding: "base64",
      });
      imgTag = `<img src="data:image/jpeg;base64,${b64}" style="width:200px;border-radius:10px;" />`;
    } catch {
      imgTag = `<div style="color:#999;font-size:12px;">(photo no longer available)</div>`;
    }

    // Look up this breed's health watchlist and turn it into a bullet list
    const { entry } = getHealthEntry(scan.breed);
    const watchlist = entry.watchlist
      .map(
        (h) => `<li><b>${h.condition}</b> (${h.risk} risk)<br/>
          <span style="font-size:12px;">Early signs: ${h.earlySigns} · Prevention: ${h.prevention}</span></li>`
      )
      .join("");

    sections.push(`
      <div style="page-break-inside:avoid;border:1px solid #ddd;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h2 style="margin:0 0 4px;">${scan.breed.replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
        <p style="margin:0 0 10px;color:#555;font-size:13px;">
          Scanned ${new Date(scan.timestamp).toLocaleString()} ·
          Model confidence ${(scan.confidence * 100).toFixed(1)}%
        </p>
        ${imgTag}
        <h3 style="font-size:14px;margin:12px 0 6px;">Breed health predispositions</h3>
        <ul style="margin:0;padding-left:18px;">${watchlist}</ul>
      </div>`);
  }

  // The full page: title, one section per scan, disclaimer at the bottom.
  // The disclaimer is REQUIRED on all health outputs (our PRD's safety rule).
  const html = `
    <html><body style="font-family:-apple-system,Helvetica,sans-serif;color:#22301F;padding:12px;">
      <h1 style="margin-bottom:2px;">PawScan — Scan Report</h1>
      <p style="color:#555;font-size:13px;margin-top:0;">Generated ${new Date().toLocaleString()}</p>
      ${sections.join("")}
      <div style="border:2px solid #B4452F;border-radius:10px;padding:12px;margin-top:8px;">
        <b style="color:#B4452F;font-size:12px;letter-spacing:1px;">NOT A VETERINARY DIAGNOSIS</b>
        <p style="font-size:12px;margin:6px 0 0;">
          Breed identification is an automated estimate; health items are breed-associated
          predispositions for awareness only. Please consult a licensed veterinarian.
        </p>
      </div>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html }); // HTML → PDF file
  await Sharing.shareAsync(uri, { mimeType: "application/pdf" }); // Share menu
}

// ===========================================================================
// BUSINESS ACCOUNTS - URS use case #02 (register) and #29 (admin approval)
// ===========================================================================
// PLAIN ENGLISH: A vet clinic applies for a verified listing. The application
// is stored with status "pending" until an admin reviews it. The admin's job
// is to check the two identifiers below against Singapore's public registers:
//
//   UEN         - Unique Entity Number from ACRA; proves the business exists
//   AVS licence - NParks Animal & Veterinary Service licence for the clinic
//
// DEMO LIMITATION (state this in the report): verification is a manual
// admin decision. Automated ACRA/AVS registry lookups are out of scope.

export const getBusinesses = () => getJSON(KEYS.businesses, []);

// Find the application belonging to one email address
export async function getMyBusiness(email) {
  const all = await getBusinesses();
  const addr = String(email || "").trim().toLowerCase();
  return all.find((b) => b.email === addr) || null;
}

// URS #02 - submit a business application. Starts life as "pending".
export async function registerBusiness({ email, clinicName, uen, avsLicence,
                                         address, phone }) {
  const all = await getBusinesses();
  const entry = {
    id: String(Date.now()),
    email: email.trim().toLowerCase(),
    clinicName: clinicName.trim(),
    uen: uen.trim().toUpperCase(),
    avsLicence: avsLicence.trim().toUpperCase(),
    address: address.trim(),
    phone: phone.trim(),
    status: "pending",      // pending -> approved | rejected
    reason: null,           // why it was rejected, if it was
    submittedAt: Date.now(),
    reviewedAt: null,
  };
  await setJSON(KEYS.businesses, [entry, ...all]);

  // Log them straight in so they can see the "under review" screen
  const session = { email: entry.email, name: entry.clinicName, tier: "free",
                    accountType: "business", status: "pending",
                    businessId: entry.id, createdAt: Date.now() };
  await setJSON(KEYS.session, session);
  return session;
}

// URS #29 - the admin approves or rejects an application
export async function reviewBusinessApplication(id, decision, reason) {
  const all = await getBusinesses();
  const updated = all.map((b) =>
    b.id === id
      ? { ...b, status: decision, reason: reason || null, reviewedAt: Date.now() }
      : b
  );
  await setJSON(KEYS.businesses, updated);
  return updated.find((b) => b.id === id);
}

// URS - a verified listing can later be suspended (licences lapse, clinics close)
export async function suspendBusiness(id, reason) {
  return reviewBusinessApplication(id, "suspended", reason);
}

// The business user edits their own listing details
export async function updateBusinessListing(id, fields) {
  const all = await getBusinesses();
  const updated = all.map((b) => (b.id === id ? { ...b, ...fields } : b));
  await setJSON(KEYS.businesses, updated);
  return updated.find((b) => b.id === id);
}

// Re-read the current user's status from storage and refresh their session.
// Needed because the ADMIN changes the application, not the business user -
// so the business user's session must pick the change up on next login/focus.
export async function refreshSessionStatus() {
  const s = await getSession();
  if (!s || s.accountType !== "business") return s;
  const app = await getMyBusiness(s.email);
  if (!app || app.status === s.status) return s;
  const updated = { ...s, status: app.status };
  await setJSON(KEYS.session, updated);
  return updated;
}

// ===========================================================================
// ONBOARDING — first-launch tutorial flag (URS 2.6)
// ===========================================================================
// PLAIN ENGLISH: we remember whether the welcome tutorial has been shown, so
// it only appears the very first time the app is opened on a device.
export async function hasSeenOnboarding() {
  const v = await AsyncStorage.getItem(KEYS.onboarded);
  return v === "true";
}

export async function markOnboardingSeen() {
  await AsyncStorage.setItem(KEYS.onboarded, "true");
}
