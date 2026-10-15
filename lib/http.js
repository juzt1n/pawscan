// ============================================================================
// lib/http.js - talks to the Express backend
// ============================================================================
// PLAIN ENGLISH: every request to our server goes through request(). It adds the
// login token (kept in the phone's SECURE storage, not the plain notebook) and
// turns server errors into normal JavaScript errors the screens can show.
import * as SecureStore from "expo-secure-store";
import { BACKEND_URL } from "./config";

const TOKEN_KEY = "pawscan_token";
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (t) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

// request("POST", "/auth/login", { email, password })
// For photo uploads pass { form } (a FormData) instead of a JSON body.
export async function request(method, path, body, { form, timeoutMs } = {}) {
  const headers = {};
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // fetch sets the multipart header itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  // Photo uploads may wake a sleeping AI service, so they get longer
  const limit = timeoutMs ?? (form ? 90000 : 30000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limit);

  let res;
  try {
    res = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/api${path}`, { method, headers, body: payload, signal: controller.signal });
  } catch (e) {
    throw new Error(
      e?.name === "AbortError"
        ? "The server is taking too long to respond. Please try again in a minute."
        : `Can't reach the server. Please check your connection. (${e?.message || "network error"})`
    );
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) await clearToken(); // expired token: force a fresh login
    const err = new Error(data.error || `Server error (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}
