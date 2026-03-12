import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// Types
// ============================================================================

interface Correction {
  churchId: string;
  timestamp: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  [key: string]: unknown;
}

interface CommunityStats {
  totalCorrections?: number;
  churchesImproved?: string[];
  totalConfirmations?: number;
  corrections?: Correction[];
  lastUpdated?: string | null;
  [key: string]: unknown;
}

// ============================================================================
// Route Handlers
// ============================================================================

// GET /community/stats
async function handleStats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = ((req.query.state as string) || '').toUpperCase();
    const stats = (await kv.get<CommunityStats>('community:stats')) || {
      totalCorrections: 0,
      churchesImproved: [],
      totalConfirmations: 0,
      corrections: [],
      lastUpdated: null,
    };

    const corrections = Array.isArray(stats.corrections) ? stats.corrections : [];
    const improved = Array.isArray(stats.churchesImproved) ? stats.churchesImproved : [];

    if (state && state.length === 2) {
      const prefix1 = state + '-';
      const prefix2 = 'community-' + state + '-';
      const match = (id: string) => id.startsWith(prefix1) || id.startsWith(prefix2);
      const stateCorrections = corrections.filter((h) => h && match(String(h.churchId || '')));
      const stateImproved = improved.filter((id: string) => match(String(id)));
      return res.status(200).json({
        totalCorrections: stateCorrections.length,
        churchesImproved: stateImproved.length,
        totalConfirmations: 0,
        lastUpdated: stats.lastUpdated,
      });
    }

    return res.status(200).json({
      totalCorrections: stats.totalCorrections || 0,
      churchesImproved: improved.length,
      totalConfirmations: stats.totalConfirmations || 0,
      lastUpdated: stats.lastUpdated,
    });
  } catch (e) {
    console.error('Error fetching community stats:', e);
    return res.status(500).json({
      totalCorrections: 0,
      churchesImproved: 0,
      totalConfirmations: 0,
      error: String(e),
    });
  }
}

// GET /community/history/[churchId]
async function handleHistory(req: VercelRequest, res: VercelResponse, churchId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!churchId || typeof churchId !== 'string') {
    return res.status(400).json({ error: 'churchId is required' });
  }

  try {
    const stats = await kv.get<CommunityStats>('community:stats');
    const corrections = stats?.corrections || [];

    const history = corrections.filter((correction) => correction.churchId === churchId);

    return res.status(200).json({ churchId, history });
  } catch (e) {
    return res.status(500).json({ churchId, history: [], error: String(e) });
  }
}

// ============================================================================
// Main Router
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse path from query string (rewrite passes it as string like "stats" or "history/LB-123")
  const pathParam = req.query.path;
  const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
  const path = pathStr ? pathStr.split('/').filter(Boolean) : [];
  const route = path.join('/');

  // GET /community/stats
  if (route === 'stats') {
    return handleStats(req, res);
  }

  // GET /community/history/[churchId]
  if (path[0] === 'history' && path.length === 2) {
    return handleHistory(req, res, path[1]);
  }

  return res.status(404).json({ error: 'Not found', route });
}
