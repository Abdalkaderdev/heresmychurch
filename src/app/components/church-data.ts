// Types and constants for church map

import { STATE_BOUNDS, STATE_NAMES } from "./map-constants";

export interface Church {
  id: string;
  /** 8-digit id for URLs; unique per state */
  shortId?: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  attendance: number;
  denomination: string;
  address?: string;
  website?: string;
  // Extended fields (community-contributed or enriched)
  serviceTimes?: string;       // e.g. "Sunday 9am, 11am; Wednesday 7pm"
  languages?: string[];        // e.g. ["English", "Spanish"]
  ministries?: string[];       // e.g. ["Youth", "Music", "Outreach"]
  pastorName?: string;
  phone?: string;
  email?: string;
  /** When set, this church is a campus; value is the main church's id (e.g. "TX-12345"). */
  homeCampusId?: string;
  /** Resolved by API when homeCampusId points to another state: main campus summary for display/link. */
  homeCampus?: HomeCampusSummary;
  bilingualProbability?: number; // 0-1, estimated or user-confirmed
  lastVerified?: number; // timestamp of last correction or confirmation
  /** Building square footage from OSM polygon geometry; used as primary attendance estimate when available. */
  buildingSqft?: number;
}

/** Minimal church info for cross-state main campus link (from API). */
export interface HomeCampusSummary {
  id: string;
  name: string;
  state: string;
  shortId: string;
}

export interface StateInfo {
  abbrev: string;
  name: string;
  lat: number;
  lng: number;
  churchCount: number;
  isPopulated: boolean;
}

// ── Completeness tiers (tier 1 = critical for "needs review") ──

/** Tier 1: address, serviceTimes, denomination. "Needs review" when 2+ are missing. */
const TIER1_DENOM_EMPTY_VALUES = ["", "Unknown", "Other"];

function isDenominationMissing(denomination: string | undefined): boolean {
  return !denomination || TIER1_DENOM_EMPTY_VALUES.includes(denomination.trim());
}

/** Placeholder service-time values that don't count as "has service times". */
const TIER1_SERVICE_TIMES_EMPTY_VALUES = [
  "",
  "unknown",
  "other",
  "see website",
  "tbd",
  "n/a",
  "na",
  "pending",
  "to be determined",
];

function isServiceTimesMissing(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return TIER1_SERVICE_TIMES_EMPTY_VALUES.includes(normalized);
}

/** True if address is a real street-style address, not empty or only locality. */
function isAddressMeaningful(
  address: string | undefined,
  city: string,
  state: string
): boolean {
  if (!address || !address.trim()) return false;
  const a = address.trim();
  if (a.length < 5) return false;
  const cityNorm = (city || "").trim().toLowerCase();
  const stateNorm = (state || "").trim().toLowerCase();
  const aNorm = a.toLowerCase();
  if (cityNorm && aNorm === cityNorm) return false;
  const cityState = [cityNorm, stateNorm].filter(Boolean).join(", ");
  if (cityState && aNorm === cityState) return false;
  return true;
}

/** Diagonal (degrees) below which we skip quadrant and show only state name. */
const QUADRANT_MIN_DIAGONAL = 2;

/** Fraction of half-diagonal from state center; points within this are labeled "Central". */
const CENTRAL_RADIUS_FRACTION = 0.2;

function getQuadrantLabel(
  lat: number,
  lng: number,
  bounds: [number, number, number, number]
): string {
  const [south, west, north, east] = bounds;
  const midLat = (south + north) / 2;
  const midLng = (west + east) / 2;
  const ns = lat >= midLat ? "N" : "S";
  const ew = lng >= midLng ? "E" : "W";
  return `${ns}${ew}`;
}

/** True if (lat, lng) is within the "central" zone of the state (near geographic center). */
function isInCentralZone(
  lat: number,
  lng: number,
  bounds: [number, number, number, number],
  diagonal: number
): boolean {
  const [south, west, north, east] = bounds;
  const midLat = (south + north) / 2;
  const midLng = (west + east) / 2;
  const halfDiagonal = diagonal / 2;
  const radius = halfDiagonal * CENTRAL_RADIUS_FRACTION;
  const dist = Math.sqrt((lat - midLat) ** 2 + (lng - midLng) ** 2);
  return dist <= radius;
}

/**
 * Returns a fallback location string when a church has no complete address/city,
 * e.g. "Somewhere in Central Iowa" or "Somewhere in NW Iowa". Use when address and city are both missing or not meaningful.
 * Returns null if city is present (caller should use city as fallback) or state is unknown.
 */
export function getFallbackLocation(church: {
  lat: number;
  lng: number;
  state: string;
  city?: string;
}): string | null {
  if (church.city?.trim()) return null;
  const stateAbbrev = (church.state || "").trim().toUpperCase().slice(0, 2);
  if (!stateAbbrev) return null;
  const bounds = STATE_BOUNDS[stateAbbrev];
  const stateName = STATE_NAMES[stateAbbrev] || stateAbbrev;
  if (!bounds) return `Somewhere in ${stateName}`;
  const [south, west, north, east] = bounds;
  const latSpan = north - south;
  const lngSpan = east - west;
  const diagonal = Math.sqrt(latSpan * latSpan + lngSpan * lngSpan);
  if (diagonal < QUADRANT_MIN_DIAGONAL) return `Somewhere in ${stateName}`;
  if (isInCentralZone(church.lat, church.lng, bounds, diagonal)) {
    return `Somewhere in Central ${stateName}`;
  }
  const quadrant = getQuadrantLabel(church.lat, church.lng, bounds);
  return `Somewhere in ${quadrant} ${stateName}`;
}

/**
 * Format address for list/search display. When both address and city exist, returns "address, city";
 * otherwise returns address, city, or "".
 */
export function formatAddressWithCity(address?: string | null, city?: string | null): string {
  const a = (address || "").trim();
  const c = (city || "").trim();
  if (a && c) return `${a}, ${c}`;
  if (a) return a;
  if (c) return c;
  return "";
}

export interface Tier1Completeness {
  missingAddress: boolean;
  missingServiceTimes: boolean;
  missingDenomination: boolean;
  missingCount: number;
  needsReview: boolean;
}

/**
 * Returns tier-1 completeness for a church. "Needs review" when 2+ of
 * address, service times, denomination are missing (denom treated as missing if Unknown/Other).
 */
export function getTier1Completeness(church: Church): Tier1Completeness {
  const missingAddress = !isAddressMeaningful(church.address, church.city, church.state);
  const missingServiceTimes = isServiceTimesMissing(church.serviceTimes);
  const missingDenomination = isDenominationMissing(church.denomination);
  const missingCount = [missingAddress, missingServiceTimes, missingDenomination].filter(Boolean).length;
  return {
    missingAddress,
    missingServiceTimes,
    missingDenomination,
    missingCount,
    needsReview: missingCount >= 2,
  };
}

/** True if church should appear in "need review" list (missing 2+ of address, service times, denomination). */
export function churchNeedsReview(church: Church): boolean {
  return getTier1Completeness(church).needsReview;
}

export type SizeCategory =
  | "< 50"
  | "50–250"
  | "250–500"
  | "500–1,000"
  | "1,000–5,000"
  | "5,000+";

export const sizeCategories: {
  label: SizeCategory;
  min: number;
  max: number;
  radius: number;
  color: string;
}[] = [
  { label: "< 50", min: 0, max: 49, radius: 2.5, color: "#E8D5F5" },
  { label: "50–250", min: 50, max: 250, radius: 4, color: "#C9A0DC" },
  { label: "250–500", min: 251, max: 500, radius: 6, color: "#A855F7" },
  { label: "500–1,000", min: 501, max: 1000, radius: 8, color: "#8B2FC9" },
  { label: "1,000–5,000", min: 1001, max: 5000, radius: 11, color: "#6B21A8" },
  { label: "5,000+", min: 5001, max: Infinity, radius: 15, color: "#4C1D95" },
];

export function getSizeCategory(attendance: number) {
  return (
    sizeCategories.find((c) => attendance >= c.min && attendance <= c.max) ||
    sizeCategories[0]
  );
}

// Major denomination groups for filtering (order matters: first match wins)
// Middle East Christian traditions
export const DENOMINATION_GROUPS: { label: string; matches: string[] }[] = [
  // Orthodox (largest Christian presence in Middle East)
  { label: "Coptic Orthodox", matches: ["Coptic Orthodox"] },
  { label: "Greek Orthodox", matches: ["Greek Orthodox", "Rum Orthodox"] },
  { label: "Armenian Apostolic", matches: ["Armenian Apostolic", "Armenian Orthodox"] },
  { label: "Syriac Orthodox", matches: ["Syriac Orthodox", "Syrian Orthodox"] },
  { label: "Other Orthodox", matches: ["Orthodox", "Antiochian", "Ethiopian Orthodox", "Eritrean Orthodox"] },
  // Eastern Catholic (in communion with Rome)
  { label: "Maronite", matches: ["Maronite"] },
  { label: "Melkite", matches: ["Melkite"] },
  { label: "Chaldean", matches: ["Chaldean"] },
  { label: "Eastern Catholic", matches: ["Coptic Catholic", "Armenian Catholic", "Syriac Catholic", "Syrian Catholic"] },
  // Latin Catholic
  { label: "Catholic", matches: ["Catholic", "Roman Catholic", "Latin Catholic"] },
  // Assyrian Church of the East
  { label: "Assyrian", matches: ["Assyrian", "Church of the East"] },
  // Protestant
  { label: "Anglican", matches: ["Anglican", "Episcopal", "Church of England"] },
  { label: "Lutheran", matches: ["Lutheran"] },
  { label: "Presbyterian", matches: ["Presbyterian"] },
  { label: "Methodist", matches: ["Methodist", "Wesleyan"] },
  { label: "Baptist", matches: ["Baptist"] },
  // Evangelical/Pentecostal
  { label: "Assemblies of God", matches: ["Assemblies of God", "Assembly of God"] },
  { label: "Pentecostal", matches: ["Pentecostal", "Foursquare", "Full Gospel"] },
  { label: "Evangelical", matches: ["Evangelical", "Bible Church"] },
  // Other
  { label: "Seventh-day Adventist", matches: ["Seventh-day Adventist", "Adventist", "SDA"] },
  { label: "Salvation Army", matches: ["Salvation Army"] },
  { label: "Non-denominational", matches: ["Non-denominational", "Nondenominational", "Community Church", "International Church", "Fellowship", "Independent"] },
  { label: "Unspecified", matches: ["Other", "Unknown"] }, // catch-all
];

export function getDenominationGroup(denomination: string): string {
  for (const group of DENOMINATION_GROUPS) {
    if (group.matches.some((m) => denomination.includes(m))) {
      return group.label;
    }
  }
  return "Unspecified";
}

// ── Multilingual probability estimation ──
// Heuristic estimation until community-confirmed via languages field

// Country-level expat/multilingual probability (estimate)
// Gulf states have high expat populations; Lebanon/Egypt/Syria have multiple native Christian communities
const COUNTRY_MULTILINGUAL_SHARE: Record<string, number> = {
  AE: 0.85, QA: 0.80, KW: 0.75, BH: 0.70, OM: 0.65, SA: 0.50, // Gulf expat communities
  LB: 0.60, // Arabic + French + Armenian + other
  EG: 0.30, SY: 0.30, IQ: 0.40, JO: 0.35, // Mixed Arab Christian communities
  TR: 0.20, PS: 0.25, // Smaller multilingual presence
  LY: 0.15, TN: 0.15, DZ: 0.20, MA: 0.25, MR: 0.10, // North Africa
  SD: 0.20, YE: 0.15, DJ: 0.30, KM: 0.10, SO: 0.15, // East Africa/Arabian Peninsula
};

// Name patterns that indicate specific language services
const BILINGUAL_NAME_PATTERNS = [
  // Arabic
  { pattern: /\bكنيسة|كنيست|مسيحي\b/i, lang: "Arabic", weight: 0.95 },
  { pattern: /\barabic\b/i, lang: "Arabic", weight: 0.9 },
  // Armenian
  { pattern: /armenian|armén|հdelays/i, lang: "Armenian", weight: 0.95 },
  // Syriac/Aramaic
  { pattern: /\bsyriac|aramaic|ܥܕܬܐ\b/i, lang: "Syriac", weight: 0.95 },
  // Coptic
  { pattern: /\bcoptic|قبطي\b/i, lang: "Coptic/Arabic", weight: 0.9 },
  // Filipino (large expat community in Gulf)
  { pattern: /\bfilipino|tagalog|pinoy\b/i, lang: "Tagalog", weight: 0.9 },
  // Malayalam (Kerala Christian community in Gulf)
  { pattern: /\bmalayalam|kerala|marthoma\b/i, lang: "Malayalam", weight: 0.9 },
  // French (North Africa, Lebanon)
  { pattern: /\bfrench|français|francophone\b/i, lang: "French", weight: 0.85 },
  { pattern: /\béglise\b/i, lang: "French", weight: 0.9 },
  // English expat churches
  { pattern: /\binternational|expat|fellowship\b/i, lang: "English", weight: 0.7 },
  // Ethiopian/Eritrean
  { pattern: /\bethiopian|eritrean|amharic|tigrinya\b/i, lang: "Amharic", weight: 0.9 },
  // Turkish
  { pattern: /\bturkish|türk\b/i, lang: "Turkish", weight: 0.85 },
  // Korean expat
  { pattern: /한인|한국|교회/i, lang: "Korean", weight: 0.95 },
  { pattern: /\bkorean\b/i, lang: "Korean", weight: 0.9 },
  // Chinese expat
  { pattern: /中[华文国]|華人|教會/i, lang: "Chinese", weight: 0.95 },
  { pattern: /\bchinese\b/i, lang: "Chinese", weight: 0.9 },
];

export function estimateBilingualProbability(church: Church): { probability: number; detectedLanguage?: string; confirmed: boolean } {
  // If languages field is set by community, use it as confirmed
  if (church.languages && church.languages.length > 0) {
    return {
      probability: church.languages.length >= 2 ? 1.0 : 0.05,
      detectedLanguage: church.languages.length >= 2 ? church.languages.find(l => l !== "English") || church.languages[0] : undefined,
      confirmed: true,
    };
  }

  // If bilingualProbability is already set (e.g. from community correction), use it
  if (church.bilingualProbability !== undefined && church.bilingualProbability !== null) {
    return { probability: church.bilingualProbability, confirmed: true };
  }

  let maxProb = 0;
  let detectedLang: string | undefined;

  // Check name patterns
  for (const { pattern, lang, weight } of BILINGUAL_NAME_PATTERNS) {
    if (pattern.test(church.name)) {
      if (weight > maxProb) {
        maxProb = weight;
        detectedLang = lang;
      }
    }
  }

  if (maxProb > 0) {
    return { probability: maxProb, detectedLanguage: detectedLang, confirmed: false };
  }

  // Country + denomination heuristic for Middle East
  const multilingualShare = COUNTRY_MULTILINGUAL_SHARE[church.state] || 0.15;

  // Orthodox churches in Arab countries often have Arabic services
  if (church.denomination?.includes("Orthodox") && multilingualShare > 0.2) {
    return { probability: Math.min(multilingualShare * 1.2, 0.8), detectedLanguage: "Arabic", confirmed: false };
  }

  // Expat churches in Gulf states often have English + Filipino/Malayalam
  if (church.denomination === "Non-denominational" && ["AE", "QA", "KW", "BH", "OM", "SA"].includes(church.state)) {
    return { probability: 0.6, detectedLanguage: "English", confirmed: false };
  }

  // Base probability for any church in a multilingual country
  if (multilingualShare > 0.3) {
    return { probability: multilingualShare * 0.3, confirmed: false };
  }

  return { probability: 0, confirmed: false };
}

// Common language options for form UI (Middle East region)
export const COMMON_LANGUAGES = [
  "Arabic", "English", "French", "Armenian", "Syriac", "Coptic",
  "Turkish", "Tagalog", "Malayalam", "Hindi", "Urdu",
  "Amharic", "Tigrinya", "Korean", "Chinese (Mandarin)",
  "Russian", "Greek", "Persian (Farsi)", "Other",
];

// Common ministry categories for form UI
export const COMMON_MINISTRIES = [
  "Youth", "Children's", "Young Adults", "Women's", "Men's",
  "Worship / Music", "Small Groups", "Outreach / Missions",
  "Food Pantry", "Recovery / Support Groups", "Senior Adults",
  "Marriage & Family", "Counseling", "Prayer", "Discipleship",
  "Sports", "Media / Production", "Hospitality",
];