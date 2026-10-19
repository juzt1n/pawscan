// ============================================================================
// lib/config.js - the two settings that decide where the app gets its data
// ============================================================================
// USE_MOCK = true   -> everything stays on the phone (fake AI, AsyncStorage).
//                      Good for UI work and demos with no internet.
// USE_MOCK = false  -> the real system: Express backend + MongoDB + AI service.
//                      Set BACKEND_URL first.
// Leave this true until the backend is deployed and BACKEND_URL below is set,
// otherwise login and every other call will fail.
export const USE_MOCK = false;

// Where the Express backend lives.
//   Local testing:  "http://192.168.x.x:3001"  (your laptop's Wi-Fi address, NOT localhost)
//   After deploy:   "https://your-app.onrender.com"
//export const BACKEND_URL = "https://pawscan-pred.onrender.com";
export const BACKEND_URL = "http://192.168.4.20:3001";
