import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Church {
  id: string;
  shortId?: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  lastVerified?: string;
  [key: string]: unknown;
}

interface Confirmation {
  confirmerHash: string;
  timestamp: string;
}

function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

function extractStateFromId(churchId: string): string | null {
  // Handle community IDs: community-STATE-timestamp-random
  if (churchId.startsWith('community-')) {
    const parts = churchId.split('-');
    if (parts.length >= 2) {
      return parts[1].toUpperCase();
    }
  }

  // Handle standard IDs: STATE-number
  const match = churchId.match(/^([A-Z]{2})-/);
  if (match) {
    return match[1];
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { churchId } = req.query;

    if (!churchId || typeof churchId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid churchId parameter' });
    }

    // Extract state from churchId
    const stateCode = extractStateFromId(churchId);

    if (!stateCode) {
      return res.status(400).json({ error: 'Could not determine state from churchId' });
    }

    // Get confirmer IP
    const confirmerIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const confirmerHash = hashIp(confirmerIp);

    // Find the church in the main churches list
    const churches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const churchIndex = churches.findIndex((c) => c.id === churchId);

    if (churchIndex === -1) {
      return res.status(404).json({ error: 'Church not found' });
    }

    const church = churches[churchIndex];

    // Get or create confirmations list for this church
    const confirmKey = `confirms:${churchId}`;
    const confirmations = (await kv.get<Confirmation[]>(confirmKey)) || [];

    // Check if already confirmed by this user
    const alreadyConfirmed = confirmations.some((c) => c.confirmerHash === confirmerHash);
    if (alreadyConfirmed) {
      return res.status(409).json({
        error: 'You have already confirmed this church',
        totalConfirmations: confirmations.length,
      });
    }

    // Add new confirmation
    const newConfirmation: Confirmation = {
      confirmerHash,
      timestamp: new Date().toISOString(),
    };
    confirmations.push(newConfirmation);
    await kv.set(confirmKey, confirmations);

    // Update church's lastVerified timestamp
    church.lastVerified = new Date().toISOString();
    churches[churchIndex] = church;
    await kv.set(`churches:${stateCode}`, churches);

    // Update community stats
    const stats = (await kv.get<any>('community:stats')) || {
      totalCorrections: 0,
      churchesImproved: [],
      totalConfirmations: 0,
      corrections: [],
      lastUpdated: null,
    };

    stats.totalConfirmations = (stats.totalConfirmations || 0) + 1;
    stats.lastUpdated = new Date().toISOString();
    await kv.set('community:stats', stats);

    return res.status(200).json({
      success: true,
      church: {
        id: church.id,
        name: church.name,
        lastVerified: church.lastVerified,
      },
      confirmations: confirmations.length,
      message: 'Thank you for confirming this church information is accurate.',
    });
  } catch (e) {
    console.error('Error confirming church:', e);
    return res.status(500).json({ error: String(e) });
  }
}
