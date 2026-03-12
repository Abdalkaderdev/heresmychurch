import type { VercelRequest, VercelResponse } from '@vercel/node';

// Test each import separately
let importStatus: Record<string, string> = {};

try {
  const { kv } = await import('@vercel/kv');
  importStatus['@vercel/kv'] = 'ok';
} catch (e) {
  importStatus['@vercel/kv'] = String(e);
}

try {
  const countries = await import('./lib/countries');
  importStatus['countries'] = `ok - ${countries.ME.length} countries`;
} catch (e) {
  importStatus['countries'] = String(e);
}

try {
  const overpass = await import('./lib/overpass');
  importStatus['overpass'] = 'ok';
} catch (e) {
  importStatus['overpass'] = String(e);
}

try {
  const denominations = await import('./lib/denominations');
  importStatus['denominations'] = 'ok';
} catch (e) {
  importStatus['denominations'] = String(e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'test-imports',
    imports: importStatus
  });
}
