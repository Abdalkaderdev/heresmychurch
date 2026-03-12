import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Old US states to clear
const OLD_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let deleted = 0;

    // Clear old US state data
    for (const st of OLD_STATES) {
      for (const prefix of ["churches:", "churches:sidx:", "calibration:", "pending-churches:"]) {
        const key = `${prefix}${st}`;
        try {
          const exists = await kv.get(key);
          if (exists) {
            await kv.del(key);
            deleted++;
          }
        } catch (_) {
          // Key doesn't exist, continue
        }
      }
    }

    // Reset meta
    await kv.set("churches:meta", {
      stateCounts: {},
      lastUpdated: new Date().toISOString(),
    });

    // Reset community stats
    await kv.set("community:stats", {
      totalCorrections: 0,
      churchesImproved: 0,
      totalConfirmations: 0,
      lastUpdated: Date.now(),
    });

    // Clear state populations cache
    try {
      await kv.del("state-populations-v1");
    } catch (_) {}

    return res.status(200).json({
      message: `Reset complete. Cleared ${deleted} keys for ${OLD_STATES.length} old states.`,
      deleted,
    });
  } catch (e) {
    console.error('Reset error:', e);
    return res.status(500).json({ error: String(e) });
  }
}
