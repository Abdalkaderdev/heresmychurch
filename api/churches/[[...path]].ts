import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ME, getCountry, POPULATIONS } from '../lib/countries';
import { fetchChurches } from '../lib/overpass';

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

function buildIndex(churches: Church[]) {
  return churches.map((c) => ({
    id: c.id,
    n: c.name || '',
    c: c.city || '',
    d: c.denomination || '',
    a: c.attendance || 0,
    ad: c.address || '',
    la: c.lat || 0,
    lo: c.lng || 0,
  }));
}

function extractStateFromId(churchId: string): string | null {
  if (churchId.startsWith('community-')) {
    const parts = churchId.split('-');
    if (parts.length >= 2) {
      return parts[1].toUpperCase();
    }
  }
  const match = churchId.match(/^([A-Z]{2})-/);
  if (match) {
    return match[1];
  }
  return null;
}

// ============================================================================
// Route Handlers
// ============================================================================

// GET /churches/states
async function handleStates(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

// GET /churches/search
async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawQuery = req.query.q;
    const q = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().toLowerCase();

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters', results: [], query: q || '' });
    }

    const rawState = req.query.state;
    const stateFilter = (Array.isArray(rawState) ? rawState[0] : rawState)?.toUpperCase();

    const rawPriorityStates = req.query.priorityStates;
    const priorityStatesStr = Array.isArray(rawPriorityStates) ? rawPriorityStates[0] : rawPriorityStates;
    const priorityStates = priorityStatesStr
      ? priorityStatesStr.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const rawLimit = req.query.limit;
    const limitStr = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
    let limit = limitStr ? parseInt(limitStr, 10) : 10;

    if (stateFilter) {
      limit = Math.min(Math.max(1, limit), 100);
    } else {
      limit = Math.min(Math.max(1, limit), 25);
    }

    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || { stateCounts: {} };
    const populatedStates = Object.keys(meta.stateCounts || {});

    let statesToSearch: string[];
    if (stateFilter) {
      if (!populatedStates.includes(stateFilter)) {
        return res.status(200).json({ results: [], query: q, statesSearched: 0 });
      }
      statesToSearch = [stateFilter];
    } else {
      const prioritySet = new Set(priorityStates);
      const priorityInPopulated = priorityStates.filter((s) => populatedStates.includes(s));
      const remaining = populatedStates.filter((s) => !prioritySet.has(s));
      statesToSearch = [...priorityInPopulated, ...remaining];
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

        const nameLower = name.toLowerCase();
        const cityLower = city.toLowerCase();
        const addressLower = address.toLowerCase();
        const denomLower = denomination.toLowerCase();

        const tokens = q.split(/\s+/).filter(Boolean);
        const hasMatch = tokens.some(
          (token) =>
            nameLower.includes(token) ||
            cityLower.includes(token) ||
            addressLower.includes(token) ||
            denomLower.includes(token)
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

      if (!stateFilter && results.length >= limit * 2) {
        break;
      }
    }

    results.sort((a, b) => b.score - a.score);

    const topResults: SearchResult[] = results.slice(0, limit).map(({ score, ...rest }) => rest);

    return res.status(200).json({
      results: topResults,
      query: q,
      statesSearched,
    });
  } catch (e) {
    console.error('Error searching churches:', e);
    return res.status(500).json({
      results: [],
      query: '',
      statesSearched: 0,
      error: String(e),
    });
  }
}

// GET /churches/[state]
async function handleGetByState(req: VercelRequest, res: VercelResponse, stateParam: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!stateParam || typeof stateParam !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid state parameter' });
    }

    const stateCode = stateParam.toUpperCase();
    const countryInfo = getCountry(stateCode);

    if (!countryInfo) {
      return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
    }

    const churches = await kv.get<Church[]>(`churches:${stateCode}`);

    if (!churches || churches.length === 0) {
      return res.status(200).json({
        churches: [],
        state: {
          abbrev: countryInfo.abbrev,
          name: countryInfo.name,
          lat: countryInfo.lat,
          lng: countryInfo.lng,
        },
        count: 0,
        fromCache: true,
        message: `No churches found for ${countryInfo.name}. POST to this endpoint to populate from OpenStreetMap.`,
      });
    }

    const churchesWithShortIds = churches.map((church) => ({
      ...church,
      shortId: toShortId(church.id, stateCode, church.shortId),
    }));

    return res.status(200).json({
      churches: churchesWithShortIds,
      state: {
        abbrev: countryInfo.abbrev,
        name: countryInfo.name,
        lat: countryInfo.lat,
        lng: countryInfo.lng,
      },
      count: churchesWithShortIds.length,
      fromCache: true,
    });
  } catch (e) {
    console.error('Error fetching churches:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// POST /churches/populate/[state]
async function handlePopulate(req: VercelRequest, res: VercelResponse, stateParam: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stateCode = stateParam;

  if (!stateCode) {
    return res.status(400).json({ error: 'State code is required' });
  }

  const country = getCountry(stateCode);
  if (!country) {
    return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
  }

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
      return res.status(200).json({
        message: `No churches found for ${stateCode}`,
        count: 0,
      });
    }

    const churches: Church[] = rawChurches.map((c: Church) => ({
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

    const searchIndex = buildIndex(churches);
    const searchIndexKey = `churches:sidx:${stateCode}`;
    await kv.set(searchIndexKey, searchIndex);

    return res.status(200).json({
      message: `Successfully populated ${country.name} with church data`,
      count: churches.length,
      state: stateCode,
      country: country.name,
    });
  } catch (e) {
    console.error(`Error populating churches for ${stateCode}:`, e);
    return res.status(500).json({
      error: 'Failed to populate churches',
      details: String(e),
    });
  }
}

// POST /churches/add
async function handleAdd(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    if (!countryInfo) {
      return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng coordinates are required' });
    }

    if (lat < -13 || lat > 43) {
      return res.status(400).json({
        error: `Latitude ${lat} is outside valid range (-13 to 43)`,
      });
    }

    if (lng < -18 || lng > 60) {
      return res.status(400).json({
        error: `Longitude ${lng} is outside valid range (-18 to 60)`,
      });
    }

    const existingChurches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const normalizedNewName = normalizeForComparison(body.name);
    const DUPLICATE_DISTANCE_KM = 0.5;

    for (const existing of existingChurches) {
      const normalizedExistingName = normalizeForComparison(existing.name);
      const distance = haversineDistance(lat, lng, existing.lat, existing.lng);

      if (normalizedNewName === normalizedExistingName && distance < DUPLICATE_DISTANCE_KM) {
        return res.status(409).json({
          error: 'A church with a similar name already exists at this location',
          existingChurch: {
            id: existing.id,
            name: existing.name,
            distance: Math.round(distance * 1000),
          },
        });
      }
    }

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];

    for (const pending of pendingChurches) {
      const normalizedPendingName = normalizeForComparison(pending.name);
      const distance = haversineDistance(lat, lng, pending.lat, pending.lng);

      if (normalizedPendingName === normalizedNewName && distance < DUPLICATE_DISTANCE_KM) {
        return res.status(409).json({
          error: 'A pending church submission with a similar name already exists at this location',
          pendingChurch: {
            id: pending.id,
            name: pending.name,
            distance: Math.round(distance * 1000),
          },
        });
      }
    }

    const id = generateId(stateCode);
    const shortId = generateShortId(id);

    const submittedBy =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';

    const church: Church = {
      id,
      shortId,
      name: body.name.trim(),
      address: body.address?.trim(),
      city: body.city?.trim(),
      state: stateCode,
      lat,
      lng,
      denomination: body.denomination?.trim(),
      attendance: body.attendance ? Number(body.attendance) : 0,
      website: body.website?.trim(),
      serviceTimes: Array.isArray(body.serviceTimes) ? body.serviceTimes : undefined,
      languages: Array.isArray(body.languages) ? body.languages : undefined,
      ministries: Array.isArray(body.ministries) ? body.ministries : undefined,
      pastorName: body.pastorName?.trim(),
      phone: body.phone?.trim(),
      email: body.email?.trim(),
      source: 'community',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      submittedBy,
      verifications: [],
    };

    const updatedPending = [...pendingChurches, church];
    await kv.set(`pending-churches:${stateCode}`, updatedPending);

    const updatedChurches = [...existingChurches, church];
    await kv.set(`churches:${stateCode}`, updatedChurches);

    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || {
      stateCounts: {},
    };
    meta.stateCounts[stateCode] = updatedChurches.length;
    await kv.set('churches:meta', meta);

    return res.status(201).json({
      success: true,
      church: {
        id: church.id,
        shortId: church.shortId,
        name: church.name,
        city: church.city,
        state: church.state,
        lat: church.lat,
        lng: church.lng,
        status: church.status,
        submittedAt: church.submittedAt,
      },
      message: 'Church submitted successfully. It will appear as pending until verified.',
    });
  } catch (e) {
    console.error('Error adding church:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// GET /churches/pending/[state]
async function handleGetPending(req: VercelRequest, res: VercelResponse, stateParam: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!stateParam || typeof stateParam !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid state parameter' });
    }

    const stateCode = stateParam.toUpperCase();
    const countryInfo = getCountry(stateCode);

    if (!countryInfo) {
      return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
    }

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];

    const stillPending = pendingChurches.filter((c) => c.status === 'pending');

    return res.status(200).json({
      churches: stillPending,
      state: {
        abbrev: countryInfo.abbrev,
        name: countryInfo.name,
        lat: countryInfo.lat,
        lng: countryInfo.lng,
      },
      count: stillPending.length,
    });
  } catch (e) {
    console.error('Error fetching pending churches:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// POST /churches/verify/[pendingId]
async function handleVerify(req: VercelRequest, res: VercelResponse, pendingId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!pendingId || typeof pendingId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid pendingId parameter' });
    }

    const parts = pendingId.split('-');
    if (parts.length < 4 || parts[0] !== 'community') {
      return res.status(400).json({ error: 'Invalid pending church ID format' });
    }

    const stateCode = parts[1].toUpperCase();

    const verifierIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const verifierHash = hashIp(verifierIp);

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];
    const churchIndex = pendingChurches.findIndex((c) => c.id === pendingId);

    if (churchIndex === -1) {
      return res.status(404).json({ error: 'Pending church not found' });
    }

    const church = pendingChurches[churchIndex];

    if (church.verifications?.includes(verifierHash)) {
      return res.status(409).json({
        error: 'You have already verified this church',
        verifications: church.verifications.length,
        required: VERIFICATIONS_REQUIRED,
      });
    }

    if (church.submittedBy && hashIp(church.submittedBy) === verifierHash) {
      return res.status(403).json({
        error: 'You cannot verify your own submission',
      });
    }

    church.verifications = church.verifications || [];
    church.verifications.push(verifierHash);
    church.lastVerified = new Date().toISOString();

    const isApproved = church.verifications.length >= VERIFICATIONS_REQUIRED;
    if (isApproved) {
      church.status = 'approved';
    }

    pendingChurches[churchIndex] = church;
    await kv.set(`pending-churches:${stateCode}`, pendingChurches);

    const allChurches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const mainIndex = allChurches.findIndex((c) => c.id === pendingId);

    if (mainIndex !== -1) {
      allChurches[mainIndex] = church;
      await kv.set(`churches:${stateCode}`, allChurches);
    }

    if (isApproved) {
      const stats = (await kv.get<Record<string, unknown>>('community:stats')) || {
        totalCorrections: 0,
        churchesImproved: [],
        totalConfirmations: 0,
        totalVerifications: 0,
        approvedChurches: 0,
        corrections: [],
        lastUpdated: null,
      };

      stats.approvedChurches = ((stats.approvedChurches as number) || 0) + 1;
      stats.lastUpdated = new Date().toISOString();
      await kv.set('community:stats', stats);
    }

    return res.status(200).json({
      success: true,
      church: {
        id: church.id,
        name: church.name,
        status: church.status,
        verifications: church.verifications.length,
        required: VERIFICATIONS_REQUIRED,
        lastVerified: church.lastVerified,
      },
      approved: isApproved,
      message: isApproved
        ? 'Church has been approved and is now fully visible'
        : `Verification recorded. ${VERIFICATIONS_REQUIRED - church.verifications.length} more verification(s) needed for approval.`,
    });
  } catch (e) {
    console.error('Error verifying church:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// POST /churches/confirm/[churchId]
async function handleConfirm(req: VercelRequest, res: VercelResponse, churchId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!churchId || typeof churchId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid churchId parameter' });
    }

    const stateCode = extractStateFromId(churchId);

    if (!stateCode) {
      return res.status(400).json({ error: 'Could not determine state from churchId' });
    }

    const confirmerIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const confirmerHash = hashIp(confirmerIp);

    const churches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const churchIndex = churches.findIndex((c) => c.id === churchId);

    if (churchIndex === -1) {
      return res.status(404).json({ error: 'Church not found' });
    }

    const church = churches[churchIndex];

    const confirmKey = `confirms:${churchId}`;
    const confirmations = (await kv.get<Confirmation[]>(confirmKey)) || [];

    const alreadyConfirmed = confirmations.some((c) => c.confirmerHash === confirmerHash);
    if (alreadyConfirmed) {
      return res.status(409).json({
        error: 'You have already confirmed this church',
        totalConfirmations: confirmations.length,
      });
    }

    const newConfirmation: Confirmation = {
      confirmerHash,
      timestamp: new Date().toISOString(),
    };
    confirmations.push(newConfirmation);
    await kv.set(confirmKey, confirmations);

    church.lastVerified = new Date().toISOString();
    churches[churchIndex] = church;
    await kv.set(`churches:${stateCode}`, churches);

    const stats = (await kv.get<Record<string, unknown>>('community:stats')) || {
      totalCorrections: 0,
      churchesImproved: [],
      totalConfirmations: 0,
      corrections: [],
      lastUpdated: null,
    };

    stats.totalConfirmations = ((stats.totalConfirmations as number) || 0) + 1;
    stats.lastUpdated = new Date().toISOString();
    await kv.set('community:stats', stats);

    return res.status(200).json({
      success: true,
      church: {
        id: church.id,
        name: church.name,
        lastVerified: church.lastVerified,
      },
      confirmations: confirmations.length,
      message: 'Thank you for confirming this church information is accurate.',
    });
  } catch (e) {
    console.error('Error confirming church:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// GET /churches/denominations/all
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
    const pathParam = req.query.path;
    const path = Array.isArray(pathParam) ? pathParam : pathParam ? [pathParam] : [];
    const route = path.join('/');

  // GET /churches/states
  if (route === 'states') {
    return handleStates(req, res);
  }

  // GET /churches/search
  if (route === 'search') {
    return handleSearch(req, res);
  }

  // POST /churches/add
  if (route === 'add') {
    return handleAdd(req, res);
  }

  // GET /churches/denominations/all
  if (route === 'denominations/all') {
    return handleDenominationsAll(req, res);
  }

  // POST /churches/populate/[state]
  if (path[0] === 'populate' && path.length === 2) {
    return handlePopulate(req, res, path[1].toUpperCase());
  }

  // GET /churches/pending/[state]
  if (path[0] === 'pending' && path.length === 2) {
    return handleGetPending(req, res, path[1]);
  }

  // POST /churches/verify/[pendingId]
  if (path[0] === 'verify' && path.length === 2) {
    return handleVerify(req, res, path[1]);
  }

  // POST /churches/confirm/[churchId]
  if (path[0] === 'confirm' && path.length === 2) {
    return handleConfirm(req, res, path[1]);
  }

  // GET /churches/[state] - single path segment that's not a reserved route
  if (path.length === 1 && !['states', 'search', 'add', 'populate', 'pending', 'verify', 'confirm', 'denominations'].includes(path[0])) {
    return handleGetByState(req, res, path[0]);
  }

  return res.status(404).json({ error: 'Not found', route });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
