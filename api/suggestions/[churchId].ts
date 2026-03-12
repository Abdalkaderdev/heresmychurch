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

interface FieldConsensus {
  approved: boolean;
  value: string;
  votes: number;
  needed: number;
  submissionCount: number;
}

// Consensus threshold
const THRESHOLD = 1;

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
      submissionCount: fieldSubmissions.length,
    };
  }

  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { churchId } = req.query;

    if (!churchId || typeof churchId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid churchId' });
    }

    // Get suggestions from kv
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

    // Calculate consensus for each field
    const consensusResult = consensus(entry.submissions);

    return res.status(200).json({
      churchId,
      suggestions: consensusResult,
      submissionCount: entry.submissions.length,
    });
  } catch (e) {
    console.error('Error fetching suggestions:', e);
    return res.status(500).json({ error: String(e) });
  }
}
