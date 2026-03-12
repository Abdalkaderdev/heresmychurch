import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// Types
// ============================================================================

interface Submission {
  ip: string;
  field: string;
  value: string;
  timestamp: number;
}

interface SuggestionEntry {
  churchId: string;
  submissions: Submission[];
}

interface FieldConsensus {
  approved: boolean;
  value: string;
  votes: number;
  needed: number;
  submissions?: Submission[];
  submissionCount?: number;
}

interface ApprovedCorrection {
  churchId: string;
  field: string;
  value: string;
  votes: number;
}

interface PendingCorrection {
  churchId: string;
  field: string;
  value: string;
  votes: number;
  needed: number;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_FIELDS = [
  'name',
  'website',
  'address',
  'attendance',
  'denomination',
  'serviceTimes',
  'languages',
  'ministries',
  'pastorName',
  'phone',
  'email',
  'homeCampusId',
];

const THRESHOLD = 1;

// ============================================================================
// Shared Utilities
// ============================================================================

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(',')[0].trim();
  return 'unknown';
}

function consensus(submissions: Submission[]): Record<string, FieldConsensus> {
  const byField: Record<string, Submission[]> = {};

  for (const sub of submissions) {
    if (!byField[sub.field]) {
      byField[sub.field] = [];
    }
    byField[sub.field].push(sub);
  }

  const result: Record<string, FieldConsensus> = {};

  for (const field of Object.keys(byField)) {
    const fieldSubmissions = byField[field];

    const valueVotes: Record<string, Set<string>> = {};

    for (const sub of fieldSubmissions) {
      const valueKey = JSON.stringify(sub.value);
      if (!valueVotes[valueKey]) {
        valueVotes[valueKey] = new Set();
      }
      valueVotes[valueKey].add(sub.ip);
    }

    let bestValue = '';
    let bestVotes = 0;

    for (const [valueKey, ips] of Object.entries(valueVotes)) {
      if (ips.size > bestVotes) {
        bestVotes = ips.size;
        bestValue = JSON.parse(valueKey);
      }
    }

    result[field] = {
      approved: bestVotes >= THRESHOLD,
      value: bestValue,
      votes: bestVotes,
      needed: THRESHOLD,
      submissions: fieldSubmissions,
      submissionCount: fieldSubmissions.length,
    };
  }

  return result;
}

function getApprovedCorrections(entry: SuggestionEntry): ApprovedCorrection[] {
  const submissions = entry.submissions;
  const byField: Record<string, Submission[]> = {};

  for (const sub of submissions) {
    if (!byField[sub.field]) {
      byField[sub.field] = [];
    }
    byField[sub.field].push(sub);
  }

  const approved: ApprovedCorrection[] = [];

  for (const field of Object.keys(byField)) {
    const fieldSubmissions = byField[field];

    const valueVotes: Record<string, Set<string>> = {};

    for (const sub of fieldSubmissions) {
      const valueKey = JSON.stringify(sub.value);
      if (!valueVotes[valueKey]) {
        valueVotes[valueKey] = new Set();
      }
      valueVotes[valueKey].add(sub.ip);
    }

    let bestValue = '';
    let bestVotes = 0;

    for (const [valueKey, ips] of Object.entries(valueVotes)) {
      if (ips.size > bestVotes) {
        bestVotes = ips.size;
        bestValue = JSON.parse(valueKey);
      }
    }

    if (bestVotes >= THRESHOLD) {
      approved.push({
        churchId: entry.churchId,
        field,
        value: bestValue,
        votes: bestVotes,
      });
    }
  }

  return approved;
}

function getPendingCorrections(entry: SuggestionEntry): PendingCorrection[] {
  const submissions = entry.submissions;
  const byField: Record<string, Submission[]> = {};

  for (const sub of submissions) {
    if (!byField[sub.field]) {
      byField[sub.field] = [];
    }
    byField[sub.field].push(sub);
  }

  const pending: PendingCorrection[] = [];

  for (const field of Object.keys(byField)) {
    const fieldSubmissions = byField[field];

    const valueVotes: Record<string, Set<string>> = {};

    for (const sub of fieldSubmissions) {
      const valueKey = JSON.stringify(sub.value);
      if (!valueVotes[valueKey]) {
        valueVotes[valueKey] = new Set();
      }
      valueVotes[valueKey].add(sub.ip);
    }

    let bestValue = '';
    let bestVotes = 0;

    for (const [valueKey, ips] of Object.entries(valueVotes)) {
      if (ips.size > bestVotes) {
        bestVotes = ips.size;
        bestValue = JSON.parse(valueKey);
      }
    }

    if (bestVotes < THRESHOLD) {
      pending.push({
        churchId: entry.churchId,
        field,
        value: bestValue,
        votes: bestVotes,
        needed: THRESHOLD,
      });
    }
  }

  return pending;
}

// ============================================================================
// Route Handlers
// ============================================================================

// POST /suggestions (index)
async function handleSubmitSuggestion(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = getClientIp(req);
    const { churchId, field, value } = req.body;

    if (!churchId || typeof churchId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid churchId' });
    }

    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid field' });
    }

    if (!VALID_FIELDS.includes(field)) {
      return res.status(400).json({
        error: `Invalid field. Must be one of: ${VALID_FIELDS.join(', ')}`,
      });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Missing value' });
    }

    const key = `suggestions:${churchId}`;
    const existing = await kv.get<SuggestionEntry>(key);

    const entry: SuggestionEntry = existing || {
      churchId,
      submissions: [],
    };

    const existingSubmissionIndex = entry.submissions.findIndex((sub) => sub.ip === ip && sub.field === field);

    const newSubmission: Submission = {
      ip,
      field,
      value,
      timestamp: Date.now(),
    };

    if (existingSubmissionIndex >= 0) {
      entry.submissions[existingSubmissionIndex] = newSubmission;
    } else {
      entry.submissions.push(newSubmission);
    }

    await kv.set(key, entry);

    const consensusResult = consensus(entry.submissions);

    const stateMatch = churchId.match(/^([A-Z]{2})-/);
    if (stateMatch) {
      const state = stateMatch[1];
      const indexKey = `suggestions:index:${state}`;
      const stateIndex = (await kv.get<string[]>(indexKey)) || [];
      if (!stateIndex.includes(churchId)) {
        stateIndex.push(churchId);
        await kv.set(indexKey, stateIndex);
      }
    }

    return res.status(200).json({
      success: true,
      churchId,
      field,
      consensus: consensusResult[field],
      allFields: consensusResult,
    });
  } catch (e) {
    console.error('Error submitting suggestion:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// GET /suggestions/[churchId]
async function handleGetSuggestions(req: VercelRequest, res: VercelResponse, churchId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!churchId || typeof churchId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid churchId' });
    }

    const key = `suggestions:${churchId}`;
    const entry = await kv.get<SuggestionEntry>(key);

    if (!entry || !entry.submissions || entry.submissions.length === 0) {
      return res.status(200).json({
        churchId,
        suggestions: {},
        submissionCount: 0,
        message: 'No suggestions found for this church',
      });
    }

    const consensusResult = consensus(entry.submissions);

    // Remove submissions from consensus result for GET response
    const suggestions: Record<string, Omit<FieldConsensus, 'submissions'>> = {};
    for (const [field, data] of Object.entries(consensusResult)) {
      const { submissions, ...rest } = data;
      suggestions[field] = rest;
    }

    return res.status(200).json({
      churchId,
      suggestions,
      submissionCount: entry.submissions.length,
    });
  } catch (e) {
    console.error('Error fetching suggestions:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// GET /suggestions/approved/[state]
async function handleGetApproved(req: VercelRequest, res: VercelResponse, state: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid state parameter' });
    }

    const stateCode = state.toUpperCase();

    if (!/^[A-Z]{2}$/.test(stateCode)) {
      return res.status(400).json({ error: 'State must be a 2-letter code' });
    }

    const indexKey = `suggestions:index:${stateCode}`;
    const churchIds = (await kv.get<string[]>(indexKey)) || [];

    if (churchIds.length === 0) {
      return res.status(200).json({
        state: stateCode,
        corrections: [],
        count: 0,
        message: 'No suggestions found for this state',
      });
    }

    const allApproved: ApprovedCorrection[] = [];

    for (const churchId of churchIds) {
      const key = `suggestions:${churchId}`;
      const entry = await kv.get<SuggestionEntry>(key);

      if (entry && entry.submissions && entry.submissions.length > 0) {
        const approved = getApprovedCorrections(entry);
        allApproved.push(...approved);
      }
    }

    return res.status(200).json({
      state: stateCode,
      corrections: allApproved,
      count: allApproved.length,
    });
  } catch (e) {
    console.error('Error fetching approved corrections:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// GET /suggestions/pending/[state]
async function handleGetPending(req: VercelRequest, res: VercelResponse, state: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid state parameter' });
    }

    const stateCode = state.toUpperCase();

    if (!/^[A-Z]{2}$/.test(stateCode)) {
      return res.status(400).json({ error: 'State must be a 2-letter code' });
    }

    const indexKey = `suggestions:index:${stateCode}`;
    const churchIds = (await kv.get<string[]>(indexKey)) || [];

    if (churchIds.length === 0) {
      return res.status(200).json({
        state: stateCode,
        corrections: [],
        count: 0,
        message: 'No suggestions found for this state',
      });
    }

    const allPending: PendingCorrection[] = [];

    for (const churchId of churchIds) {
      const key = `suggestions:${churchId}`;
      const entry = await kv.get<SuggestionEntry>(key);

      if (entry && entry.submissions && entry.submissions.length > 0) {
        const pending = getPendingCorrections(entry);
        allPending.push(...pending);
      }
    }

    return res.status(200).json({
      state: stateCode,
      corrections: allPending,
      count: allPending.length,
    });
  } catch (e) {
    console.error('Error fetching pending corrections:', e);
    return res.status(500).json({ error: String(e) });
  }
}

// ============================================================================
// Main Router
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse path from query string (rewrite passes it as string like "LB-123" or "approved/LB")
  const pathParam = req.query.path;
  const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
  const path = pathStr ? pathStr.split('/').filter(Boolean) : [];
  const route = path.join('/');

  // POST /suggestions (index - empty path)
  if (path.length === 0) {
    return handleSubmitSuggestion(req, res);
  }

  // GET /suggestions/approved/[state]
  if (path[0] === 'approved' && path.length === 2) {
    return handleGetApproved(req, res, path[1]);
  }

  // GET /suggestions/pending/[state]
  if (path[0] === 'pending' && path.length === 2) {
    return handleGetPending(req, res, path[1]);
  }

  // GET /suggestions/[churchId] - single path segment that's not a reserved route
  if (path.length === 1 && !['approved', 'pending'].includes(path[0])) {
    return handleGetSuggestions(req, res, path[0]);
  }

  return res.status(404).json({ error: 'Not found', route });
}
