import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ME } from '../_lib/countries';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const meta = await kv.get<{ stateCounts: Record<string, number> }>('churches:meta') || { stateCounts: {} };
    const sc = meta.stateCounts || {};

    const states = ME.map(s => ({
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
