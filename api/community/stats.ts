import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = ((req.query.state as string) || '').toUpperCase();
    const stats = (await kv.get<any>('community:stats')) || {
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
      const stateCorrections = corrections.filter((h: any) => h && match(String(h.churchId || '')));
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
