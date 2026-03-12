import type { VercelRequest, VercelResponse } from '@vercel/node';
import { POPULATIONS } from './_lib/countries';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    populations: POPULATIONS,
    source: 'world-bank-2023',
  });
}
