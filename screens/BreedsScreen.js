// ============================================================================
// screens/BreedsScreen.js — THE BREED ENCYCLOPEDIA
// ============================================================================
// PLAIN ENGLISH: (PRD #13 browse, #10 breed page, #14 bookmark)
// This screen has TWO views, switched by the `selected` state:
//   selected === null    → the searchable LIST of all 120 breeds
//   selected === "beagle"→ the DETAIL page for that breed
//
// Breeds with a hand-written health entry get a "detailed health profile"
// tag; the rest show the general fallback advice on their detail page,
// with an honest note saying so.
// ============================================================================

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { BREEDS } from "../data/breeds";
import { getHealthEntry } from "../api";
import { getBookmarks, toggleBookmark } from "../lib/storage";
import { T, VetDisclaimer } from "../components/shared";

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export default function BreedsScreen() {
  const [query, setQuery] = useState("");           // the search box text
  const [bookmarks, setBookmarks] = useState([]);   // starred breed names
  const [selected, setSelected] = useState(null);   // which breed page is open
  const [showBookmarked, setShowBookmarked] = useState(false); // filter toggle

  // Load saved bookmarks when the screen appears
  useEffect(() => {
    getBookmarks().then(setBookmarks);
  }, []);

  // Star/unstar — storage returns the updated list, which we display
  const onToggleBookmark = async (breed) => {
    setBookmarks(await toggleBookmark(breed));
  };

  // ---------- View 2: a breed's detail page ----------
  if (selected) {
    return (
      <BreedDetail
        breed={selected}
        bookmarked={bookmarks.includes(selected)}
        onToggleBookmark={() => onToggleBookmark(selected)}
        onBack={() => setSelected(null)} // back = just clear the selection
      />
    );
  }

  // ---------- View 1: the searchable list ----------
  // Keep breeds that match the search text AND (if the filter is on) are starred
  const list = BREEDS.filter(
    (b) =>
      b.includes(query.toLowerCase()) && (!showBookmarked || bookmarks.includes(b))
  );

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.search}
        placeholder="Search 120 breeds…"
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
      />
      <TouchableOpacity
        style={styles.filterRow}
        onPress={() => setShowBookmarked(!showBookmarked)}
      >
        <Text style={styles.filterText}>
          {showBookmarked ? "★ Showing bookmarks only" : "☆ Show bookmarks only"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={list}
        keyExtractor={(b) => b}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const { coverage } = getHealthEntry(item); // detailed entry or generic?
          return (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.breedName}>{titleCase(item)}</Text>
                {coverage === "breed-specific" && (
                  <Text style={styles.detailedTag}>detailed health profile</Text>
                )}
              </View>
              {/* Tapping the star must NOT open the page — it's its own button */}
              <TouchableOpacity onPress={() => onToggleBookmark(item)} style={styles.star}>
                <Text style={styles.starText}>
                  {bookmarks.includes(item) ? "★" : "☆"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No breeds match "{query}".</Text>
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The detail page: profile → health predispositions → care tips → disclaimer.
// The disclaimer is mandatory here too — this page shows health content.
// ---------------------------------------------------------------------------
function BreedDetail({ breed, bookmarked, onToggleBookmark, onBack }) {
  const { entry, coverage } = getHealthEntry(breed);

  return (
    <ScrollView contentContainerStyle={styles.detailWrap}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← All breeds</Text>
      </TouchableOpacity>

      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>{titleCase(breed)}</Text>
        <TouchableOpacity onPress={onToggleBookmark}>
          <Text style={styles.starBig}>{bookmarked ? "★" : "☆"}</Text>
        </TouchableOpacity>
      </View>

      {/* Honesty note when we only have the generic fallback for this breed */}
      {coverage === "generic" && (
        <Text style={styles.genericNote}>
          Detailed health data for this breed is still being curated — showing
          general canine guidance.
        </Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PROFILE</Text>
        <Fact k="Size" v={entry.profile.size} />
        <Fact k="Lifespan" v={entry.profile.lifespan} />
        <Fact k="Temperament" v={entry.profile.temperament} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HEALTH PREDISPOSITIONS</Text>
        {entry.watchlist.map((h, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <Text style={styles.condition}>
              {h.condition} <Text style={styles.risk}>({h.risk} risk)</Text>
            </Text>
            <Text style={styles.detailText}>Early signs: {h.earlySigns}</Text>
            <Text style={styles.detailText}>Prevention: {h.prevention}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: T.mossDark }]}>
        <Text style={[styles.sectionTitle, { color: T.amber }]}>CARE TIPS</Text>
        {entry.careTips.map((t, i) => (
          <Text key={i} style={[styles.detailText, { color: T.paper }]}>
            • {t}
          </Text>
        ))}
      </View>

      <VetDisclaimer />
    </ScrollView>
  );
}

const Fact = ({ k, v }) => (
  <View style={{ marginBottom: 8 }}>
    <Text style={styles.factKey}>{k.toUpperCase()}</Text>
    <Text style={styles.detailText}>{v || "—"}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 18 },
  search: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: "#fff",
    color: T.ink,
  },
  filterRow: { paddingVertical: 10 },
  filterText: { color: T.moss, fontWeight: "600", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  breedName: { fontSize: 15, color: T.ink, fontWeight: "600" },
  detailedTag: { fontSize: 11, color: T.moss, marginTop: 2 },
  star: { paddingHorizontal: 6 },
  starText: { fontSize: 20, color: T.amber },
  emptyText: { textAlign: "center", color: T.ink, opacity: 0.6, marginTop: 30 },
  detailWrap: { padding: 18, paddingBottom: 48 },
  back: { color: T.moss, fontWeight: "700", marginBottom: 12, fontSize: 15 },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  detailTitle: { fontSize: 26, fontWeight: "800", color: T.ink, flex: 1 },
  starBig: { fontSize: 28, color: T.amber },
  genericNote: {
    fontSize: 13,
    color: T.ink,
    opacity: 0.65,
    marginBottom: 12,
    fontStyle: "italic",
  },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: T.moss,
    marginBottom: 10,
  },
  condition: { fontSize: 15, fontWeight: "600", color: T.ink },
  risk: { fontSize: 13, fontWeight: "400", color: T.ink, opacity: 0.7 },
  detailText: { fontSize: 13.5, color: T.ink, lineHeight: 19, marginTop: 2 },
  factKey: { fontSize: 10, letterSpacing: 1, color: T.ink, opacity: 0.55 },
});
