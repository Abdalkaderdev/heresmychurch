import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCountry, POPULATIONS } from '../../_lib/countries';
import { fetchChurches } from '../../_lib/overpass';
import { DMED } from '../../_lib/denominations';

const NATIONAL_AVG_POP = Object.values(POPULATIONS).reduce((a, b) => a + b, 0) / Object.keys(POPULATIONS).length;

function applyStateScaling(churches: any[], state: string): void {
  const statePop = POPULATIONS[state] || NATIONAL_AVG_POP;
  const factor = Math.min(1.2, Math.pow(statePop / NATIONAL_AVG_POP, 0.12));
  for (const c of churches) {
    c.attendance = Math.max(10, Math.min(Math.round((c.attendance || 10) * factor), 25000));
  }
}

function buildIndex(churches: any[]) {
  return churches.map(c => ({
    id: c.id,
    n: c.name || "",
    c: c.city || "",
    d: c.denomination || "",
    a: c.attendance || 0,
    ad: c.address || "",
    la: c.lat || 0,
    lo: c.lng || 0,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract state from query params
  const { state, force } = req.query;
  const stateCode = Array.isArray(state) ? state[0] : state;

  if (!stateCode) {
    return res.status(400).json({ error: 'State code is required' });
  }

  // Validate using getCountry()
  const country = getCountry(stateCode);
  if (!country) {
    return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
  }

  const churchesKey = `churches:${stateCode}`;
  const forcePopulate = force === 'true';

  try {
    // Check if already populated
    if (!forcePopulate) {
      const existing = await kv.get(churchesKey);
      if (existing) {
        return res.status(200).json({
          message: `Country ${stateCode} is already populated`,
          alreadyPopulated: true,
          count: Array.isArray(existing) ? existing.length : 0,
        });
      }
    }

    // Fetch churches from Overpass
    const rawChurches = await fetchChurches(stateCode);

    if (!rawChurches || rawChurches.length === 0) {
      return res.status(200).json({
        message: `No churches found for ${stateCode}`,
        count: 0,
      });
    }

    // Set proper IDs and state for each church
    const churches = rawChurches.map((c: any) => ({
      ...c,
      id: `${stateCode}-${c.id}`,
      state: stateCode,
    }));

    // Apply state scaling based on population
    applyStateScaling(churches, stateCode);

    // Save to Vercel KV
    await kv.set(churchesKey, churches);

    // Update churches:meta with new count
    const meta = await kv.get<{ stateCounts: Record<string, number> }>('churches:meta') || { stateCounts: {} };
    meta.stateCounts = meta.stateCounts || {};
    meta.stateCounts[stateCode] = churches.length;
    await kv.set('churches:meta', meta);

    // Build and save search index
    const searchIndex = buildIndex(churches);
    const searchIndexKey = `churches:sidx:${stateCode}`;
    await kv.set(searchIndexKey, searchIndex);

    return res.status(200).json({
      message: `Successfully populated ${country.name} with church data`,
      count: churches.length,
      state: stateCode,
      country: country.name,
    });
  } catch (e) {
    console.error(`Error populating churches for ${stateCode}:`, e);
    return res.status(500).json({
      error: 'Failed to populate churches',
      details: String(e),
    });
  }
}
