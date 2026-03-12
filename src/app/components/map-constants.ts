// Bible-themed sayings about waiting, shown during loading
export const WAITING_SAYINGS = [
  { text: "But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles.", ref: "Isaiah 40:31" },
  { text: "Be still, and know that I am God.", ref: "Psalm 46:10" },
  { text: "Wait for the Lord; be strong, and let your heart take courage; wait for the Lord!", ref: "Psalm 27:14" },
  { text: "The Lord is good to those who wait for him, to the soul who seeks him.", ref: "Lamentations 3:25" },
  { text: "For the vision awaits its appointed time... though it linger, wait for it; it will certainly come.", ref: "Habakkuk 2:3" },
  { text: "I waited patiently for the Lord; he inclined to me and heard my cry.", ref: "Psalm 40:1" },
  { text: "Be patient, then, brothers and sisters, until the Lord's coming. See how the farmer waits for the precious fruit of the earth.", ref: "James 5:7" },
  { text: "Rest in the Lord, and wait patiently for him.", ref: "Psalm 37:7" },
  { text: "Abraham waited patiently, and so received what was promised.", ref: "Hebrews 6:15" },
  { text: "For since the beginning of the world men have not heard, nor perceived by the ear... what he hath prepared for him that waiteth for him.", ref: "Isaiah 64:4" },
  { text: "My soul waits for the Lord more than watchmen wait for the morning.", ref: "Psalm 130:6" },
  { text: "In the morning, Lord, you hear my voice; in the morning I lay my requests before you and wait expectantly.", ref: "Psalm 5:3" },
  { text: "Noah waited 40 days after the rain stopped before opening the window of the ark.", ref: "Genesis 8:6" },
  { text: "The Israelites waited 40 years in the wilderness before entering the Promised Land.", ref: "Deuteronomy 8:2" },
  { text: "Simeon waited his whole life to see the Messiah -- and his patience was rewarded in the temple.", ref: "Luke 2:25-26" },
  { text: "Joseph waited years in prison, but God's timing led him to the palace.", ref: "Genesis 41:14" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.", ref: "Jeremiah 29:11" },
  { text: "He has made everything beautiful in its time.", ref: "Ecclesiastes 3:11" },
  { text: "The disciples waited in the upper room for ten days before the Holy Spirit came at Pentecost.", ref: "Acts 1:4-5" },
  { text: "David was anointed king as a teenager but waited roughly 15 years before taking the throne.", ref: "1 Samuel 16:13" },
];

// Map ISO 3166-1 numeric codes to country codes (ISO 3166-1 alpha-2) for click detection
// Using numeric codes from Natural Earth / world-atlas TopoJSON
export const COUNTRY_CODE_TO_ABBREV: Record<string, string> = {
  "682": "SA",  // Saudi Arabia
  "784": "AE",  // United Arab Emirates
  "634": "QA",  // Qatar
  "414": "KW",  // Kuwait
  "048": "BH",  // Bahrain
  "512": "OM",  // Oman
  "400": "JO",  // Jordan
  "422": "LB",  // Lebanon
  "760": "SY",  // Syria
  "368": "IQ",  // Iraq
  "818": "EG",  // Egypt
  "434": "LY",  // Libya
  "788": "TN",  // Tunisia
  "012": "DZ",  // Algeria
  "504": "MA",  // Morocco
  "478": "MR",  // Mauritania
  "736": "SD",  // Sudan (old code)
  "729": "SD",  // Sudan (new code)
  "887": "YE",  // Yemen
  "262": "DJ",  // Djibouti
  "174": "KM",  // Comoros
  "706": "SO",  // Somalia
  "275": "PS",  // Palestine
  "792": "TR",  // Turkey
};

// Reverse lookup: country abbreviation -> numeric code
export const ABBREV_TO_COUNTRY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_CODE_TO_ABBREV).map(([code, abbrev]) => [abbrev, code])
);

// Legacy aliases for compatibility (code references FIPS_TO_STATE)
export const FIPS_TO_STATE = COUNTRY_CODE_TO_ABBREV;
export const STATE_TO_FIPS = ABBREV_TO_COUNTRY_CODE;

// Approximate bounding boxes for Middle East countries [south, west, north, east]
export const COUNTRY_BOUNDS: Record<string, [number, number, number, number]> = {
  SA: [16.38, 34.50, 32.16, 55.67],  // Saudi Arabia
  AE: [22.63, 51.50, 26.08, 56.38],  // United Arab Emirates
  QA: [24.47, 50.75, 26.15, 51.64],  // Qatar
  KW: [28.52, 46.55, 30.10, 48.43],  // Kuwait
  BH: [25.79, 50.45, 26.29, 50.82],  // Bahrain
  OM: [16.65, 52.00, 26.39, 59.84],  // Oman
  JO: [29.19, 34.96, 33.37, 39.30],  // Jordan
  LB: [33.06, 35.10, 34.69, 36.62],  // Lebanon
  SY: [32.31, 35.73, 37.32, 42.38],  // Syria
  IQ: [29.06, 38.79, 37.38, 48.57],  // Iraq
  EG: [22.00, 24.70, 31.67, 36.90],  // Egypt
  LY: [19.50, 9.39, 33.17, 25.15],   // Libya
  TN: [30.23, 7.52, 37.54, 11.60],   // Tunisia
  DZ: [18.97, -8.67, 37.09, 11.98],  // Algeria
  MA: [27.67, -13.17, 35.92, -0.99], // Morocco
  MR: [14.72, -17.07, 27.30, -4.83], // Mauritania
  SD: [8.68, 21.84, 22.23, 38.58],   // Sudan
  YE: [12.11, 42.55, 19.00, 54.53],  // Yemen
  DJ: [10.94, 41.77, 12.71, 43.42],  // Djibouti
  KM: [-12.42, 43.23, -11.36, 44.54], // Comoros
  SO: [-1.66, 40.99, 11.98, 51.41],  // Somalia
  PS: [31.22, 34.22, 32.55, 35.57],  // Palestine
  TR: [35.82, 25.67, 42.11, 44.82],  // Turkey
};

// Legacy alias for compatibility
export const STATE_BOUNDS = COUNTRY_BOUNDS;

// Full country name lookup
export const COUNTRY_NAMES: Record<string, string> = {
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  JO: "Jordan",
  LB: "Lebanon",
  SY: "Syria",
  IQ: "Iraq",
  EG: "Egypt",
  LY: "Libya",
  TN: "Tunisia",
  DZ: "Algeria",
  MA: "Morocco",
  MR: "Mauritania",
  SD: "Sudan",
  YE: "Yemen",
  DJ: "Djibouti",
  KM: "Comoros",
  SO: "Somalia",
  PS: "Palestine",
  TR: "Turkey",
};

// Legacy alias for compatibility
export const STATE_NAMES = COUNTRY_NAMES;

/** Neighboring country abbreviations (geographic adjacency). Used to prioritize main-campus search. */
export const COUNTRY_NEIGHBORS: Record<string, string[]> = {
  SA: ["AE", "OM", "YE", "JO", "IQ", "KW", "QA", "BH"],
  AE: ["SA", "OM"],
  QA: ["SA", "BH"],
  KW: ["SA", "IQ"],
  BH: ["SA", "QA"],
  OM: ["SA", "AE", "YE"],
  JO: ["SA", "IQ", "SY", "PS"],
  LB: ["SY", "PS"],
  SY: ["TR", "IQ", "JO", "LB", "PS"],
  IQ: ["TR", "SY", "JO", "SA", "KW"],
  EG: ["LY", "SD", "PS"],
  LY: ["EG", "TN", "DZ", "SD"],
  TN: ["LY", "DZ"],
  DZ: ["TN", "LY", "MA", "MR"],
  MA: ["DZ", "MR"],
  MR: ["MA", "DZ"],
  SD: ["EG", "LY"],
  YE: ["SA", "OM"],
  DJ: ["SO"],
  KM: [],
  SO: ["DJ"],
  PS: ["JO", "EG", "LB", "SY"],
  TR: ["SY", "IQ"],
};

// Legacy alias for compatibility
export const STATE_NEIGHBORS = COUNTRY_NEIGHBORS;

// TopoJSON source for world countries
export const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// County equivalent not applicable for Middle East - keep undefined
export const COUNTIES_GEO_URL = "";

// "You are here" pin for selected church in church view (matches "All countries" button purple)
export const ACTIVE_PIN_FILL = "#6B21A8";

// Church count tiers for country shading in regional view
export const COUNTRY_COUNT_TIERS = [
  { label: "Not yet explored", min: 0, max: 0, color: "#E8D5F5" },
  { label: "< 100", min: 1, max: 99, color: "#C9A0DC" },
  { label: "100-500", min: 100, max: 499, color: "#B07CD0" },
  { label: "500-1,000", min: 500, max: 999, color: "#9B59C4" },
  { label: "1,000-2,000", min: 1000, max: 1999, color: "#8338B8" },
  { label: "2,000-5,000", min: 2000, max: 4999, color: "#6B21A8" },
  { label: "5,000+", min: 5000, max: Infinity, color: "#4C1D95" },
];

// Legacy alias for compatibility
export const STATE_COUNT_TIERS = COUNTRY_COUNT_TIERS;

// County choropleth not used for Middle East
export const COUNTY_PER_CAPITA_COLORS = [
  "#FFFFFF",
  "#F8F4FC",
  "#F0E8F8",
  "#E8DCF4",
  "#E4D4F0",
  "#E0CCEC",
  "#EDE4F3",
];

// Filter churches to country bounding box (handles stale cached data that wasn't bbox-filtered)
export function filterToCountryBounds(churches: { lat: number; lng: number }[], countryAbbrev: string) {
  const bounds = COUNTRY_BOUNDS[countryAbbrev.toUpperCase()];
  if (!bounds) return churches;
  const [south, west, north, east] = bounds;
  const margin = 0.01;
  return churches.filter(
    (ch) =>
      ch.lat >= south - margin &&
      ch.lat <= north + margin &&
      ch.lng >= west - margin &&
      ch.lng <= east + margin
  );
}

// Legacy alias for compatibility
export const filterToStateBounds = filterToCountryBounds;

export function getCountryTier(count: number) {
  if (count <= 0) return COUNTRY_COUNT_TIERS[0];
  return COUNTRY_COUNT_TIERS.find((t) => count >= t.min && count <= t.max) || COUNTRY_COUNT_TIERS[COUNTRY_COUNT_TIERS.length - 1];
}

// Legacy alias for compatibility
export const getStateTier = getCountryTier;

/** Returns choropleth color for county by per-capita rank (0 = lowest, 1 = highest). */
export function getCountyPerCapitaColor(perCapita: number, sortedByPerCapita: { perCapita: number }[]): string {
  if (sortedByPerCapita.length === 0 || perCapita <= 0) return COUNTY_PER_CAPITA_COLORS[0];
  const sorted = [...sortedByPerCapita].sort((a, b) => a.perCapita - b.perCapita);
  const idx = sorted.findIndex((c) => c.perCapita >= perCapita);
  const rank = idx === -1 ? 1 : idx / sorted.length;
  const tier = Math.min(
    COUNTY_PER_CAPITA_COLORS.length - 1,
    Math.floor(rank * COUNTY_PER_CAPITA_COLORS.length)
  );
  return COUNTY_PER_CAPITA_COLORS[tier];
}

// Compute a zoom level that makes the country fill more of the viewport.
// Uses the bounding-box diagonal relative to a reference.
const REFERENCE_DIAGONAL = 15; // approx Saudi Arabia bbox diagonal in degrees
const REFERENCE_ZOOM = 4;      // desired zoom for Saudi-sized countries
const MIN_COUNTRY_ZOOM = 3;
const MAX_COUNTRY_ZOOM = 12;

export function getCountryZoom(abbrev: string): number {
  const upper = abbrev.toUpperCase();
  const bounds = COUNTRY_BOUNDS[upper];
  if (!bounds) return REFERENCE_ZOOM;
  const [south, west, north, east] = bounds;
  const latSpan = north - south;
  const lngSpan = east - west;
  const diagonal = Math.sqrt(latSpan * latSpan + lngSpan * lngSpan);
  if (diagonal <= 0) return REFERENCE_ZOOM;
  const zoom = REFERENCE_ZOOM * (REFERENCE_DIAGONAL / diagonal);
  return Math.min(MAX_COUNTRY_ZOOM, Math.max(MIN_COUNTRY_ZOOM, Math.round(zoom * 10) / 10));
}

// Legacy alias for compatibility
export const getStateZoom = getCountryZoom;

// Middle East region: list of all target country codes
export const MIDDLE_EAST_COUNTRIES = [
  "SA", "AE", "QA", "KW", "BH", "OM", "JO", "LB", "SY", "IQ",
  "EG", "LY", "TN", "DZ", "MA", "MR", "SD", "YE", "DJ", "KM",
  "SO", "PS", "TR"
];
