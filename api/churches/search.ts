import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ME } from '../_lib/countries';

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

function scoreMatch(q: string, name: string, city: string, address: string): number {
  const tokens = q.split(/\s+/).filter(Boolean);
  const n = name.toLowerCase(), c = city.toLowerCase(), a = address.toLowerCase();
  let s = 0;
  if (n.includes(q)) s += 1000; // phrase match
  const inName = tokens.filter(t => n.includes(t));
  if (inName.length === tokens.length) s += 500; // all in name
  if (tokens.length > 0 && n.startsWith(tokens[0])) s += 300; // name starts
  s += inName.length * 50; // token in name
  for (const t of tokens) if (c.includes(t) || a.includes(t)) s += 30; // token in loc
  return s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse query parameters
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
      ? priorityStatesStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const rawLimit = req.query.limit;
    const limitStr = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
    let limit = limitStr ? parseInt(limitStr, 10) : 10;

    // Clamp limit based on search scope
    if (stateFilter) {
      limit = Math.min(Math.max(1, limit), 100); // single state: max 100
    } else {
      limit = Math.min(Math.max(1, limit), 25); // global: max 25
    }

    // Get populated states from meta
    const meta = await kv.get<{ stateCounts: Record<string, number> }>('churches:meta') || { stateCounts: {} };
    const populatedStates = Object.keys(meta.stateCounts || {});

    // Determine search order
    let statesToSearch: string[];
    if (stateFilter) {
      // Single state filter
      if (!populatedStates.includes(stateFilter)) {
        return res.status(200).json({ results: [], query: q, statesSearched: 0 });
      }
      statesToSearch = [stateFilter];
    } else {
      // Priority states first, then remaining populated states
      const prioritySet = new Set(priorityStates);
      const priorityInPopulated = priorityStates.filter(s => populatedStates.includes(s));
      const remaining = populatedStates.filter(s => !prioritySet.has(s));
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

        // Check for match in name, city, address, or denomination
        const nameLower = name.toLowerCase();
        const cityLower = city.toLowerCase();
        const addressLower = address.toLowerCase();
        const denomLower = denomination.toLowerCase();

        const tokens = q.split(/\s+/).filter(Boolean);
        const hasMatch = tokens.some(token =>
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

      // Early exit if we have enough results for global search
      if (!stateFilter && results.length >= limit * 2) {
        break;
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Take top results and remove score from output
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
