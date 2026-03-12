import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Valid fields that can be suggested
const VALID_FIELDS = [
  "name",
  "website",
  "address",
  "attendance",
  "denomination",
  "serviceTimes",
  "languages",
  "ministries",
  "pastorName",
  "phone",
  "email",
  "homeCampusId"
];

// Consensus threshold - number of unique IPs needed to approve a suggestion
const THRESHOLD = 1;

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
  submissions: Submission[];
}

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(',')[0].trim();
  return 'unknown';
}

function consensus(submissions: Submission[]): Record<string, FieldConsensus> {
  // Group submissions by field
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

    // Group by value and count unique IPs per value
    const valueVotes: Record<string, Set<string>> = {};

    for (const sub of fieldSubmissions) {
      const valueKey = JSON.stringify(sub.value);
      if (!valueVotes[valueKey]) {
        valueVotes[valueKey] = new Set();
      }
      valueVotes[valueKey].add(sub.ip);
    }

    // Find the value with the most unique IP votes
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
    };
  }

  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = getClientIp(req);
    const { churchId, field, value } = req.body;

    // Validate inputs
    if (!churchId || typeof churchId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid churchId' });
    }

    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid field' });
    }

    if (!VALID_FIELDS.includes(field)) {
      return res.status(400).json({
        error: `Invalid field. Must be one of: ${VALID_FIELDS.join(', ')}`
      });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Missing value' });
    }

    // Get existing suggestions from kv
    const key = `suggestions:${churchId}`;
    const existing = await kv.get<SuggestionEntry>(key);

    const entry: SuggestionEntry = existing || {
      churchId,
      submissions: [],
    };

    // Check if this IP already submitted for this field
    const existingSubmissionIndex = entry.submissions.findIndex(
      (sub) => sub.ip === ip && sub.field === field
    );

    const newSubmission: Submission = {
      ip,
      field,
      value,
      timestamp: Date.now(),
    };

    if (existingSubmissionIndex >= 0) {
      // Update existing submission
      entry.submissions[existingSubmissionIndex] = newSubmission;
    } else {
      // Add new submission
      entry.submissions.push(newSubmission);
    }

    // Save updated entry
    await kv.set(key, entry);

    // Calculate consensus
    const consensusResult = consensus(entry.submissions);

    // Track suggestion in index for state-based queries
    const stateMatch = churchId.match(/^([A-Z]{2})-/);
    if (stateMatch) {
      const state = stateMatch[1];
      const indexKey = `suggestions:index:${state}`;
      const stateIndex = await kv.get<string[]>(indexKey) || [];
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
