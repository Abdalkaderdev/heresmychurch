import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCountry } from '../_lib/countries';

interface Church {
  id: string;
  shortId?: string;
  [key: string]: unknown;
}

function toShortId(id: string, state: string, existingShortId?: string): string {
  if (existingShortId && /^\d{8}$/.test(existingShortId)) return existingShortId;
  const statePrefix = `${state.toUpperCase()}-`;
  if (id.startsWith(statePrefix)) {
    const numPart = id.slice(statePrefix.length);
    if (/^\d+$/.test(numPart)) {
      return numPart.length >= 8 ? numPart.slice(0, 8) : numPart.padStart(8, "0");
    }
  }
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h).toString().padStart(8, "0").slice(0, 8);
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

    const churches = await kv.get<Church[]>(`churches:${stateCode}`);

    if (!churches || churches.length === 0) {
      return res.status(200).json({
        churches: [],
        state: {
          abbrev: countryInfo.abbrev,
          name: countryInfo.name,
          lat: countryInfo.lat,
          lng: countryInfo.lng,
        },
        count: 0,
        fromCache: true,
        message: `No churches found for ${countryInfo.name}. POST to this endpoint to populate from OpenStreetMap.`,
      });
    }

    const churchesWithShortIds = churches.map((church) => ({
      ...church,
      shortId: toShortId(church.id, stateCode, church.shortId),
    }));

    return res.status(200).json({
      churches: churchesWithShortIds,
      state: {
        abbrev: countryInfo.abbrev,
        name: countryInfo.name,
        lat: countryInfo.lat,
        lng: countryInfo.lng,
      },
      count: churchesWithShortIds.length,
      fromCache: true,
    });
  } catch (e) {
    console.error('Error fetching churches:', e);
    return res.status(500).json({ error: String(e) });
  }
}
