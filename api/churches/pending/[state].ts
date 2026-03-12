import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCountry } from '../../_lib/countries';

interface Church {
  id: string;
  shortId: string;
  name: string;
  address?: string;
  city?: string;
  state: string;
  lat: number;
  lng: number;
  denomination?: string;
  attendance?: number;
  website?: string;
  serviceTimes?: string[];
  languages?: string[];
  ministries?: string[];
  pastorName?: string;
  phone?: string;
  email?: string;
  source: 'community';
  status: 'pending' | 'approved';
  submittedAt: string;
  verifications: string[];
  lastVerified?: string;
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
    const countryInfo = getCountry(stateCode);

    if (!countryInfo) {
      return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
    }

    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];

    // Filter to only return pending (not yet approved) churches
    const stillPending = pendingChurches.filter((c) => c.status === 'pending');

    return res.status(200).json({
      churches: stillPending,
      state: {
        abbrev: countryInfo.abbrev,
        name: countryInfo.name,
        lat: countryInfo.lat,
        lng: countryInfo.lng,
      },
      count: stillPending.length,
    });
  } catch (e) {
    console.error('Error fetching pending churches:', e);
    return res.status(500).json({ error: String(e) });
  }
}
