import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import {
  sizeCategories,
  getSizeCategory,
  DENOMINATION_GROUPS,
  getDenominationGroup,
} from "./church-data";
import type { Church, StateInfo } from "./church-data";
import {
  fetchStates,
  fetchChurches,
  populateState,
  fetchStatePopulations,
} from "./api";
import { ChurchListModal } from "./ChurchListModal";
import { MapSearchBar } from "./MapSearchBar";
import { ChurchDetailPanel } from "./ChurchDetailPanel";
import { ChurchDots } from "./ChurchDots";
import { AddChurchForm } from "./AddChurchForm";
import { motion, AnimatePresence } from "motion/react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  X,
  Church as ChurchIcon,
  ArrowLeft,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  Building2,
  Search,
  TrendingUp,
  BookOpen,
  BarChart3,
  MapPin,
  type LucideIcon,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const COUNTIES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

// Route props passed from ChurchMapPage
interface ChurchMapProps {
  routeStateAbbrev: string | null;
  routeChurchId: string | null;
  navigateToState: (abbrev: string) => void;
  navigateToChurch: (stateAbbrev: string, churchId: string) => void;
  navigateToNational: () => void;
  navigateBack: () => void;
}

// Icon map for interesting facts
type InterestingFact = { icon: string; label: string; primary: string; secondary: string; abbrev?: string };

const FACT_ICONS: Record<string, LucideIcon> = {
  users: Users,
  building: Building2,
  search: Search,
  trending: TrendingUp,
  book: BookOpen,
  chart: BarChart3,
  mapPin: MapPin,
};

// Bible-themed sayings about waiting, shown during loading
const WAITING_SAYINGS = [
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
  { text: "Simeon waited his whole life to see the Messiah — and his patience was rewarded in the temple.", ref: "Luke 2:25-26" },
  { text: "Joseph waited years in prison, but God's timing led him to the palace.", ref: "Genesis 41:14" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.", ref: "Jeremiah 29:11" },
  { text: "He has made everything beautiful in its time.", ref: "Ecclesiastes 3:11" },
  { text: "The disciples waited in the upper room for ten days before the Holy Spirit came at Pentecost.", ref: "Acts 1:4-5" },
  { text: "David was anointed king as a teenager but waited roughly 15 years before taking the throne.", ref: "1 Samuel 16:13" },
];

// Map FIPS IDs to state abbreviations for click detection
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "MD", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

// Reverse lookup: state abbreviation → FIPS code (for county filtering)
const STATE_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(FIPS_TO_STATE).map(([fips, abbrev]) => [abbrev, fips])
);

// Church count tiers for state shading in national view
const STATE_COUNT_TIERS = [
  { label: "Not yet explored", min: 0, max: 0, color: "#E8D5F5" },
  { label: "< 500", min: 1, max: 499, color: "#C9A0DC" },
  { label: "500–1,500", min: 500, max: 1499, color: "#B07CD0" },
  { label: "1,500–3,000", min: 1500, max: 2999, color: "#9B59C4" },
  { label: "3,000–5,000", min: 3000, max: 4999, color: "#8338B8" },
  { label: "5,000–10,000", min: 5000, max: 9999, color: "#6B21A8" },
  { label: "10,000+", min: 10000, max: Infinity, color: "#4C1D95" },
];

function getStateTier(count: number) {
  if (count <= 0) return STATE_COUNT_TIERS[0];
  return STATE_COUNT_TIERS.find((t) => count >= t.min && count <= t.max) || STATE_COUNT_TIERS[STATE_COUNT_TIERS.length - 1];
}

// Approximate bounding boxes for US states [south, west, north, east]
// Used to filter out churches with coordinates outside state boundaries
const STATE_BOUNDS: Record<string, [number, number, number, number]> = {
  AL: [30.22, -88.47, 35.01, -84.89], AK: [51.21, -179.15, 71.39, -129.98],
  AZ: [31.33, -114.81, 37.00, -109.04], AR: [33.00, -94.62, 36.50, -89.64],
  CA: [32.53, -124.41, 42.01, -114.13], CO: [36.99, -109.06, 41.00, -102.04],
  CT: [40.95, -73.73, 42.05, -71.79], DE: [38.45, -75.79, 39.84, -75.05],
  FL: [24.40, -87.63, 31.00, -79.97], GA: [30.36, -85.61, 35.00, -80.84],
  HI: [18.91, -160.24, 22.24, -154.81], ID: [42.00, -117.24, 49.00, -111.04],
  IL: [36.97, -91.51, 42.51, -87.02], IN: [37.77, -88.10, 41.76, -84.78],
  IA: [40.38, -96.64, 43.50, -90.14], KS: [36.99, -102.05, 40.00, -94.59],
  KY: [36.50, -89.57, 39.15, -81.96], LA: [28.93, -94.04, 33.02, -88.82],
  ME: [42.98, -71.08, 47.46, -66.95], MD: [37.91, -79.49, 39.72, -75.05],
  MA: [41.24, -73.50, 42.89, -69.93], MI: [41.70, -90.42, 48.31, -82.12],
  MN: [43.50, -97.24, 49.38, -89.49], MS: [30.17, -91.66, 34.99, -88.10],
  MO: [35.99, -95.77, 40.61, -89.10], MT: [44.36, -116.05, 49.00, -104.04],
  NE: [39.99, -104.05, 43.00, -95.31], NV: [35.00, -120.01, 42.00, -114.04],
  NH: [42.70, -72.56, 45.31, -70.70], NJ: [38.93, -75.56, 41.36, -73.89],
  NM: [31.33, -109.05, 37.00, -103.00], NY: [40.50, -79.76, 45.02, -71.86],
  NC: [33.84, -84.32, 36.59, -75.46], ND: [45.94, -104.05, 49.00, -96.55],
  OH: [38.40, -84.82, 42.33, -80.52], OK: [33.62, -103.00, 37.00, -94.43],
  OR: [41.99, -124.57, 46.29, -116.46], PA: [39.72, -80.52, 42.27, -74.69],
  RI: [41.15, -71.86, 42.02, -71.12], SC: [32.03, -83.35, 35.22, -78.54],
  SD: [42.48, -104.06, 45.95, -96.44], TN: [34.98, -90.31, 36.68, -81.65],
  TX: [25.84, -106.65, 36.50, -93.51], UT: [36.99, -114.05, 42.00, -109.04],
  VT: [42.73, -73.44, 45.02, -71.46], VA: [36.54, -83.68, 39.47, -75.24],
  WA: [45.54, -124.85, 49.00, -116.92], WV: [37.20, -82.64, 40.64, -77.72],
  WI: [42.49, -92.89, 47.08, -86.25], WY: [40.99, -111.06, 45.01, -104.05],
  DC: [38.79, -77.12, 38.99, -76.91],
};

// Filter churches to state bounding box (handles stale cached data that wasn't bbox-filtered)
function filterToStateBounds(churches: Church[], stateAbbrev: string): Church[] {
  const bounds = STATE_BOUNDS[stateAbbrev.toUpperCase()];
  if (!bounds) return churches;
  const [south, west, north, east] = bounds;
  const margin = 0.01; // ~1km margin for border churches
  return churches.filter(
    (ch) =>
      ch.lat >= south - margin &&
      ch.lat <= north + margin &&
      ch.lng >= west - margin &&
      ch.lng <= east + margin
  );
}

export function ChurchMap({
  routeStateAbbrev,
  routeChurchId,
  navigateToState,
  navigateToChurch,
  navigateToNational,
  navigateBack,
}: ChurchMapProps) {
  // Map state
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([-96, 38]);

  // Data state
  const [states, setStates] = useState<StateInfo[]>([]);
  const [totalChurches, setTotalChurches] = useState(0);
  const [focusedState, setFocusedState] = useState<string | null>(null);
  const [focusedStateName, setFocusedStateName] = useState<string>("");
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to avoid stale closures in async loadStateData
  const focusedStateRef = useRef<string | null>(null);
  const loadVersionRef = useRef(0);
  useEffect(() => { focusedStateRef.current = focusedState; }, [focusedState]);

  // Derived: are all states populated?
  const allStatesLoaded = useMemo(() => states.length > 0 && states.every((s) => s.isPopulated), [states]);

  // Tooltip
  const [hoveredChurch, setHoveredChurch] = useState<Church | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Filters
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeSize, setActiveSize] = useState<Set<string>>(
    new Set(sizeCategories.map((c) => c.label))
  );
  const [activeDenominations, setActiveDenominations] = useState<Set<string>>(
    new Set(DENOMINATION_GROUPS.map((g) => g.label))
  );
  const [showSizeFilters, setShowSizeFilters] = useState(true);
  const [showDenomFilters, setShowDenomFilters] = useState(true);

  // Church list modal
  const [showListModal, setShowListModal] = useState(false);

  // Selected church for detail panel
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);

  // Preloaded church — when navigating from search/modal to a church in a different state,
  // store the church data here so we can show it instantly without the loading overlay.
  // The rest of the state's churches load silently in the background.
  const preloadedChurchRef = useRef<Church | null>(null);

  // Pending state transition — deferred until loading overlay (verse cycling) is done
  const [loadingStateName, setLoadingStateName] = useState("");
  const pendingTransitionRef = useRef<{
    abbrev: string;
    name: string;
    lat: number;
    lng: number;
    churches: Church[];
  } | null>(null);

  // Add church form (from disclaimer link)
  const [showAddChurchFromSummary, setShowAddChurchFromSummary] = useState(false);

  // Summary dropdown
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Close summary dropdown when clicking outside
  useEffect(() => {
    if (!showSummary) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (summaryRef.current && !summaryRef.current.contains(e.target as Node)) {
        setShowSummary(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSummary]);

  // Close summary when navigating
  useEffect(() => {
    setShowSummary(false);
  }, [focusedState]);

  // State populations (from datausa.io / Census API)
  const [statePopulations, setStatePopulations] = useState<Record<string, number>>({});

  // ── Point-in-polygon filtering: actual state boundary from topojson ──
  const stateFeaturesRef = useRef<Map<string, any>>(new Map());

  // ── Smooth zoom animation system ──
  // Note: geoAlbersUsa is a composite projection that returns null for coordinates
  // outside its domain. Interpolating center coordinates via rAF can produce
  // intermediate values that crash ZoomableGroup. Instead we set center/zoom
  // directly and let CSS handle any visual transition.
  const moveToView = useCallback((targetCenter: [number, number], targetZoom: number) => {
    setCenter(targetCenter);
    setZoom(targetZoom);
  }, []);

  // Filter churches using the actual state polygon (falls back to bbox if topojson not loaded)
  const filterToStatePolygon = useCallback((rawChurches: Church[], stateAbbrev: string): Church[] => {
    const feat = stateFeaturesRef.current.get(stateAbbrev.toUpperCase());
    if (feat) {
      return rawChurches.filter(ch => geoContains(feat, [ch.lng, ch.lat]));
    }
    // Fallback to rectangular bounding box
    return filterToStateBounds(rawChurches, stateAbbrev);
  }, []);

  // Bible saying cycling for loading states — force at least MIN_VERSES before dismissing
  const MIN_VERSES = 3;
  const [sayingIndex, setSayingIndex] = useState<number | null>(null);
  const [forceLoadingVisible, setForceLoadingVisible] = useState(false);
  const versesShownRef = useRef(0);
  const loadingRef = useRef(false);
  const populatingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { populatingRef.current = populating; }, [populating]);

  // When loading starts, reset verse counter and force visibility
  useEffect(() => {
    if (loading || populating) {
      versesShownRef.current = 0;
      setForceLoadingVisible(true);
      setSayingIndex(null);
    }
  }, [loading, populating]);

  // Cycle verses while the loading overlay is showing
  useEffect(() => {
    const isActive = loading || populating || forceLoadingVisible;
    if (!isActive) {
      setSayingIndex(null);
      return;
    }

    // Show first verse after 1 second
    const showTimer = setTimeout(() => {
      const first = Math.floor(Math.random() * WAITING_SAYINGS.length);
      setSayingIndex(first);
      versesShownRef.current = 1;
    }, 1000);

    // Cycle every 3.5 seconds
    const cycleTimer = setInterval(() => {
      setSayingIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * WAITING_SAYINGS.length);
        } while (next === prev && WAITING_SAYINGS.length > 1);
        return next;
      });
      versesShownRef.current += 1;
      // If data has already loaded and we've shown enough verses, dismiss
      if (!loadingRef.current && !populatingRef.current && versesShownRef.current >= MIN_VERSES) {
        setForceLoadingVisible(false);
      }
    }, 3500);

    return () => {
      clearTimeout(showTimer);
      clearInterval(cycleTimer);
    };
  }, [loading, populating, forceLoadingVisible]);

  // Also dismiss once data finishes and enough verses already shown
  useEffect(() => {
    if (!loading && !populating && forceLoadingVisible && versesShownRef.current >= MIN_VERSES) {
      setForceLoadingVisible(false);
    }
  }, [loading, populating, forceLoadingVisible]);

  // Apply pending state transition once loading overlay fully dismisses
  useEffect(() => {
    if (!forceLoadingVisible && !loading && !populating && pendingTransitionRef.current) {
      const p = pendingTransitionRef.current;
      pendingTransitionRef.current = null;
      setFocusedState(p.abbrev);
      setFocusedStateName(p.name);
      setChurches(p.churches);
      setLoadingStateName("");
      moveToView([p.lng, p.lat], 4);
    }
  }, [forceLoadingVisible, loading, populating, moveToView]);

  // Sync local state churchCount with actual polygon-filtered count
  // (server meta stores raw Overpass count; polygon filtering may reduce it)
  useEffect(() => {
    if (focusedState && churches.length > 0) {
      setStates(prev => {
        const existing = prev.find(s => s.abbrev === focusedState);
        if (existing && existing.churchCount !== churches.length) {
          const delta = churches.length - existing.churchCount;
          setTotalChurches(t => t + delta);
          return prev.map(s =>
            s.abbrev === focusedState ? { ...s, churchCount: churches.length } : s
          );
        }
        return prev;
      });
    }
  }, [focusedState, churches.length]);

  // Load states and populations on mount
  useEffect(() => {
    console.log("[ChurchMap] Fetching states on mount...");
    fetchStates()
      .then((data) => {
        console.log(`[ChurchMap] Loaded ${data.states.length} states, ${data.totalChurches} total churches`);
        setStates(data.states);
        setTotalChurches(data.totalChurches);
      })
      .catch((err) => {
        console.error("[ChurchMap] Failed to load states:", err);
        setError("Failed to load state data. Please refresh the page.");
      });

    // Load topojson for point-in-polygon filtering (same CDN URL as react-simple-maps, browser-cached)
    fetch(GEO_URL)
      .then(res => res.json())
      .then((topology: any) => {
        const geojson = feature(topology, topology.objects.states) as any;
        const featureMap = new Map<string, any>();
        for (const f of geojson.features) {
          const abbrev = FIPS_TO_STATE[String(f.id).padStart(2, "0")];
          if (abbrev) featureMap.set(abbrev, f);
        }
        stateFeaturesRef.current = featureMap;
        console.log(`[ChurchMap] Loaded topojson features for ${featureMap.size} states (point-in-polygon filtering ready)`);
      })
      .catch(err => console.warn("[ChurchMap] Failed to load topojson for polygon filtering:", err));

    // Fetch state populations (non-blocking — used in church list modal)
    fetchStatePopulations()
      .then((data) => {
        setStatePopulations(data.populations);
        console.log(`[ChurchMap] Loaded populations for ${Object.keys(data.populations).length} states (source: ${data.source})`);
      })
      .catch((err) => {
        console.warn("[ChurchMap] Failed to load state populations:", err);
        // Non-critical — the modal will just hide the population stat
      });
  }, []);

  // Filter churches
  const filteredChurches = useMemo(() => {
    return churches.filter((church) => {
      const sizeCat = getSizeCategory(church.attendance);
      const denomGroup = getDenominationGroup(church.denomination);
      return activeSize.has(sizeCat.label) && activeDenominations.has(denomGroup);
    });
  }, [churches, activeSize, activeDenominations]);

  // Denomination counts for current view
  const denomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    churches.forEach((ch) => {
      const group = getDenominationGroup(ch.denomination);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [churches]);

  // Size category counts for current view
  const sizeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredChurches.forEach((ch) => {
      const cat = getSizeCategory(ch.attendance);
      counts[cat.label] = (counts[cat.label] || 0) + 1;
    });
    return counts;
  }, [filteredChurches]);

  // Summary stats (memoized) — must be after denomCounts and sizeCounts
  const summaryStats = useMemo(() => {
    if (focusedState && churches.length > 0) {
      const totalAttendance = churches.reduce((sum, ch) => sum + ch.attendance, 0);
      const avgAttendance = Math.round(totalAttendance / churches.length);
      const topDenoms = Object.entries(denomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      const topSizes = sizeCategories.map((cat) => ({
        label: cat.label,
        color: cat.color,
        count: sizeCounts[cat.label] || 0,
      }));

      // State-level interesting facts
      const facts: InterestingFact[] = [];

      // Largest church by attendance
      const largest = [...churches].sort((a, b) => b.attendance - a.attendance)[0];
      if (largest) {
        facts.push({
          icon: "trending",
          label: "Largest congregation",
          primary: largest.name,
          secondary: `~${largest.attendance.toLocaleString()} weekly`,
        });
      }

      // Dominant denomination
      if (topDenoms.length > 0) {
        const [topDenom, topCount] = topDenoms[0];
        const pct = Math.round((topCount / churches.length) * 100);
        facts.push({
          icon: "book",
          label: "Most common denomination",
          primary: topDenom,
          secondary: `${topCount.toLocaleString()} churches (${pct}%)`,
        });
      }

      // Average attendance
      facts.push({
        icon: "chart",
        label: "Average weekly attendance",
        primary: `~${avgAttendance.toLocaleString()} per church`,
        secondary: `~${totalAttendance.toLocaleString()} total`,
      });

      // Highest-attending denomination (avg attendance, min 5 churches to be meaningful)
      const denomAttendance: Record<string, { total: number; count: number }> = {};
      for (const ch of churches) {
        const d = getDenominationGroup(ch.denomination);
        if (!denomAttendance[d]) denomAttendance[d] = { total: 0, count: 0 };
        denomAttendance[d].total += ch.attendance;
        denomAttendance[d].count += 1;
      }
      const denomAvgs = Object.entries(denomAttendance)
        .filter(([, v]) => v.count >= 5)
        .map(([d, v]) => ({ denom: d, avg: Math.round(v.total / v.count), count: v.count }))
        .sort((a, b) => b.avg - a.avg);
      if (denomAvgs.length > 0) {
        const top = denomAvgs[0];
        facts.push({
          icon: "users",
          label: "Highest-attending denomination",
          primary: top.denom,
          secondary: `~${top.avg.toLocaleString()} avg weekly across ${top.count.toLocaleString()} churches`,
        });
      }

      // City with most churches
      const cityCounts: Record<string, number> = {};
      for (const ch of churches) {
        const city = ch.city?.trim();
        if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
      const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];
      if (topCity) {
        const pctOfState = Math.round((topCity[1] / churches.length) * 100);
        facts.push({
          icon: "mapPin",
          label: "Church capital",
          primary: topCity[0],
          secondary: `${topCity[1].toLocaleString()} churches (${pctOfState}% of state)`,
        });
      }

      return { type: "state" as const, totalAttendance, topDenoms, topSizes, interestingFacts: facts };
    } else {
      const populated = states.filter((s) => s.isPopulated && s.churchCount > 0);
      const unpopulated = states.length - populated.length;
      const topStates = [...populated]
        .sort((a, b) => b.churchCount - a.churchCount)
        .slice(0, 3);

      // Build interesting facts from loaded states + population data
      const facts: InterestingFact[] = [];

      const hasPop = Object.keys(statePopulations).length > 0;
      if (hasPop && populated.length > 0) {
        const withPerCapita = populated
          .filter((s) => statePopulations[s.abbrev] && statePopulations[s.abbrev] > 0)
          .map((s) => ({
            ...s,
            perCapita: s.churchCount / statePopulations[s.abbrev],
            peoplePer: Math.round(statePopulations[s.abbrev] / s.churchCount),
          }));
        if (withPerCapita.length > 0) {
          const densest = [...withPerCapita].sort((a, b) => b.perCapita - a.perCapita)[0];
          facts.push({
            icon: "users",
            label: "Most churches per capita",
            primary: densest.name,
            secondary: `1 per ${densest.peoplePer.toLocaleString()} people`,
            abbrev: densest.abbrev,
          });

          const sparsest = [...withPerCapita].sort((a, b) => a.perCapita - b.perCapita)[0];
          if (sparsest.abbrev !== densest.abbrev) {
            facts.push({
              icon: "building",
              label: "Fewest churches per capita",
              primary: sparsest.name,
              secondary: `1 per ${sparsest.peoplePer.toLocaleString()} people`,
              abbrev: sparsest.abbrev,
            });
          }
        }
      }

      // Only show "fewest churches" fact when not all states are loaded yet
      const allLoaded = states.length > 0 && states.every((s) => s.isPopulated);
      if (!allLoaded && populated.length >= 3) {
        const smallest = [...populated].sort((a, b) => a.churchCount - b.churchCount)[0];
        if (!topStates.find((s) => s.abbrev === smallest.abbrev)) {
          facts.push({
            icon: "search",
            label: "Fewest churches so far",
            primary: smallest.name,
            secondary: `${smallest.churchCount.toLocaleString()} churches`,
            abbrev: smallest.abbrev,
          });
        }
      }

      // National church-to-people ratio
      if (hasPop && populated.length >= 2) {
        const totalChurches = populated.reduce((sum, s) => sum + s.churchCount, 0);
        const totalPop = populated.reduce((sum, s) => sum + (statePopulations[s.abbrev] || 0), 0);
        if (totalPop > 0) {
          const peoplePer = Math.round(totalPop / totalChurches);
          facts.push({
            icon: "chart",
            label: "National ratio",
            primary: `1 church per ${peoplePer.toLocaleString()} people`,
            secondary: `${totalChurches.toLocaleString()} churches across ${populated.length} states`,
          });
        }
      }

      return {
        type: "national" as const,
        populated: populated.length,
        unpopulated,
        topStates,
        interestingFacts: facts.slice(0, 4),
      };
    }
  }, [focusedState, churches, states, denomCounts, sizeCounts, statePopulations]);

  // Load state data — fetches cached data or auto-populates from Overpass.
  // View transition is deferred until loading overlay (verse cycling) finishes.
  // Called by URL sync effect when route changes to a new state.
  const loadStateData = useCallback(
    async (stateAbbrev: string) => {
      const stateInfo = states.find((s) => s.abbrev === stateAbbrev);
      if (!stateInfo) {
        console.error(`[ChurchMap] loadStateData: no stateInfo found for "${stateAbbrev}". states.length=${states.length}`);
        return;
      }

      // Bump version — any in-flight load with an older version will be discarded
      const version = ++loadVersionRef.current;
      const isStale = () => loadVersionRef.current !== version;

      console.log(`[ChurchMap] Loading state: ${stateAbbrev} (${stateInfo.name}) [v${version}]`);

      // Always reset to clean slate before starting a new load
      setFocusedState(null);
      setFocusedStateName("");
      setChurches([]);
      setSelectedChurch(null);
      setLoadingStateName(stateInfo.name);
      pendingTransitionRef.current = {
        abbrev: stateAbbrev,
        name: stateInfo.name,
        lat: stateInfo.lat,
        lng: stateInfo.lng,
        churches: [],
      };
      setLoading(true);
      setError(null);

      try {
        // First, try to get cached data
        const data = await fetchChurches(stateAbbrev);
        if (isStale()) { console.log(`[ChurchMap] Discarding stale load for ${stateAbbrev} [v${version}]`); return; }

        if (data.churches && data.churches.length > 0) {
          const isTruncated = data.churches.length === 2000;
          const filtered = filterToStatePolygon(data.churches, stateAbbrev);

          if (isTruncated) {
            // Fetch full dataset before showing
            console.log(`${stateInfo.name} has exactly 2000 churches (likely truncated) — refreshing...`);
            setLoading(false);
            setPopulating(true);

            try {
              const result = await populateState(stateAbbrev, true);
              if (isStale()) return;
              if (!result.error) {
                const freshData = await fetchChurches(stateAbbrev);
                if (isStale()) return;
                if (freshData.churches && freshData.churches.length > 0) {
                  const freshFiltered = filterToStatePolygon(freshData.churches, stateAbbrev);
                  if (pendingTransitionRef.current?.abbrev === stateAbbrev) {
                    pendingTransitionRef.current.churches = freshFiltered;
                  }
                  console.log(`Refreshed ${stateInfo.name}: ${freshData.churches.length} churches (was 2000)`);
                }
                const statesData = await fetchStates();
                if (!isStale()) {
                  setStates(statesData.states);
                  setTotalChurches(statesData.totalChurches);
                }
              } else {
                // Refresh failed — use the stale data
                if (pendingTransitionRef.current?.abbrev === stateAbbrev) {
                  pendingTransitionRef.current.churches = filtered;
                }
              }
            } catch (refreshErr) {
              console.warn(`Background refresh failed for ${stateInfo.name}:`, refreshErr);
              if (!isStale() && pendingTransitionRef.current?.abbrev === stateAbbrev) {
                pendingTransitionRef.current.churches = filtered;
              }
            } finally {
              if (!isStale()) setPopulating(false);
            }
          } else {
            // Normal cached data — store in pending
            if (pendingTransitionRef.current?.abbrev === stateAbbrev) {
              pendingTransitionRef.current.churches = filtered;
            }
            setLoading(false);
          }
          return;
        }

        // No cached data — auto-populate from Overpass
        setPopulating(true);
        setLoading(false);

        const result = await populateState(stateAbbrev);
        if (isStale()) return;
        if (result.error) {
          setError(result.error);
          // Transition to state view so retry UI shows
          setFocusedState(stateAbbrev);
          setFocusedStateName(stateInfo.name);
          moveToView([stateInfo.lng, stateInfo.lat], 4);
          pendingTransitionRef.current = null;
          setLoadingStateName("");
          setForceLoadingVisible(false);
          setPopulating(false);
          return;
        }

        // Fetch the newly populated churches
        const freshData = await fetchChurches(stateAbbrev);
        if (isStale()) return;
        const freshFiltered = filterToStatePolygon(freshData.churches || [], stateAbbrev);
        if (pendingTransitionRef.current?.abbrev === stateAbbrev) {
          pendingTransitionRef.current.churches = freshFiltered;
        }

        // Refresh states list to update counts
        const statesData = await fetchStates();
        if (!isStale()) {
          setStates(statesData.states);
          setTotalChurches(statesData.totalChurches);
        }
      } catch (err) {
        if (isStale()) return;
        console.error(`Failed to load churches for ${stateAbbrev}:`, err);
        setError(
          `Failed to load churches for ${stateInfo.name}. This might be due to API rate limits — try again in a moment.`
        );
        // Transition to state view so error/retry UI shows
        setFocusedState(stateAbbrev);
        setFocusedStateName(stateInfo.name);
        moveToView([stateInfo.lng, stateInfo.lat], 4);
        pendingTransitionRef.current = null;
        setLoadingStateName("");
        setForceLoadingVisible(false);
      } finally {
        if (!isStale()) {
          setLoading(false);
          setPopulating(false);
        }
      }
    },
    [states, moveToView, filterToStatePolygon]
  );

  // Silent background load — used when navigating to a specific church from search.
  // Shows the church instantly without loading overlay; fetches remaining state churches silently.
  const loadStateDataSilent = useCallback(
    async (stateAbbrev: string, preloadedChurch: Church) => {
      const stateInfo = states.find((s) => s.abbrev === stateAbbrev);
      if (!stateInfo) return;

      const version = ++loadVersionRef.current;
      const isStale = () => loadVersionRef.current !== version;

      console.log(`[ChurchMap] Instant church: "${preloadedChurch.name}" in ${stateAbbrev} [v${version}]`);

      // Immediately show the state zoomed to the preloaded church — no overlay
      setFocusedState(stateAbbrev);
      setFocusedStateName(stateInfo.name);
      setChurches([preloadedChurch]);
      setSelectedChurch(preloadedChurch);
      setCenter([preloadedChurch.lng, preloadedChurch.lat]);
      setZoom(8);
      setError(null);
      setLoading(false);
      setPopulating(false);
      pendingTransitionRef.current = null;
      setLoadingStateName("");
      setForceLoadingVisible(false);

      // Silently load all churches in the background
      try {
        const data = await fetchChurches(stateAbbrev);
        if (isStale()) return;

        if (data.churches && data.churches.length > 0) {
          const filtered = filterToStatePolygon(data.churches, stateAbbrev);
          setChurches(filtered);

          // Re-select from full dataset (may have more complete data)
          const full = filtered.find((c) => c.id === preloadedChurch.id);
          if (full) setSelectedChurch(full);

          if (data.churches.length === 2000) {
            // Truncated — refresh in background
            try {
              const result = await populateState(stateAbbrev, true);
              if (isStale()) return;
              if (!result.error) {
                const fresh = await fetchChurches(stateAbbrev);
                if (isStale()) return;
                if (fresh.churches?.length) {
                  const ff = filterToStatePolygon(fresh.churches, stateAbbrev);
                  setChurches(ff);
                  const fc = ff.find((c) => c.id === preloadedChurch.id);
                  if (fc) setSelectedChurch(fc);
                }
                const sd = await fetchStates();
                if (!isStale()) { setStates(sd.states); setTotalChurches(sd.totalChurches); }
              }
            } catch (e) { console.warn(`Background refresh failed for ${stateAbbrev}:`, e); }
          }
        } else {
          // No cached data — need to populate (keep church visible during population)
          setPopulating(true);
          try {
            const result = await populateState(stateAbbrev);
            if (isStale()) return;
            if (!result.error) {
              const fresh = await fetchChurches(stateAbbrev);
              if (isStale()) return;
              const ff = filterToStatePolygon(fresh.churches || [], stateAbbrev);
              setChurches(ff);
              const fc = ff.find((c) => c.id === preloadedChurch.id);
              if (fc) setSelectedChurch(fc);
              const sd = await fetchStates();
              if (!isStale()) { setStates(sd.states); setTotalChurches(sd.totalChurches); }
            }
          } catch (e) { console.warn(`Background population failed for ${stateAbbrev}:`, e);
          } finally { if (!isStale()) setPopulating(false); }
        }
      } catch (err) {
        if (isStale()) return;
        console.warn(`[ChurchMap] Background load failed for ${stateAbbrev}:`, err);
        // Keep showing the preloaded church — user can still see the detail panel
      }
    },
    [states, filterToStatePolygon]
  );

  // Callback for search bar / modal to preload a church before navigating
  const preloadChurch = useCallback((church: Church) => {
    preloadedChurchRef.current = church;
  }, []);

  // ── URL Sync: Route → Internal State ──
  // Track previous route params to detect changes
  const prevRouteStateRef = useRef<string | null>(null);
  const prevRouteChurchRef = useRef<string | null>(null);
  const statesLoadedRef = useRef(false);

  // Keep statesLoadedRef in sync
  useEffect(() => {
    if (states.length > 0) statesLoadedRef.current = true;
  }, [states]);

  // Sync state route param → load state data
  useEffect(() => {
    if (!statesLoadedRef.current || states.length === 0) return; // Wait for states to load

    if (routeStateAbbrev === prevRouteStateRef.current) return;
    prevRouteStateRef.current = routeStateAbbrev;

    if (!routeStateAbbrev) {
      // Navigate to national view — cancel any in-flight load
      loadVersionRef.current++;
      setFocusedState(null);
      setFocusedStateName("");
      setChurches([]);
      setError(null);
      setLoading(false);
      setPopulating(false);
      setShowFilterPanel(false);
      setShowListModal(false);
      setSelectedChurch(null);
      setLoadingStateName("");
      pendingTransitionRef.current = null;
      setForceLoadingVisible(false);
      moveToView([-96, 38], 1);
      return;
    }

    // Validate state abbreviation
    const stateInfo = states.find((s) => s.abbrev === routeStateAbbrev);
    if (!stateInfo) {
      console.warn(`[ChurchMap] Invalid state in URL: "${routeStateAbbrev}"`);
      navigateToNational();
      return;
    }

    // Load the state (skip if already focused on this state and not loading)
    if (focusedStateRef.current !== routeStateAbbrev) {
      const preloaded = preloadedChurchRef.current;
      preloadedChurchRef.current = null;
      if (preloaded && preloaded.state === routeStateAbbrev) {
        // Instant church — show immediately, load rest silently
        loadStateDataSilent(routeStateAbbrev, preloaded);
      } else {
        loadStateData(routeStateAbbrev);
      }
    }
  }, [routeStateAbbrev, states, loadStateData, loadStateDataSilent, moveToView, navigateToNational]);

  // Sync church route param → select church
  useEffect(() => {
    if (routeChurchId === prevRouteChurchRef.current) return;
    prevRouteChurchRef.current = routeChurchId;

    if (!routeChurchId) {
      // Deselect church
      if (selectedChurch) {
        setSelectedChurch(null);
        if (focusedState) {
          const si = states.find((s) => s.abbrev === focusedState);
          if (si) moveToView([si.lng, si.lat], 4);
        }
      }
      return;
    }

    // Find and select the church (churches may not be loaded yet)
    if (churches.length > 0) {
      const church = churches.find((c) => c.id === routeChurchId);
      if (church) {
        setSelectedChurch(church);
        setCenter([church.lng, church.lat]);
        setZoom((z) => Math.max(z, 8));
      }
    }
  }, [routeChurchId, churches, selectedChurch, focusedState, states, moveToView]);

  // Handle deferred church selection — when churches finish loading and there's a church in the URL
  useEffect(() => {
    if (routeChurchId && churches.length > 0 && !selectedChurch) {
      const church = churches.find((c) => c.id === routeChurchId);
      if (church) {
        setSelectedChurch(church);
        setCenter([church.lng, church.lat]);
        setZoom((z) => Math.max(z, 8));
      }
    }
  }, [churches, routeChurchId, selectedChurch]);

  // Update page title based on current view
  useEffect(() => {
    if (selectedChurch) {
      document.title = `${selectedChurch.name} — ${selectedChurch.city || selectedChurch.state} | Here's My Church`;
    } else if (focusedState && focusedStateName) {
      document.title = `Churches in ${focusedStateName} | Here's My Church`;
    } else {
      document.title = "Here's My Church";
    }
  }, [selectedChurch, focusedState, focusedStateName]);

  // Populate state from Overpass API (manual retry)
  const handlePopulate = useCallback(async () => {
    if (!focusedState) return;
    setPopulating(true);
    setError(null);
    setLoadingStateName(focusedStateName);

    try {
      const result = await populateState(focusedState);
      if (result.error) {
        setError(result.error);
        return;
      }

      // Now fetch the churches
      const data = await fetchChurches(focusedState);
      setChurches(filterToStatePolygon(data.churches || [], focusedState));

      // Refresh states list
      const statesData = await fetchStates();
      setStates(statesData.states);
      setTotalChurches(statesData.totalChurches);
    } catch (err) {
      console.error(`Failed to populate ${focusedState}:`, err);
      setError(
        `Failed to populate churches. The Overpass API may be rate-limited — please wait a moment and try again.`
      );
    } finally {
      setPopulating(false);
    }
  }, [focusedState, focusedStateName, filterToStatePolygon]);

  // Reset to national view — navigates to "/" which triggers the URL sync effect
  const handleResetView = useCallback(() => {
    navigateToNational();
  }, [navigateToNational]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.5, 40)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.5, 1)), []);

  const toggleSize = useCallback((label: string) => {
    setActiveSize((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  const toggleDenom = useCallback((label: string) => {
    setActiveDenominations((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // Stable callback for ChurchDots click handler — navigates to church URL
  const handleChurchDotClick = useCallback((church: Church) => {
    setHoveredChurch(null); // Clear hover tooltip on click
    if (focusedState) {
      navigateToChurch(focusedState, church.id);
    }
  }, [focusedState, navigateToChurch]);

  return (
    <div
      className={`relative size-full overflow-hidden flex ${selectedChurch ? 'flex-col md:flex-row' : ''}`}
      style={{ fontFamily: "'Livvic', sans-serif" }}
      onMouseMove={handleMouseMove}
    >
      {/* Map area */}
      <div className={`${selectedChurch ? 'h-[45vh] md:h-full md:flex-1' : 'flex-1'} relative`} style={{ backgroundColor: "#F5F0E8" }}>
        {/* Top header pill + summary dropdown */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[90vw] md:max-w-[75vw]" ref={summaryRef}>
          {/* Pill */}
          <button
            onClick={() => {
              setShowSummary((v) => {
                if (!v) { setShowFilterPanel(false); setShowLegend(false); }
                return !v;
              });
            }}
            className="flex items-center justify-center gap-3 px-5 py-2.5 rounded-full shadow-lg transition-all hover:shadow-xl cursor-pointer min-w-[85vw] md:min-w-0"
            style={{ backgroundColor: "rgba(30, 16, 64, 0.92)" }}
          >
            <ChurchIcon size={18} className="text-purple-300" />
            {focusedState ? (
              <span className="text-white text-sm">
                <span className="font-semibold">
                  {filteredChurches.length.toLocaleString()} churches
                </span>{" "}
                in{" "}
                <span className="text-purple-300 font-semibold">
                  {focusedStateName}
                </span>
              </span>
            ) : (
              <span className="text-white text-sm">
                <span className="font-semibold">
                  {totalChurches.toLocaleString()} churches
                </span>{" "}
                {allStatesLoaded ? "across all" : "across"}{" "}
                <span className="text-purple-300 font-semibold">
                  {allStatesLoaded ? "50 states" : `${states.filter((s) => s.isPopulated).length} states`}
                </span>
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-white/40 transition-transform duration-200 ${showSummary ? "rotate-180" : ""}`}
            />
          </button>

          {/* Summary dropdown */}
          <AnimatePresence>
            {showSummary && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mt-2 rounded-2xl shadow-2xl overflow-hidden w-full md:w-[360px] max-h-[70vh] flex flex-col"
                style={{ backgroundColor: "rgba(30, 16, 64, 0.97)" }}
              >
                {/* Header — pinned top */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8 flex-shrink-0">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">
                    {focusedState ? `${focusedStateName} Summary` : "Summary"}
                  </span>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <X size={14} className="text-white/50" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                  {summaryStats.type === "state" ? (
                    <>
                      {/* State summary intro */}
                      <p className="text-white/70 text-xs leading-relaxed">
                        There are <span className="font-bold text-white">{churches.length.toLocaleString()} churches</span> in{" "}
                        <span className="font-bold text-purple-300">{focusedStateName}</span> with an estimated combined weekly attendance of{" "}
                        <span className="font-bold text-white">~{summaryStats.totalAttendance.toLocaleString()}</span>.
                        {statePopulations[focusedState!] && (
                          <> That&apos;s roughly <span className="font-bold text-white">1 church per {Math.round(statePopulations[focusedState!] / churches.length).toLocaleString()} people</span>.</>
                        )}
                      </p>

                      {/* Top denominations */}
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold block mb-1.5">
                          Top Denominations
                        </span>
                        <div className="space-y-0.5">
                          {summaryStats.topDenoms.map(([label, count]) => {
                            const pct = churches.length > 0 ? (count / churches.length) * 100 : 0;
                            return (
                              <div key={label} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/4">
                                <span className="text-white text-[11px] font-medium truncate min-w-0 flex-1">{label}</span>
                                <div className="w-16 h-1 rounded-full bg-white/8 overflow-hidden flex-shrink-0">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(pct, 2)}%`,
                                      background: "linear-gradient(90deg, #A855F7, #6B21A8)",
                                    }}
                                  />
                                </div>
                                <span className="text-white/40 text-[10px] flex-shrink-0 w-8 text-right">{pct < 1 ? "<1" : Math.round(pct)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Size breakdown */}
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold block mb-2">
                          By Attendance Size
                        </span>
                        <div className="space-y-1">
                          {summaryStats.topSizes.filter(s => s.count > 0).map((s) => (
                            <div key={s.label} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/4">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="text-white/70 text-xs flex-1">{s.label}</span>
                              <span className="text-white/40 text-xs font-medium">{s.count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interesting facts (state level) */}
                      {summaryStats.interestingFacts && summaryStats.interestingFacts.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold block mb-2">
                            Interesting Finds
                          </span>
                          <div className="space-y-1.5">
                            {summaryStats.interestingFacts.map((fact) => {
                              const IconComp = FACT_ICONS[fact.icon] || ChurchIcon;
                              return (
                                <div
                                  key={fact.label}
                                  className="w-full rounded-lg bg-white/4 border border-white/5 px-3 py-2.5 text-left"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <IconComp size={14} className="text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-white/50 text-[10px] uppercase tracking-wide font-medium block">
                                        {fact.label}
                                      </span>
                                      <div className="flex items-center justify-between mt-0.5">
                                        <span className="text-white text-xs font-semibold">
                                          {fact.primary}
                                        </span>
                                        <span className="text-purple-300/70 text-[11px] font-medium">
                                          {fact.secondary}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </>
                  ) : (
                    <>
                      {/* National summary intro */}
                      <p className="text-white/70 text-xs leading-relaxed">
                        {summaryStats.populated > 0 ? (
                          <>
                            Currently tracking <span className="font-bold text-white">{totalChurches.toLocaleString()} churches</span> across{" "}
                            <span className="font-bold text-purple-300">
                              {allStatesLoaded ? "all 50 states" : `${summaryStats.populated} states`}
                            </span>.
                            {!allStatesLoaded && summaryStats.unpopulated > 0 && (
                              <> <span className="text-white/50">{summaryStats.unpopulated} states haven&apos;t been explored yet.</span></>
                            )}
                          </>
                        ) : (
                          <>Click any state on the map to fetch its church data from OpenStreetMap.</>
                        )}
                      </p>

                      {/* Top 3 states by church count */}
                      {summaryStats.topStates.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold block mb-2">
                            Most Churches
                          </span>
                          <div className="space-y-1">
                            {summaryStats.topStates.map((st, i) => {
                              const pct = totalChurches > 0 ? (st.churchCount / totalChurches) * 100 : 0;
                              return (
                                <button
                                  key={st.abbrev}
                                  onClick={() => {
                                    setShowSummary(false);
                                    navigateToState(st.abbrev);
                                  }}
                                  className="w-full rounded-lg bg-white/4 border border-white/5 px-3 py-2 hover:bg-white/8 transition-colors text-left group cursor-pointer"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/25 text-[10px] font-mono w-4">{i + 1}.</span>
                                      <span className="text-white text-xs font-semibold group-hover:text-purple-300 transition-colors">
                                        {st.name}
                                      </span>
                                    </div>
                                    <span className="text-white/40 text-[11px]">
                                      {st.churchCount.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 h-1 rounded-full bg-white/8 overflow-hidden ml-6">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.max(pct, 2)}%`,
                                        background: "linear-gradient(90deg, #A855F7, #6B21A8)",
                                      }}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Interesting facts */}
                      {summaryStats.interestingFacts && summaryStats.interestingFacts.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold block mb-2">
                            Interesting Finds
                          </span>
                          <div className="space-y-1.5">
                            {summaryStats.interestingFacts.map((fact) => {
                              const IconComp = FACT_ICONS[fact.icon] || ChurchIcon;
                              const isClickable = !!fact.abbrev;
                              const Tag = isClickable ? "button" : "div";
                              return (
                                <Tag
                                  key={(fact.abbrev || "") + fact.label}
                                  {...(isClickable ? {
                                    onClick: () => {
                                      setShowSummary(false);
                                      navigateToState(fact.abbrev!);
                                    },
                                  } : {})}
                                  className={`w-full rounded-lg bg-white/4 border border-white/5 px-3 py-2.5 text-left group ${isClickable ? "hover:bg-white/8 transition-colors cursor-pointer" : ""}`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <IconComp size={14} className="text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-white/50 text-[10px] uppercase tracking-wide font-medium block">
                                        {fact.label}
                                      </span>
                                      <div className="flex items-center justify-between mt-0.5">
                                        <span className={`text-white text-xs font-semibold ${isClickable ? "group-hover:text-purple-300" : ""} transition-colors`}>
                                          {fact.primary}
                                        </span>
                                        <span className="text-purple-300/70 text-[11px] font-medium">
                                          {fact.secondary}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </Tag>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Unloaded states hint */}
                      {summaryStats.unpopulated > 0 && (
                        <div className="rounded-lg bg-purple-900/20 border border-purple-500/10 px-3 py-2.5">
                          <p className="text-white/40 text-[11px] leading-relaxed text-center">
                            {summaryStats.unpopulated} state{summaryStats.unpopulated > 1 ? "s" : ""} remaining — click any state to fetch its data from OpenStreetMap
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Disclaimer + data source footer */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <p className="text-white/30 text-[10px] text-center leading-relaxed italic">
                      Not all churches may be represented yet — our goal is for every church to be included.{" "}
                      {focusedState
                        ? "Find your church or add it below!"
                        : "Click any state to find or add your church!"
                      }
                    </p>
                    {focusedState && (
                      <div className="flex justify-center pt-1">
                        <button
                          onClick={() => {
                            setShowSummary(false);
                            setShowAddChurchFromSummary(true);
                          }}
                          className="text-[10px] text-purple-400 not-italic font-medium px-3 py-1 rounded-full border border-purple-400/30 hover:bg-purple-400/10 hover:border-purple-400/50 transition-all cursor-pointer"
                        >
                          + Add Your Church
                        </button>
                      </div>
                    )}
                    <p className="text-white/20 text-[10px] text-center leading-relaxed">
                      Church data from OpenStreetMap via Overpass API{" "}&middot;{" "}
                      Cross-referenced with The Association of Religion Data Archives (ARDA){" "}&middot;{" "}
                      Population from U.S. Census Bureau{" "}&middot;{" "}
                      Boundaries from Natural Earth / U.S. Census TIGER
                    </p>
                  </div>
                </div>

                {/* View Full Church List — pinned bottom (state view only) */}
                {summaryStats.type === "state" && (
                  <div className="px-5 pb-4 pt-3 border-t border-white/8 flex-shrink-0">
                    <button
                      onClick={() => {
                        setShowSummary(false);
                        setShowListModal(true);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 transition-colors cursor-pointer"
                    >
                      View Full Church List
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Back button when focused on state */}
        {focusedState && (
          <button
            onClick={handleResetView}
            className="absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-white text-xs font-medium transition-colors hover:bg-purple-700"
            style={{ backgroundColor: "rgba(107, 33, 168, 0.9)" }}
          >
            <ArrowLeft size={14} />
            All States
          </button>
        )}

        {/* Map */}
        <ComposableMap
          projection="geoAlbersUsa"
          style={{ width: "100%", height: "100%" }}
          projectionConfig={{ scale: 1000 }}
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={1}
            maxZoom={40}
            onMoveEnd={({ coordinates, zoom: z }) => {
              if (coordinates && coordinates[0] != null && coordinates[1] != null) {
                setCenter(coordinates as [number, number]);
                setZoom(z);
              }
            }}
          >
            {/* Invisible background — click outside state lines to return to national view */}
            {focusedState && (
              <rect
                x={-500}
                y={-500}
                width={2000}
                height={2000}
                fill="transparent"
                onClick={handleResetView}
                style={{ cursor: "pointer" }}
              />
            )}
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                      const fipsId = geo.id;
                      const stateAbbrev = FIPS_TO_STATE[fipsId];
                      const stateInfo = states.find(
                        (s) => s.abbrev === stateAbbrev
                      );
                      const isPopulated = stateInfo?.isPopulated;
                      const isFocused = focusedState === stateAbbrev;
                      const isHovered = hoveredState === stateAbbrev;

                      // State fill: tiered by church count in national view
                      const churchCount = stateInfo?.churchCount || 0;
                      const tier = getStateTier(churchCount);
                      let fill = tier.color; // default: tier-based purple shade
                      if (isFocused) fill = "#C9A0DC";
                      else if (isHovered && !focusedState) fill = "#D4B8E8";
                      else if (focusedState && !isFocused) fill = "#EDE4F3";

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke={isFocused ? "#6B21A8" : "#C9A0DC"}
                          strokeWidth={isFocused ? 1.5 : 0.5}
                          onClick={(e) => {
                            if (stateAbbrev && !focusedState) {
                              navigateToState(stateAbbrev);
                            } else if (focusedState && isFocused) {
                              // Clicking the focused state itself — don't navigate back
                              e.stopPropagation();
                            }
                            // Clicking a non-focused state in state view: let it bubble to bg rect → navigateToNational
                          }}
                          onMouseEnter={() => setHoveredState(stateAbbrev || null)}
                          onMouseLeave={() => setHoveredState(null)}
                          style={{
                            default: { outline: "none", cursor: focusedState && isFocused ? "default" : "pointer" },
                            hover: { outline: "none", cursor: focusedState && isFocused ? "default" : "pointer" },
                            pressed: { outline: "none", cursor: focusedState && isFocused ? "default" : "pointer" },
                          }}
                        />
                      );
                })
              }
            </Geographies>

            {/* County boundary lines — only in state view */}
            {focusedState && (
              <Geographies geography={COUNTIES_GEO_URL}>
                {({ geographies }) => {
                  const stateFips = STATE_TO_FIPS[focusedState];
                  if (!stateFips) return null;
                  return geographies
                    .filter((geo) => String(geo.id).padStart(5, "0").substring(0, 2) === stateFips)
                    .map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="transparent"
                        stroke="rgba(107, 33, 168, 0.25)"
                        strokeWidth={0.4}
                        pointerEvents="none"
                        style={{
                          default: { outline: "none", cursor: "default" },
                          hover: { outline: "none", cursor: "default" },
                          pressed: { outline: "none", cursor: "default" },
                        }}
                      />
                    ));
                }}
              </Geographies>
            )}

            {/* Church markers — high-performance projected circles with viewport culling */}
            {filteredChurches.length > 0 && (
              <ChurchDots
                churches={filteredChurches}
                selectedChurchId={selectedChurch?.id ?? null}
                zoom={zoom}
                center={center}
                onChurchClick={handleChurchDotClick}
                onChurchHover={setHoveredChurch}
              />
            )}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hovered state tooltip (national view) */}
        {hoveredState && !focusedState && !hoveredChurch && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg shadow-xl px-4 py-2.5"
            style={{
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 40,
              backgroundColor: "rgba(30, 16, 64, 0.95)",
            }}
          >
            <div className="text-sm font-semibold text-white">
              {states.find((s) => s.abbrev === hoveredState)?.name || hoveredState}
            </div>
            <div className="text-xs text-purple-300 mt-0.5">
              {states.find((s) => s.abbrev === hoveredState)?.isPopulated
                ? `${states.find((s) => s.abbrev === hoveredState)?.churchCount.toLocaleString()} churches`
                : "Click to explore"}
            </div>
          </div>
        )}

        {/* Hovered church tooltip — hide for the currently selected church */}
        {hoveredChurch && hoveredChurch.id !== selectedChurch?.id && (
          <div
            className="fixed z-50 pointer-events-none rounded-xl shadow-xl px-4 py-3 max-w-[300px]"
            style={{
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 70,
              backgroundColor: "rgba(30, 16, 64, 0.96)",
            }}
          >
            <div className="text-sm font-semibold text-white">
              {hoveredChurch.name}
            </div>
            {(hoveredChurch.city || hoveredChurch.address) && (
              <div className="text-xs text-white/50 mt-0.5">
                {hoveredChurch.address && (
                  <span>{hoveredChurch.address}, </span>
                )}
                {hoveredChurch.city && <span>{hoveredChurch.city}, </span>}
                {hoveredChurch.state}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: getSizeCategory(hoveredChurch.attendance)
                      .color,
                  }}
                />
                <span className="text-xs text-purple-300">
                  ~{hoveredChurch.attendance.toLocaleString()} attending
                </span>
              </div>
            </div>
            <div className="text-xs text-white/40 mt-1.5 flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#A855F7" }}
              />
              {hoveredChurch.denomination === "Other" || hoveredChurch.denomination === "Unknown" ? "Non-denominational" : hoveredChurch.denomination}
            </div>
          </div>
        )}

        {/* Loading overlay — stays visible until MIN_VERSES Bible verses have cycled */}
        {(loading || populating || forceLoadingVisible) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div
              className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl"
              style={{ backgroundColor: "rgba(30, 16, 64, 0.95)" }}
            >
              <Loader2 size={28} className="text-purple-400 animate-spin" />
              <span className="text-white text-sm font-medium">
                {loadingStateName
                  ? `Loading churches in ${loadingStateName}...`
                  : `Loading churches...`}
              </span>
              {(loading || populating || forceLoadingVisible) && (
                <div className="mt-2 pt-3 border-t border-white/10 max-w-[280px] text-center relative overflow-hidden" style={{ minHeight: 72 }}>
                  <AnimatePresence mode="wait">
                    {sayingIndex !== null && (
                      <motion.div
                        key={sayingIndex}
                        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      >
                        <p className="text-white/50 text-xs italic leading-relaxed">
                          "{WAITING_SAYINGS[sayingIndex].text}"
                        </p>
                        <p className="text-purple-400/60 text-[10px] mt-1.5 font-medium">
                          — {WAITING_SAYINGS[sayingIndex].ref}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state with retry */}
        {error && focusedState && !loading && !populating && !forceLoadingVisible && churches.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div
              className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl shadow-2xl pointer-events-auto max-w-[340px]"
              style={{ backgroundColor: "rgba(30, 16, 64, 0.95)" }}
            >
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <X size={20} className="text-red-400" />
              </div>
              <div className="text-center">
                <div className="text-white font-semibold text-sm">
                  Couldn't load {focusedStateName}
                </div>
                <div className="text-white/50 text-xs mt-1.5 leading-relaxed">
                  {error}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setError(null);
                    loadStateData(focusedState);
                  }}
                  className="px-5 py-2 rounded-full text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg, #6B21A8 0%, #A855F7 100%)",
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={handleResetView}
                  className="px-5 py-2 rounded-full text-white/60 text-sm border border-white/15 hover:bg-white/5 transition-all"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error banner (when churches are loaded but there's a non-critical error) */}
        {error && (churches.length > 0 || (!focusedState)) && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-xs"
              style={{ backgroundColor: "rgba(180, 40, 60, 0.9)" }}
            >
              <span className="text-white">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-white/60 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Zoom & controls — hidden during loading overlay */}
        {!loading && !populating && !forceLoadingVisible && (
        <div className="absolute left-4 bottom-6 z-20 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 rounded-lg flex items-center justify-center shadow-md transition-colors"
            style={{ backgroundColor: "rgba(30,16,64,0.9)" }}
          >
            <ZoomIn size={16} color="#C9A0DC" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 rounded-lg flex items-center justify-center shadow-md transition-colors"
            style={{ backgroundColor: "rgba(30,16,64,0.9)" }}
          >
            <ZoomOut size={16} color="#C9A0DC" />
          </button>
          <button
            onClick={handleResetView}
            className="w-9 h-9 rounded-lg flex items-center justify-center shadow-md transition-colors"
            style={{ backgroundColor: "rgba(30,16,64,0.9)" }}
          >
            <RotateCcw size={16} color="#C9A0DC" />
          </button>
          {/* Filter — only in state view */}
          {focusedState && (
            <button
              onClick={() => {
                setShowFilterPanel((v) => {
                  if (!v) { setShowSummary(false); setShowLegend(false); }
                  return !v;
                });
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-md transition-colors"
              style={{
                backgroundColor: showFilterPanel
                  ? "#6B21A8"
                  : "rgba(30,16,64,0.9)",
              }}
            >
              <Filter size={16} color={showFilterPanel ? "#fff" : "#C9A0DC"} />
            </button>
          )}
        </div>
        )}

        {/* Filter panel */}
        {showFilterPanel && (
          <div
            className="absolute left-16 bottom-6 z-20 rounded-xl shadow-2xl p-4 w-[260px] max-h-[70vh] overflow-y-auto"
            style={{ backgroundColor: "rgba(30, 16, 64, 0.96)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Filters</span>
              <button onClick={() => setShowFilterPanel(false)}>
                <X size={16} color="#C9A0DC" />
              </button>
            </div>

            {/* Size filters */}
            <button
              onClick={() => setShowSizeFilters(!showSizeFilters)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-purple-300 uppercase tracking-wider"
            >
              Attendance Size
              {showSizeFilters ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            {showSizeFilters && (
              <div className="mb-3">
                {sizeCategories.map((cat) => (
                  <label
                    key={cat.label}
                    className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-white/5 px-2 rounded-md"
                  >
                    <input
                      type="checkbox"
                      checked={activeSize.has(cat.label)}
                      onChange={() => toggleSize(cat.label)}
                      className="accent-purple-500 w-3.5 h-3.5"
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-full"
                        style={{
                          width: Math.max(cat.radius * 1.6, 6),
                          height: Math.max(cat.radius * 1.6, 6),
                          backgroundColor: cat.color,
                        }}
                      />
                      <span className="text-xs text-white/70">{cat.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Denomination filters */}
            <button
              onClick={() => setShowDenomFilters(!showDenomFilters)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-purple-300 uppercase tracking-wider border-t border-white/10"
            >
              Denomination
              {showDenomFilters ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            {showDenomFilters && (
              <div className="mb-2">
                {DENOMINATION_GROUPS.map((group) => {
                  const count = denomCounts[group.label] || 0;
                  return (
                    <label
                      key={group.label}
                      className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 px-2 rounded-md"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={activeDenominations.has(group.label)}
                          onChange={() => toggleDenom(group.label)}
                          className="accent-purple-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-white/70">
                          {group.label}
                        </span>
                      </div>
                      {count > 0 && (
                        <span className="text-xs text-white/30">{count}</span>
                      )}
                    </label>
                  );
                })}
                <div className="flex gap-2 mt-2 px-2">
                  <button
                    onClick={() =>
                      setActiveDenominations(
                        new Set(DENOMINATION_GROUPS.map((g) => g.label))
                      )
                    }
                    className="text-xs text-purple-300 hover:text-purple-200"
                  >
                    Select all
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={() => setActiveDenominations(new Set())}
                    className="text-xs text-purple-300 hover:text-purple-200"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search bar — bottom center, hidden during loading */}
        {!loading && !populating && !forceLoadingVisible && (
          <MapSearchBar
            churches={churches}
            states={states}
            focusedState={focusedState}
            focusedStateName={focusedStateName}
            navigateToChurch={navigateToChurch}
            onPreloadChurch={preloadChurch}
          />
        )}

        {/* Legend — hidden during loading overlay */}
        {!loading && !populating && !forceLoadingVisible && (
        <div className="absolute bottom-6 right-4 z-20">
          <div
            className={`shadow-lg cursor-pointer overflow-hidden ${showLegend ? "rounded-xl" : "rounded-full"}`}
            style={{ backgroundColor: "rgba(30, 16, 64, 0.93)" }}
            onClick={() => {
              setShowLegend((v) => {
                if (!v) { setShowSummary(false); setShowFilterPanel(false); }
                return !v;
              });
            }}
          >
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-widest whitespace-nowrap">
                Map Key
              </span>
              {!showLegend && (
                <div className="flex items-center gap-1">
                  {(focusedState
                    ? sizeCategories.map(c => c.color)
                    : STATE_COUNT_TIERS.filter(t => !(t.min === 0 && t.max === 0)).map(t => t.color)
                  ).map((color, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
              <ChevronDown
                size={14}
                className={`text-white/50 transition-transform duration-200 flex-shrink-0 ${showLegend ? "rotate-180" : ""}`}
              />
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: showLegend ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-3">
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide block mb-2">
                      {focusedState ? "Attendance" : "Churches per State"}
                      </span>
                      {focusedState ? (
                        <>
                          {sizeCategories.map((cat) => (
                            <div key={cat.label} className="flex items-center gap-2.5 py-0.5">
                              <div
                                className="rounded-full flex-shrink-0"
                                style={{
                                  width: Math.max(cat.radius * 1.5, 6),
                                  height: Math.max(cat.radius * 1.5, 6),
                                  backgroundColor: cat.color,
                                }}
                              />
                              <span className="text-xs text-white/60">{cat.label}</span>
                              <span className="text-xs text-white/30 ml-auto pl-3">
                                {(() => {
                                  const count = sizeCounts[cat.label] || 0;
                                  if (filteredChurches.length === 0 || count === 0) return "0%";
                                  const pct = (count / filteredChurches.length) * 100;
                                  if (pct < 1) return "< 1%";
                                  return `${Math.round(pct)}%`;
                                })()}
                              </span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {STATE_COUNT_TIERS.map((tier) => {
                            // Hide the "Not yet explored" tier when all states are loaded
                            if (tier.min === 0 && tier.max === 0 && allStatesLoaded) return null;
                            const count = states.filter((s) => {
                              if (tier.min === 0 && tier.max === 0) return !s.isPopulated || s.churchCount === 0;
                              return s.churchCount >= tier.min && s.churchCount <= tier.max;
                            }).length;
                            return (
                              <div key={tier.label} className="flex items-center gap-2.5 py-0.5">
                                <div
                                  className="w-3.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: tier.color }}
                                />
                                <span className="text-xs text-white/60">{tier.label}</span>
                                {count > 0 && (
                                  <span className="text-xs text-white/30 ml-auto pl-3">
                                    {count}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Church list modal */}
      {showListModal && focusedState && (
        <ChurchListModal
          churches={churches}
          stateName={focusedStateName}
          stateAbbrev={focusedState}
          statePopulation={statePopulations[focusedState] || null}
          onClose={() => setShowListModal(false)}
          onChurchClick={(church) => {
            setShowListModal(false);
            if (focusedState) {
              navigateToChurch(focusedState, church.id);
            }
          }}
        />
      )}

      {/* Add church form (from summary disclaimer) */}
      {showAddChurchFromSummary && focusedState && (
        <AddChurchForm
          stateAbbrev={focusedState}
          stateName={focusedStateName}
          onClose={() => setShowAddChurchFromSummary(false)}
        />
      )}

      {/* Church detail panel */}
      {selectedChurch && (
        <div className="h-[55vh] md:h-full md:w-[380px] flex-shrink-0 overflow-hidden">
          <ChurchDetailPanel
            church={selectedChurch}
            allChurches={filteredChurches}
            onClose={() => {
              if (focusedState) {
                navigateToState(focusedState);
              } else {
                navigateToNational();
              }
            }}
            onChurchClick={(church) => {
              if (focusedState) {
                navigateToChurch(focusedState, church.id);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}