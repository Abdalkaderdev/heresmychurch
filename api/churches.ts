import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// Countries Data (inlined from lib/countries.ts)
// ============================================================================

interface CountryInfo {
  abbrev: string;
  name: string;
  lat: number;
  lng: number;
}

const COUNTRIES: [string, string, number, number][] = [
  ["SA", "Saudi Arabia", 24.71, 46.68],
  ["AE", "United Arab Emirates", 24.47, 54.37],
  ["QA", "Qatar", 25.30, 51.18],
  ["KW", "Kuwait", 29.38, 47.99],
  ["BH", "Bahrain", 26.03, 50.55],
  ["OM", "Oman", 21.47, 55.98],
  ["JO", "Jordan", 31.24, 36.51],
  ["LB", "Lebanon", 33.85, 35.86],
  ["SY", "Syria", 34.80, 39.00],
  ["IQ", "Iraq", 33.22, 43.68],
  ["EG", "Egypt", 26.82, 30.80],
  ["LY", "Libya", 26.34, 17.23],
  ["TN", "Tunisia", 33.89, 9.54],
  ["DZ", "Algeria", 28.03, 1.66],
  ["MA", "Morocco", 31.79, -7.09],
  ["MR", "Mauritania", 21.01, -10.94],
  ["SD", "Sudan", 15.50, 32.56],
  ["YE", "Yemen", 15.55, 48.52],
  ["DJ", "Djibouti", 11.59, 42.59],
  ["KM", "Comoros", -11.88, 43.87],
  ["SO", "Somalia", 5.15, 46.20],
  ["PS", "Palestine", 31.95, 35.23],
  ["TR", "Turkey", 38.96, 35.24],
];

const ME: CountryInfo[] = COUNTRIES.map(([abbrev, name, lat, lng]) => ({
  abbrev,
  name,
  lat,
  lng,
}));

function getCountry(abbrev: string): CountryInfo | undefined {
  return ME.find(c => c.abbrev === abbrev.toUpperCase());
}

const BOUNDS: Record<string, [number, number, number, number]> = {
  SA: [16.38, 34.50, 32.16, 55.67],
  AE: [22.63, 51.50, 26.08, 56.38],
  QA: [24.47, 50.75, 26.15, 51.64],
  KW: [28.52, 46.55, 30.10, 48.43],
  BH: [25.79, 50.45, 26.29, 50.82],
  OM: [16.65, 52.00, 26.39, 59.84],
  JO: [29.19, 34.96, 33.37, 39.30],
  LB: [33.06, 35.10, 34.69, 36.62],
  SY: [32.31, 35.73, 37.32, 42.38],
  IQ: [29.06, 38.79, 37.38, 48.57],
  EG: [22.00, 24.70, 31.67, 36.90],
  LY: [19.50, 9.39, 33.17, 25.15],
  TN: [30.23, 7.52, 37.54, 11.60],
  DZ: [18.97, -8.67, 37.09, 11.98],
  MA: [27.67, -13.17, 35.92, -0.99],
  MR: [14.72, -17.07, 27.30, -4.83],
  SD: [8.68, 21.84, 22.23, 38.58],
  YE: [12.11, 42.55, 19.00, 54.53],
  DJ: [10.94, 41.77, 12.71, 43.42],
  KM: [-12.42, 43.23, -11.36, 44.54],
  SO: [-1.66, 40.99, 11.98, 51.41],
  PS: [31.22, 34.22, 32.55, 35.57],
  TR: [35.82, 25.67, 42.11, 44.82],
};

const BIG_COUNTRIES = new Set(["EG", "SA", "DZ", "SD", "TR", "LY", "IQ", "MA"]);

const POPULATIONS: Record<string, number> = {
  SA: 36400000, AE: 9440000, QA: 2700000, KW: 4300000, BH: 1500000,
  OM: 4600000, JO: 11300000, LB: 5500000, SY: 22100000, IQ: 44500000,
  EG: 109300000, LY: 6900000, TN: 12400000, DZ: 45600000, MA: 37100000,
  MR: 4900000, SD: 46700000, YE: 33700000, DJ: 1100000, KM: 900000,
  SO: 17600000, PS: 5300000, TR: 85300000,
};

// ============================================================================
// Denominations (inlined from lib/denominations.ts)
// ============================================================================

type DenomRule = [string, string[]?, string?, string[]?];

const DENOM_RULES: DenomRule[] = [
  ["Coptic Orthodox", ["coptic orthodox", "coptic_orthodox"]],
  ["Coptic Orthodox", , "\\b(coptic|قبطي)\\b", ["catholic"]],
  ["Greek Orthodox", ["greek orthodox", "greek_orthodox", "rum orthodox"]],
  ["Greek Orthodox", , "\\brum\\b", ["catholic"]],
  ["Armenian Apostolic", ["armenian apostolic", "armenian_apostolic", "armenian orthodox"]],
  ["Armenian Apostolic", , "\\barmenian\\b", ["catholic"]],
  ["Syriac Orthodox", ["syriac orthodox", "syrian orthodox", "syriac_orthodox"]],
  ["Antiochian Orthodox", ["antiochian", "antioch orthodox"]],
  ["Ethiopian Orthodox", ["ethiopian orthodox", "ethiopian_orthodox"]],
  ["Eritrean Orthodox", ["eritrean orthodox", "eritrean_orthodox"]],
  ["Orthodox", ["orthodox"]],
  ["Maronite Catholic", ["maronite"]],
  ["Melkite Catholic", ["melkite", "melkite greek catholic"]],
  ["Chaldean Catholic", ["chaldean"]],
  ["Coptic Catholic", ["coptic catholic"]],
  ["Armenian Catholic", ["armenian catholic"]],
  ["Syriac Catholic", ["syriac catholic", "syrian catholic"]],
  ["Catholic", ["catholic", "roman_catholic"]],
  ["Catholic", , "\\b(parish|basilica|sacred heart|immaculate|our lady|blessed sacrament|holy (family|cross|spirit|trinity|rosary|name|redeemer))\\b", ["orthodox", "maronite", "melkite", "chaldean", "coptic", "armenian", "syriac"]],
  ["Assyrian Church of the East", ["assyrian church", "church of the east"]],
  ["Assyrian Church of the East", , "\\bassyrian\\b", ["catholic"]],
  ["Anglican", ["anglican", "episcopal", "church of england"]],
  ["Lutheran", ["lutheran"]],
  ["Presbyterian", ["presbyterian"]],
  ["Methodist", ["methodist", "wesleyan"]],
  ["Baptist", ["baptist"]],
  ["Assemblies of God", ["assemblies of god", "assembly of god"]],
  ["Pentecostal", ["pentecostal", "foursquare", "full gospel"]],
  ["Evangelical", ["evangelical", "bible church"]],
  ["Seventh-day Adventist", ["seventh", "adventist", "sda"]],
  ["Non-denominational", ["nondenominational", "non-denominational", "community church", "international church", "fellowship"]],
  ["Non-denominational", , "\\b(international|expat|fellowship|worship center)\\b"],
  ["Salvation Army", ["salvation army"]],
];

interface CompiledRule {
  result: string;
  includes?: string[];
  excludes?: string[];
  regex: RegExp | null;
}

let compiledRules: CompiledRule[] = [];

function getCompiledRules(): CompiledRule[] {
  if (compiledRules.length) return compiledRules;
  compiledRules = DENOM_RULES.map(([result, includes, pattern, excludes]) => ({
    result,
    includes,
    excludes: excludes ? (typeof excludes === "string" ? excludes.split(",") : excludes) : undefined,
    regex: pattern ? new RegExp(pattern, "i") : null,
  }));
  return compiledRules;
}

function matchDenomination(text: string): string | null {
  const lower = text.toLowerCase().replace(/[''ʼ]/g, "'").replace(/[‐–—]/g, "-");
  for (const { result, includes, excludes, regex } of getCompiledRules()) {
    if (excludes && excludes.some(e => lower.includes(e))) continue;
    if (includes && includes.some(inc => lower.includes(inc))) {
      if (regex) {
        if (regex.test(lower)) return result;
      } else {
        return result;
      }
      continue;
    }
    if (regex && !includes && regex.test(lower)) return result;
  }
  return null;
}

function normalizeDenomination(tags: Record<string, string | undefined>): string {
  if (tags.denomination) {
    const m = matchDenomination(tags.denomination);
    if (m) return m;
    const c = tags.denomination.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()).substring(0, 40);
    if (c && c !== "Unknown" && c !== "Other") return c;
  }
  for (const k of ["operator", "network"]) {
    if (tags[k]) {
      const m = matchDenomination(tags[k]!);
      if (m) return m;
    }
  }
  if (tags.brand) {
    const m = matchDenomination(tags.brand);
    if (m) return m;
  }
  const name = tags.name || tags["name:en"] || "";
  if (name) {
    const m = matchDenomination(name);
    if (m) return m;
  }
  return "Non-denominational";
}

const DMED: Record<string, number> = {
  "Coptic Orthodox": 150, "Greek Orthodox": 100, "Armenian Apostolic": 80,
  "Syriac Orthodox": 60, "Antiochian Orthodox": 80, "Ethiopian Orthodox": 100,
  "Orthodox": 80, "Maronite Catholic": 200, "Melkite Catholic": 100,
  "Chaldean Catholic": 80, "Catholic": 150, "Assyrian Church of the East": 50,
  "Anglican": 80, "Lutheran": 60, "Presbyterian": 60, "Methodist": 50,
  "Baptist": 70, "Assemblies of God": 100, "Pentecostal": 80,
  "Evangelical": 100, "Seventh-day Adventist": 40, "Non-denominational": 120,
};

const BLOCKED_KEYWORDS = ["latter-day saints", "mormon", "jehovah", "unitarian", "christian science"];

function isBlockedDenomination(denomination: string | undefined | null): boolean {
  if (!denomination) return false;
  const l = denomination.toLowerCase();
  return BLOCKED_KEYWORDS.some(k => l.includes(k));
}

// ============================================================================
// Overpass API (inlined from lib/overpass.ts)
// ============================================================================

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OSMTags {
  name?: string;
  'name:en'?: string;
  denomination?: string;
  operator?: string;
  network?: string;
  brand?: string;
  website?: string;
  'contact:website'?: string;
  'addr:street'?: string;
  'addr:housenumber'?: string;
  'addr:city'?: string;
  'addr:state'?: string;
  'addr:province'?: string;
  'addr:postcode'?: string;
  capacity?: string;
  [key: string]: string | undefined;
}

interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: OSMTags;
}

interface OSMWay {
  type: 'way';
  id: number;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: OSMTags;
}

interface OSMRelation {
  type: 'relation';
  id: number;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  members?: Array<{ type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }>; }>;
  tags?: OSMTags;
}

type OSMElement = OSMNode | OSMWay | OSMRelation;

function buildCountryQuery(iso: string, timeout = 90): string {
  return `[out:json][timeout:${timeout}];area["ISO3166-1"="${iso}"]->.searchArea;(node["amenity"="place_of_worship"]["religion"="christian"](area.searchArea);way["amenity"="place_of_worship"]["religion"="christian"](area.searchArea);relation["amenity"="place_of_worship"]["religion"="christian"](area.searchArea););out geom 10000;`;
}

function buildBboxQuery(south: number, west: number, north: number, east: number, timeout = 90): string {
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:${timeout}];(node["amenity"="place_of_worship"]["religion"="christian"](${bbox});way["amenity"="place_of_worship"]["religion"="christian"](${bbox});relation["amenity"="place_of_worship"]["religion"="christian"](${bbox}););out geom 10000;`;
}

function splitBoundsIntoQuadrants(bounds: [number, number, number, number]): Array<[number, number, number, number]> {
  const [south, west, north, east] = bounds;
  const midLat = (south + north) / 2;
  const midLon = (west + east) / 2;
  return [
    [south, west, midLat, midLon],
    [south, midLon, midLat, east],
    [midLat, west, north, midLon],
    [midLat, midLon, north, east],
  ];
}

async function executeOverpassQuery(query: string): Promise<{ elements: OSMElement[] }> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('All Overpass endpoints failed');
}

function getElementCenter(element: OSMElement): { lat: number; lng: number } | null {
  if (element.type === 'node') return { lat: element.lat, lng: element.lon };
  if (element.bounds) {
    return {
      lat: (element.bounds.minlat + element.bounds.maxlat) / 2,
      lng: (element.bounds.minlon + element.bounds.maxlon) / 2,
    };
  }
  return null;
}

function buildAddress(tags: OSMTags): string {
  const parts: string[] = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.filter(Boolean).join(', ');
}

interface OverpassChurch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  denomination: string;
  attendance: number;
  city: string;
  address: string;
  website: string;
}

function parseOSMElement(element: OSMElement): OverpassChurch | null {
  const tags = element.tags || {};
  const center = getElementCenter(element);
  if (!center) return null;

  const name = tags.name || tags['name:en'] || '';
  if (!name) return null;

  const denomination = normalizeDenomination(tags);
  if (isBlockedDenomination(denomination)) return null;
  if (isBlockedDenomination(tags.denomination)) return null;

  const attendance = DMED[denomination] || 100;

  return {
    id: String(element.id),
    name,
    lat: center.lat,
    lng: center.lng,
    denomination,
    attendance,
    city: tags['addr:city'] || '',
    address: buildAddress(tags),
    website: tags.website || tags['contact:website'] || '',
  };
}

async function fetchChurches(countryCode: string): Promise<OverpassChurch[]> {
  const iso = countryCode.toUpperCase();
  const churches: OverpassChurch[] = [];
  const seenIds = new Set<string>();

  let responses: { elements: OSMElement[] }[];

  if (BIG_COUNTRIES.has(iso)) {
    const bounds = BOUNDS[iso];
    if (!bounds) throw new Error(`No bounds defined for country: ${iso}`);
    const quadrants = splitBoundsIntoQuadrants(bounds);
    responses = await Promise.all(
      quadrants.map(([south, west, north, east]) => {
        const query = buildBboxQuery(south, west, north, east);
        return executeOverpassQuery(query);
      })
    );
  } else {
    const query = buildCountryQuery(iso);
    const response = await executeOverpassQuery(query);
    responses = [response];
  }

  for (const response of responses) {
    for (const element of response.elements) {
      const church = parseOSMElement(element);
      if (church && !seenIds.has(church.id)) {
        seenIds.add(church.id);
        churches.push(church);
      }
    }
  }

  return churches;
}

// ============================================================================
// Types
// ============================================================================

interface Church {
  id: string;
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
  serviceTimes?: string[];
  languages?: string[];
  ministries?: string[];
  pastorName?: string;
  phone?: string;
  email?: string;
  source?: 'community';
  status?: 'pending' | 'approved';
  submittedAt?: string;
  submittedBy?: string;
  verifications?: string[];
  lastVerified?: string;
  [key: string]: unknown;
}

interface SearchResult {
  id: string;
  shortId?: string;
  name: string;
  city: string;
  state: string;
  denomination: string;
  attendance: number;
  lat: number;
  lng: number;
  address: string;
}

interface ScoredResult extends SearchResult {
  score: number;
}

interface Confirmation {
  confirmerHash: string;
  timestamp: string;
}

// ============================================================================
// Shared Utilities
// ============================================================================

const NATIONAL_AVG_POP = Object.values(POPULATIONS).reduce((a, b) => a + b, 0) / Object.keys(POPULATIONS).length;
const VERIFICATIONS_REQUIRED = 3;

function toShortId(id: string, state: string, existingShortId?: string): string {
  if (existingShortId && /^\d{8}$/.test(existingShortId)) return existingShortId;
  const statePrefix = `${state.toUpperCase()}-`;
  if (id.startsWith(statePrefix)) {
    const numPart = id.slice(statePrefix.length);
    if (/^\d+$/.test(numPart)) {
      return numPart.length >= 8 ? numPart.slice(0, 8) : numPart.padStart(8, '0');
    }
  }
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h).toString().padStart(8, '0').slice(0, 8);
}

function generateId(state: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `community-${state.toUpperCase()}-${timestamp}-${random}`;
}

function generateShortId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString().padStart(8, '0').slice(0, 8);
}

function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function scoreMatch(q: string, name: string, city: string, address: string): number {
  const tokens = q.split(/\s+/).filter(Boolean);
  const n = name.toLowerCase(),
    c = city.toLowerCase(),
    a = address.toLowerCase();
  let s = 0;
  if (n.includes(q)) s += 1000;
  const inName = tokens.filter((t) => n.includes(t));
  if (inName.length === tokens.length) s += 500;
  if (tokens.length > 0 && n.startsWith(tokens[0])) s += 300;
  s += inName.length * 50;
  for (const t of tokens) if (c.includes(t) || a.includes(t)) s += 30;
  return s;
}

function applyStateScaling(churches: Church[], state: string): void {
  const statePop = POPULATIONS[state] || NATIONAL_AVG_POP;
  const factor = Math.min(1.2, Math.pow(statePop / NATIONAL_AVG_POP, 0.12));
  for (const c of churches) {
    c.attendance = Math.max(10, Math.min(Math.round((c.attendance || 10) * factor), 25000));
  }
}

function extractStateFromId(churchId: string): string | null {
  if (churchId.startsWith('community-')) {
    const parts = churchId.split('-');
    if (parts.length >= 2) return parts[1].toUpperCase();
  }
  const match = churchId.match(/^([A-Z]{2})-/);
  if (match) return match[1];
  return null;
}

// ============================================================================
// Route Handlers
// ============================================================================

async function handleStates(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || { stateCounts: {} };
    const sc = meta.stateCounts || {};

    const states = ME.map((s) => ({
      abbrev: s.abbrev,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      churchCount: sc[s.abbrev] || 0,
      isPopulated: !!sc[s.abbrev],
    }));

    const totalChurches = Object.values(sc).reduce((a, b) => a + b, 0);

    return res.status(200).json({
      states,
      totalChurches,
      populatedStates: Object.keys(sc).length,
    });
  } catch (e) {
    console.error('Error fetching states:', e);
    return res.status(500).json({ states: [], totalChurches: 0, populatedStates: 0, error: String(e) });
  }
}

async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawQuery = req.query.q;
    const q = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().toLowerCase();

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters', results: [], query: q || '' });
    }

    const rawState = req.query.state;
    const stateFilter = (Array.isArray(rawState) ? rawState[0] : rawState)?.toUpperCase();

    const rawLimit = req.query.limit;
    const limitStr = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
    let limit = limitStr ? parseInt(limitStr, 10) : 10;
    limit = Math.min(Math.max(1, limit), stateFilter ? 100 : 25);

    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || { stateCounts: {} };
    const populatedStates = Object.keys(meta.stateCounts || {});

    let statesToSearch: string[];
    if (stateFilter) {
      if (!populatedStates.includes(stateFilter)) {
        return res.status(200).json({ results: [], query: q, statesSearched: 0 });
      }
      statesToSearch = [stateFilter];
    } else {
      statesToSearch = populatedStates;
    }

    const results: ScoredResult[] = [];
    let statesSearched = 0;

    for (const state of statesToSearch) {
      const churches = await kv.get<Church[]>(`churches:${state}`);
      if (!churches || !Array.isArray(churches)) continue;
      statesSearched++;

      for (const church of churches) {
        const name = church.name || '';
        const city = church.city || '';
        const address = church.address || '';
        const denomination = church.denomination || '';

        const tokens = q.split(/\s+/).filter(Boolean);
        const hasMatch = tokens.some(
          (token) =>
            name.toLowerCase().includes(token) ||
            city.toLowerCase().includes(token) ||
            address.toLowerCase().includes(token) ||
            denomination.toLowerCase().includes(token)
        );

        if (hasMatch) {
          const score = scoreMatch(q, name, city, address);
          results.push({
            id: church.id,
            shortId: church.shortId,
            name,
            city,
            state: church.state,
            denomination,
            attendance: church.attendance || 0,
            lat: church.lat,
            lng: church.lng,
            address,
            score,
          });
        }
      }

      if (!stateFilter && results.length >= limit * 2) break;
    }

    results.sort((a, b) => b.score - a.score);
    const topResults: SearchResult[] = results.slice(0, limit).map(({ score, ...rest }) => rest);

    return res.status(200).json({ results: topResults, query: q, statesSearched });
  } catch (e) {
    console.error('Error searching churches:', e);
    return res.status(500).json({ results: [], query: '', statesSearched: 0, error: String(e) });
  }
}

async function handleGetByState(req: VercelRequest, res: VercelResponse, stateParam: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stateCode = stateParam.toUpperCase();
    const countryInfo = getCountry(stateCode);

    if (!countryInfo) {
      return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
    }

    const churches = await kv.get<Church[]>(`churches:${stateCode}`);

    if (!churches || churches.length === 0) {
      return res.status(200).json({
        churches: [],
        state: { abbrev: countryInfo.abbrev, name: countryInfo.name, lat: countryInfo.lat, lng: countryInfo.lng },
        count: 0,
        fromCache: true,
        message: `No churches found for ${countryInfo.name}. POST to /api/churches/populate/${stateCode} to populate from OpenStreetMap.`,
      });
    }

    const churchesWithShortIds = churches.map((church) => ({
      ...church,
      shortId: toShortId(church.id, stateCode, church.shortId),
    }));

    return res.status(200).json({
      churches: churchesWithShortIds,
      state: { abbrev: countryInfo.abbrev, name: countryInfo.name, lat: countryInfo.lat, lng: countryInfo.lng },
      count: churchesWithShortIds.length,
      fromCache: true,
    });
  } catch (e) {
    console.error('Error fetching churches:', e);
    return res.status(500).json({ error: String(e) });
  }
}

async function handlePopulate(req: VercelRequest, res: VercelResponse, stateParam: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stateCode = stateParam.toUpperCase();
  const country = getCountry(stateCode);
  if (!country) return res.status(400).json({ error: `Invalid country code: ${stateCode}` });

  const churchesKey = `churches:${stateCode}`;
  const forcePopulate = req.query.force === 'true';

  try {
    if (!forcePopulate) {
      const existing = await kv.get(churchesKey);
      if (existing) {
        return res.status(200).json({
          message: `Country ${stateCode} is already populated`,
          alreadyPopulated: true,
          count: Array.isArray(existing) ? existing.length : 0,
        });
      }
    }

    const rawChurches = await fetchChurches(stateCode);

    if (!rawChurches || rawChurches.length === 0) {
      return res.status(200).json({ message: `No churches found for ${stateCode}`, count: 0 });
    }

    const churches: Church[] = rawChurches.map((c) => ({
      ...c,
      id: `${stateCode}-${c.id}`,
      state: stateCode,
    }));

    applyStateScaling(churches, stateCode);
    await kv.set(churchesKey, churches);

    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || { stateCounts: {} };
    meta.stateCounts = meta.stateCounts || {};
    meta.stateCounts[stateCode] = churches.length;
    await kv.set('churches:meta', meta);

    return res.status(200).json({
      message: `Successfully populated ${country.name} with church data`,
      count: churches.length,
      state: stateCode,
      country: country.name,
    });
  } catch (e) {
    console.error(`Error populating churches for ${stateCode}:`, e);
    return res.status(500).json({ error: 'Failed to populate churches', details: String(e) });
  }
}

async function handleAdd(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!body.state || typeof body.state !== 'string') {
      return res.status(400).json({ error: 'State (country code) is required' });
    }

    const stateCode = body.state.toUpperCase();
    const countryInfo = getCountry(stateCode);
    if (!countryInfo) return res.status(400).json({ error: `Invalid country code: ${stateCode}` });

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Valid lat and lng coordinates are required' });

    const existingChurches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const normalizedNewName = normalizeForComparison(body.name);
    const DUPLICATE_DISTANCE_KM = 0.5;

    for (const existing of existingChurches) {
      const normalizedExistingName = normalizeForComparison(existing.name);
      const distance = haversineDistance(lat, lng, existing.lat, existing.lng);
      if (normalizedNewName === normalizedExistingName && distance < DUPLICATE_DISTANCE_KM) {
        return res.status(409).json({
          error: 'A church with a similar name already exists at this location',
          existingChurch: { id: existing.id, name: existing.name, distance: Math.round(distance * 1000) },
        });
      }
    }

    const id = generateId(stateCode);
    const shortId = generateShortId(id);
    const submittedBy = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';

    const church: Church = {
      id,
      shortId,
      name: body.name.trim(),
      address: body.address?.trim(),
      city: body.city?.trim(),
      state: stateCode,
      lat,
      lng,
      denomination: body.denomination?.trim() || 'Non-denominational',
      attendance: body.attendance ? Number(body.attendance) : 0,
      website: body.website?.trim(),
      source: 'community',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      submittedBy,
      verifications: [],
    };

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];
    await kv.set(`pending-churches:${stateCode}`, [...pendingChurches, church]);

    const updatedChurches = [...existingChurches, church];
    await kv.set(`churches:${stateCode}`, updatedChurches);

    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || { stateCounts: {} };
    meta.stateCounts[stateCode] = updatedChurches.length;
    await kv.set('churches:meta', meta);

    return res.status(201).json({
      success: true,
      church: { id, shortId, name: church.name, city: church.city, state: church.state, lat, lng, status: 'pending' },
      message: 'Church submitted successfully. It will appear as pending until verified.',
    });
  } catch (e) {
    console.error('Error adding church:', e);
    return res.status(500).json({ error: String(e) });
  }
}

async function handleGetPending(req: VercelRequest, res: VercelResponse, stateParam: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stateCode = stateParam.toUpperCase();
    const countryInfo = getCountry(stateCode);
    if (!countryInfo) return res.status(400).json({ error: `Invalid country code: ${stateCode}` });

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];
    const stillPending = pendingChurches.filter((c) => c.status === 'pending');

    return res.status(200).json({
      churches: stillPending,
      state: { abbrev: countryInfo.abbrev, name: countryInfo.name, lat: countryInfo.lat, lng: countryInfo.lng },
      count: stillPending.length,
    });
  } catch (e) {
    console.error('Error fetching pending churches:', e);
    return res.status(500).json({ error: String(e) });
  }
}

async function handleVerify(req: VercelRequest, res: VercelResponse, pendingId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const parts = pendingId.split('-');
    if (parts.length < 4 || parts[0] !== 'community') {
      return res.status(400).json({ error: 'Invalid pending church ID format' });
    }

    const stateCode = parts[1].toUpperCase();
    const verifierIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    const verifierHash = hashIp(verifierIp);

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];
    const churchIndex = pendingChurches.findIndex((c) => c.id === pendingId);
    if (churchIndex === -1) return res.status(404).json({ error: 'Pending church not found' });

    const church = pendingChurches[churchIndex];
    if (church.verifications?.includes(verifierHash)) {
      return res.status(409).json({ error: 'You have already verified this church' });
    }

    church.verifications = church.verifications || [];
    church.verifications.push(verifierHash);
    church.lastVerified = new Date().toISOString();

    const isApproved = church.verifications.length >= VERIFICATIONS_REQUIRED;
    if (isApproved) church.status = 'approved';

    pendingChurches[churchIndex] = church;
    await kv.set(`pending-churches:${stateCode}`, pendingChurches);

    const allChurches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const mainIndex = allChurches.findIndex((c) => c.id === pendingId);
    if (mainIndex !== -1) {
      allChurches[mainIndex] = church;
      await kv.set(`churches:${stateCode}`, allChurches);
    }

    return res.status(200).json({
      success: true,
      church: { id: church.id, name: church.name, status: church.status, verifications: church.verifications.length },
      approved: isApproved,
      message: isApproved
        ? 'Church has been approved'
        : `Verification recorded. ${VERIFICATIONS_REQUIRED - church.verifications.length} more needed.`,
    });
  } catch (e) {
    console.error('Error verifying church:', e);
    return res.status(500).json({ error: String(e) });
  }
}

async function handleConfirm(req: VercelRequest, res: VercelResponse, churchId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stateCode = extractStateFromId(churchId);
    if (!stateCode) return res.status(400).json({ error: 'Could not determine state from churchId' });

    const confirmerIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    const confirmerHash = hashIp(confirmerIp);

    const churches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const churchIndex = churches.findIndex((c) => c.id === churchId);
    if (churchIndex === -1) return res.status(404).json({ error: 'Church not found' });

    const church = churches[churchIndex];
    const confirmKey = `confirms:${churchId}`;
    const confirmations = (await kv.get<Confirmation[]>(confirmKey)) || [];

    if (confirmations.some((c) => c.confirmerHash === confirmerHash)) {
      return res.status(409).json({ error: 'You have already confirmed this church' });
    }

    confirmations.push({ confirmerHash, timestamp: new Date().toISOString() });
    await kv.set(confirmKey, confirmations);

    church.lastVerified = new Date().toISOString();
    churches[churchIndex] = church;
    await kv.set(`churches:${stateCode}`, churches);

    return res.status(200).json({
      success: true,
      church: { id: church.id, name: church.name, lastVerified: church.lastVerified },
      confirmations: confirmations.length,
      message: 'Thank you for confirming this church information is accurate.',
    });
  } catch (e) {
    console.error('Error confirming church:', e);
    return res.status(500).json({ error: String(e) });
  }
}

async function handleDenominationsAll(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const meta = await kv.get<{ stateCounts: Record<string, number> }>('churches:meta');
    const populatedStates = Object.keys(meta?.stateCounts || {});

    const denomCounts: Record<string, number> = {};

    for (const state of populatedStates) {
      const churches = await kv.get<Church[]>(`churches:${state}`);
      if (Array.isArray(churches)) {
        for (const church of churches) {
          const denom = church.denomination || 'Unknown';
          denomCounts[denom] = (denomCounts[denom] || 0) + 1;
        }
      }
    }

    const denominations = Object.entries(denomCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return res.status(200).json({ denominations });
  } catch (e) {
    return res.status(500).json({ denominations: [], error: String(e) });
  }
}

// ============================================================================
// Main Router
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse path from query string (rewrite passes it as string like "states" or "populate/LB")
    const pathParam = req.query.path;
    const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
    const path = pathStr ? pathStr.split('/').filter(Boolean) : [];
    const route = path.join('/');

    if (route === 'states') return handleStates(req, res);
    if (route === 'search') return handleSearch(req, res);
    if (route === 'add') return handleAdd(req, res);
    if (route === 'denominations/all') return handleDenominationsAll(req, res);
    if (path[0] === 'populate' && path.length === 2) return handlePopulate(req, res, path[1]);
    if (path[0] === 'pending' && path.length === 2) return handleGetPending(req, res, path[1]);
    if (path[0] === 'verify' && path.length === 2) return handleVerify(req, res, path[1]);
    if (path[0] === 'confirm' && path.length === 2) return handleConfirm(req, res, path[1]);

    if (path.length === 1 && !['states', 'search', 'add', 'populate', 'pending', 'verify', 'confirm', 'denominations'].includes(path[0])) {
      return handleGetByState(req, res, path[0]);
    }

    return res.status(404).json({ error: 'Not found', route });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: String(error),
    });
  }
}
