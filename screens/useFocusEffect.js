// ============================================================================
// screens/useFocusEffect.js — "RELOAD MY DATA WHEN I COME BACK TO THIS TAB"
// ============================================================================
// PLAIN ENGLISH — the problem this solves:
// You scan a dog (that saves a record), then tap the History tab. History
// must RE-READ its list at that moment, or it would show the old, stale list.
// Screens use this hook to say "run this loading code whenever the user
// arrives at me".
//
// The honest fine print: in OUR app, switching tabs destroys the old screen
// and builds the new one fresh, so "arriving" = "being built" — and React's
// normal useEffect (run once when built) is enough. That's all this file does.
//
// So why have this file at all? Future-proofing. If we later switch to the
// popular React Navigation library (which KEEPS screens alive in the
// background), plain useEffect stops firing on tab switches and the stale-
// data bug returns. React Navigation ships its own real useFocusEffect —
// and because our screens already call a hook by that name, fixing it then
// means changing ONE import line here, and zero changes in any screen.
// ============================================================================

import { useEffect } from "react";

export function useFocusEffect(callback) {
  useEffect(() => {
    callback();
    // The empty [] below means "run once, when this screen is built"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
