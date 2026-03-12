import { BOUNDS, BIG_COUNTRIES } from './countries';
import { normalizeDenomination, isBlockedDenomination, DMED } from './denominations';

// Overpass API endpoints
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Church object structure
export interface Church {
  id: string;
  name: string;
  lat: number;
  lng: number;
  denomination: string;
  attendance: number;
  state: string;
  city: string;
  address: string;
  website: string;
}

// OSM element types
interface OSMTags {
  name?: string;
  'name:en'?: string;
  denomination?: string;
  operator?: string;
  network?: string;
  brand?: string;
  description?: string;
  note?: string;
  official_name?: string;
  alt_name?: string;
  website?: string;
  'contact:website'?: string;
  'addr:street'?: string;
  'addr:housenumber'?: string;
  'addr:city'?: string;
  'addr:state'?: string;
  'addr:province'?: string;
  'addr:postcode'?: string;
  'addr:country'?: string;
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
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: OSMTags;
}

type OSMElement = OSMNode | OSMWay | OSMRelation;

interface OverpassResponse {
  elements: OSMElement[];
}

/**
 * Build an Overpass query for churches in a country using ISO3166-1 code
 */
export function buildCountryQuery(iso: string, timeout = 90): string {
  return `[out:json][timeout:${timeout}];area["ISO3166-1"="${iso}"]->.searchArea;(node["amenity"="place_of_worship"]["religion"="christian"](area.searchArea);way["amenity"="place_of_worship"]["religion"="christian"](area.searchArea);relation["amenity"="place_of_worship"]["religion"="christian"](area.searchArea););out geom 10000;`;
}

/**
 * Build an Overpass query for churches within a bounding box
 */
export function buildBboxQuery(
  south: number,
  west: number,
  north: number,
  east: number,
  timeout = 90
): string {
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:${timeout}];(node["amenity"="place_of_worship"]["religion"="christian"](${bbox});way["amenity"="place_of_worship"]["religion"="christian"](${bbox});relation["amenity"="place_of_worship"]["religion"="christian"](${bbox}););out geom 10000;`;
}

/**
 * Split a bounding box into 4 quadrants
 */
export function splitBoundsIntoQuadrants(
  bounds: [number, number, number, number]
): Array<[number, number, number, number]> {
  const [south, west, north, east] = bounds;
  const midLat = (south + north) / 2;
  const midLon = (west + east) / 2;

  return [
    [south, west, midLat, midLon], // SW quadrant
    [south, midLon, midLat, east], // SE quadrant
    [midLat, west, north, midLon], // NW quadrant
    [midLat, midLon, north, east], // NE quadrant
  ];
}

/**
 * Execute an Overpass query with fallback endpoints
 */
async function executeQuery(query: string): Promise<OverpassResponse> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as OverpassResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Overpass query failed on ${endpoint}:`, lastError.message);
    }
  }

  throw lastError || new Error('All Overpass endpoints failed');
}

/**
 * Calculate the area of a polygon in square feet using the Shoelace formula
 */
function calculatePolygonAreaSqFt(geometry: Array<{ lat: number; lon: number }>): number {
  if (!geometry || geometry.length < 3) return 0;

  // Convert to meters using approximate conversion at the polygon's center
  const centerLat = geometry.reduce((sum, p) => sum + p.lat, 0) / geometry.length;
  const latMetersPerDegree = 111320; // meters per degree of latitude
  const lonMetersPerDegree = 111320 * Math.cos((centerLat * Math.PI) / 180);

  // Convert coordinates to meters
  const metersCoords = geometry.map((p) => ({
    x: p.lon * lonMetersPerDegree,
    y: p.lat * latMetersPerDegree,
  }));

  // Shoelace formula for polygon area
  let area = 0;
  const n = metersCoords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += metersCoords[i].x * metersCoords[j].y;
    area -= metersCoords[j].x * metersCoords[i].y;
  }
  area = Math.abs(area) / 2;

  // Convert square meters to square feet (1 sq meter = 10.7639 sq feet)
  return area * 10.7639;
}

/**
 * Get geometry from an OSM element for area calculation
 */
function getElementGeometry(element: OSMElement): Array<{ lat: number; lon: number }> | null {
  if (element.type === 'way' && element.geometry) {
    return element.geometry;
  }

  if (element.type === 'relation' && element.members) {
    // For relations, try to find the outer ring
    const outerMembers = element.members.filter(
      (m) => m.role === 'outer' && m.geometry
    );
    if (outerMembers.length > 0 && outerMembers[0].geometry) {
      return outerMembers[0].geometry;
    }
    // Fall back to any member with geometry
    const memberWithGeom = element.members.find((m) => m.geometry);
    if (memberWithGeom?.geometry) {
      return memberWithGeom.geometry;
    }
  }

  return null;
}

/**
 * Calculate center point of an OSM element
 */
function getElementCenter(element: OSMElement): { lat: number; lng: number } | null {
  if (element.type === 'node') {
    return { lat: element.lat, lng: element.lon };
  }

  if (element.bounds) {
    return {
      lat: (element.bounds.minlat + element.bounds.maxlat) / 2,
      lng: (element.bounds.minlon + element.bounds.maxlon) / 2,
    };
  }

  const geometry = getElementGeometry(element);
  if (geometry && geometry.length > 0) {
    const lat = geometry.reduce((sum, p) => sum + p.lat, 0) / geometry.length;
    const lng = geometry.reduce((sum, p) => sum + p.lon, 0) / geometry.length;
    return { lat, lng };
  }

  return null;
}

/**
 * Estimate attendance based on building square footage
 * Rule of thumb: ~15-20 sq ft per person in a worship space
 * But only ~50-60% of building is actual worship space
 */
function estimateAttendanceFromSqFt(sqft: number): number {
  if (sqft <= 0) return 0;
  const worshipSpace = sqft * 0.55; // Estimate 55% is worship space
  const attendance = Math.round(worshipSpace / 17); // ~17 sq ft per person
  return Math.max(10, Math.min(attendance, 5000)); // Clamp between 10 and 5000
}

/**
 * Get the best attendance estimate for a church
 */
function estimateAttendance(
  sqft: number,
  denomination: string,
  tags: OSMTags
): number {
  // Check if there's an explicit capacity tag
  if (tags.capacity) {
    const cap = parseInt(tags.capacity, 10);
    if (!isNaN(cap) && cap > 0) {
      // Assume 70% capacity for typical attendance
      return Math.round(cap * 0.7);
    }
  }

  // Try to estimate from building size
  if (sqft > 100) {
    return estimateAttendanceFromSqFt(sqft);
  }

  // Fall back to denomination median
  return DMED[denomination] || DMED['Non-denominational'] || 100;
}

/**
 * Build address string from OSM tags
 */
function buildAddress(tags: OSMTags): string {
  const parts: string[] = [];

  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }

  if (tags['addr:city']) {
    parts.push(tags['addr:city']);
  }

  if (tags['addr:state'] || tags['addr:province']) {
    parts.push(tags['addr:state'] || tags['addr:province'] || '');
  }

  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }

  return parts.filter(Boolean).join(', ');
}

/**
 * Parse an OSM element into a Church object
 */
function parseElement(element: OSMElement): Church | null {
  const tags = element.tags || {};
  const center = getElementCenter(element);

  if (!center) return null;

  // Get name
  const name = tags.name || tags['name:en'] || '';
  if (!name) return null; // Skip churches without names

  // Get denomination and check if blocked
  const denomination = normalizeDenomination(tags);
  if (isBlockedDenomination(denomination)) return null;
  if (isBlockedDenomination(tags.denomination)) return null;

  // Calculate building area for ways/relations
  let sqft = 0;
  const geometry = getElementGeometry(element);
  if (geometry) {
    sqft = calculatePolygonAreaSqFt(geometry);
  }

  // Estimate attendance
  const attendance = estimateAttendance(sqft, denomination, tags);

  // Build church object (state will be set by the caller)
  return {
    id: String(element.id),
    name,
    lat: center.lat,
    lng: center.lng,
    denomination,
    attendance,
    state: '', // Set by caller
    city: tags['addr:city'] || '',
    address: buildAddress(tags),
    website: tags.website || tags['contact:website'] || '',
  };
}

/**
 * Fetch all churches for a country
 */
export async function fetchChurches(countryCode: string): Promise<Church[]> {
  const iso = countryCode.toUpperCase();
  const churches: Church[] = [];
  const seenIds = new Set<string>();

  let responses: OverpassResponse[];

  if (BIG_COUNTRIES.has(iso)) {
    // For big countries, split into quadrants to avoid truncation
    const bounds = BOUNDS[iso];
    if (!bounds) {
      throw new Error(`No bounds defined for country: ${iso}`);
    }

    const quadrants = splitBoundsIntoQuadrants(bounds);
    console.log(`Fetching ${iso} in 4 quadrants...`);

    responses = await Promise.all(
      quadrants.map(async ([south, west, north, east], i) => {
        console.log(`Fetching quadrant ${i + 1}/4 for ${iso}`);
        const query = buildBboxQuery(south, west, north, east);
        return executeQuery(query);
      })
    );
  } else {
    // For smaller countries, use a single area query
    const query = buildCountryQuery(iso);
    const response = await executeQuery(query);
    responses = [response];
  }

  // Parse all elements from all responses
  for (const response of responses) {
    for (const element of response.elements) {
      const church = parseElement(element);
      if (church && !seenIds.has(church.id)) {
        seenIds.add(church.id);
        churches.push(church);
      }
    }
  }

  console.log(`Fetched ${churches.length} churches for ${iso}`);
  return churches;
}

/**
 * Fetch churches within a specific bounding box
 */
export async function fetchChurchesInBbox(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<Church[]> {
  const query = buildBboxQuery(south, west, north, east);
  const response = await executeQuery(query);

  const churches: Church[] = [];
  const seenIds = new Set<string>();

  for (const element of response.elements) {
    const church = parseElement(element);
    if (church && !seenIds.has(church.id)) {
      seenIds.add(church.id);
      churches.push(church);
    }
  }

  return churches;
}
