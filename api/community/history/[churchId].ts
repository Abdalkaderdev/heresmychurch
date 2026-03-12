import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Correction {
  churchId: string;
  timestamp: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  [key: string]: unknown;
}

interface CommunityStats {
  corrections?: Correction[];
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { churchId } = req.query;

  if (!churchId || typeof churchId !== 'string') {
    return res.status(400).json({ error: 'churchId is required' });
  }

  try {
    const stats = await kv.get<CommunityStats>('community:stats');
    const corrections = stats?.corrections || [];

    const history = corrections.filter(
      (correction) => correction.churchId === churchId
    );

    return res.status(200).json({ churchId, history });
  } catch (e) {
    return res.status(500).json({ churchId, history: [], error: String(e) });
  }
}
