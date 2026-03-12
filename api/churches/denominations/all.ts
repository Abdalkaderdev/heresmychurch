import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const meta = await kv.get<{ stateCounts: Record<string, number> }>('churches:meta');
    const populatedStates = Object.keys(meta?.stateCounts || {});

    const denomCounts: Record<string, number> = {};

    for (const state of populatedStates) {
      const churches = await kv.get<any[]>(`churches:${state}`);
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
