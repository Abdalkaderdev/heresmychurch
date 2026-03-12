import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

interface PendingCorrection {
  churchId: string;
  field: string;
  value: string;
  votes: number;
  needed: number;
}

// Consensus threshold
const THRESHOLD = 1;

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

    // Only include if NOT yet approved (below threshold)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { state } = req.query;

    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid state parameter' });
    }

    const stateCode = state.toUpperCase();

    if (!/^[A-Z]{2}$/.test(stateCode)) {
      return res.status(400).json({ error: 'State must be a 2-letter code' });
    }

    // Get list of churches with suggestions for this state
    const indexKey = `suggestions:index:${stateCode}`;
    const churchIds = await kv.get<string[]>(indexKey) || [];

    if (churchIds.length === 0) {
      return res.status(200).json({
        state: stateCode,
        corrections: [],
        count: 0,
        message: 'No suggestions found for this state',
      });
    }

    // Fetch all suggestion entries for this state
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
