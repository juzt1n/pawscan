// ============================================================================
// lib/storage.js - the "one door" the screens use (unchanged import path)
// ============================================================================
// USE_MOCK = true  -> storageLocal.js (AsyncStorage on the phone, no server needed)
// USE_MOCK = false -> storageRemote.js (Express + MongoDB)
// The choice is made at CALL time, so import order can never pick the wrong one.
import { USE_MOCK } from "./config";
import * as local from "./storageLocal";
import * as remote from "./storageRemote";

export { DEMO_ADMIN_EMAIL, FREE_DAILY_QUOTA, persistImage, hasSeenOnboarding, markOnboardingSeen } from "./storageLocal";

const impl = () => (USE_MOCK ? local : remote);
const fwd = (name) => (...args) => impl()[name](...args);

export const getSession = fwd("getSession");
export const login = fwd("login");
export const logout = fwd("logout");
export const upgradeToPremium = fwd("upgradeToPremium");
export const updateProfile = fwd("updateProfile");
export const refreshSessionStatus = fwd("refreshSessionStatus");

export const getQuota = fwd("getQuota");
export const remainingScans = fwd("remainingScans");
export const consumeScan = fwd("consumeScan");
export const grantAdBonusScan = fwd("grantAdBonusScan");

export const getHistory = fwd("getHistory");
export const addScan = fwd("addScan");
export const deleteScan = fwd("deleteScan");
export const getBookmarks = fwd("getBookmarks");
export const toggleBookmark = fwd("toggleBookmark");
export const getDogs = fwd("getDogs");
export const addDog = fwd("addDog");
export const exportHistoryCSV = fwd("exportHistoryCSV");
export const exportVetReportPDF = fwd("exportVetReportPDF");

export const getBusinesses = fwd("getBusinesses");
export const getMyBusiness = fwd("getMyBusiness");
export const registerBusiness = fwd("registerBusiness");
export const reviewBusinessApplication = fwd("reviewBusinessApplication");
export const suspendBusiness = fwd("suspendBusiness");
export const updateBusinessListing = fwd("updateBusinessListing");
export const getNearbyClinics = fwd("getNearbyClinics");
export const logClinicEvent = fwd("logClinicEvent");
export const getBusinessStats = fwd("getBusinessStats");
export const requestPasswordReset = fwd("requestPasswordReset");

export const getUsers = fwd("getUsers");
export const setUserStatus = fwd("setUserStatus");
export const getAnalytics = fwd("getAnalytics");
export const getAuditLog = fwd("getAuditLog");
export const addAuditEntry = fwd("addAuditEntry");
