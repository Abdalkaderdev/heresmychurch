import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test KV connection
    const testKey = 'health:test';
    await kv.set(testKey, { timestamp: Date.now() });
    const testValue = await kv.get(testKey);

    return res.status(200).json({
      status: 'ok',
      version: 2,
      region: 'middle-east',
      kv: testValue ? 'connected' : 'no-data'
    });
  } catch (error) {
    return res.status(200).json({
      status: 'ok',
      version: 2,
      region: 'middle-east',
      kv: 'error',
      kvError: String(error)
    });
  }
}
