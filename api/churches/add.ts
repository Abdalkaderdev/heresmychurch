import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCountry } from '../_lib/countries';

interface ChurchInput {
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
}

interface Church extends ChurchInput {
  id: string;
  shortId: string;
  source: 'community';
  status: 'pending';
  submittedAt: string;
  submittedBy?: string;
  verifications: string[];
  lastVerified?: string;
}

function generateId(state: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `community-${state.toUpperCase()}-${timestamp}-${random}`;
}

function generateShortId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString().padStart(8, '0').slice(0, 8);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ChurchInput;

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!body.state || typeof body.state !== 'string') {
      return res.status(400).json({ error: 'State (country code) is required' });
    }

    const stateCode = body.state.toUpperCase();
    const countryInfo = getCountry(stateCode);

    if (!countryInfo) {
      return res.status(400).json({ error: `Invalid country code: ${stateCode}` });
    }

    // Validate coordinates
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng coordinates are required' });
    }

    // Validate Middle East bounds (lat: -13 to 43, lng: -18 to 60)
    if (lat < -13 || lat > 43) {
      return res.status(400).json({
        error: `Latitude ${lat} is outside valid range (-13 to 43)`,
      });
    }

    if (lng < -18 || lng > 60) {
      return res.status(400).json({
        error: `Longitude ${lng} is outside valid range (-18 to 60)`,
      });
    }

    // Check for duplicates
    const existingChurches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const normalizedNewName = normalizeForComparison(body.name);
    const DUPLICATE_DISTANCE_KM = 0.5; // 500 meters

    for (const existing of existingChurches) {
      const normalizedExistingName = normalizeForComparison(existing.name);
      const distance = haversineDistance(lat, lng, existing.lat, existing.lng);

      if (normalizedNewName === normalizedExistingName && distance < DUPLICATE_DISTANCE_KM) {
        return res.status(409).json({
          error: 'A church with a similar name already exists at this location',
          existingChurch: {
            id: existing.id,
            name: existing.name,
            distance: Math.round(distance * 1000), // in meters
          },
        });
      }
    }

    // Check pending churches for duplicates too
    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];

    for (const pending of pendingChurches) {
      const normalizedPendingName = normalizeForComparison(pending.name);
      const distance = haversineDistance(lat, lng, pending.lat, pending.lng);

      if (normalizedPendingName === normalizedNewName && distance < DUPLICATE_DISTANCE_KM) {
        return res.status(409).json({
          error: 'A pending church submission with a similar name already exists at this location',
          pendingChurch: {
            id: pending.id,
            name: pending.name,
            distance: Math.round(distance * 1000),
          },
        });
      }
    }

    // Generate IDs
    const id = generateId(stateCode);
    const shortId = generateShortId(id);

    // Get submitter info (IP-based)
    const submittedBy =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';

    // Create the church object
    const church: Church = {
      id,
      shortId,
      name: body.name.trim(),
      address: body.address?.trim(),
      city: body.city?.trim(),
      state: stateCode,
      lat,
      lng,
      denomination: body.denomination?.trim(),
      attendance: body.attendance ? Number(body.attendance) : undefined,
      website: body.website?.trim(),
      serviceTimes: Array.isArray(body.serviceTimes) ? body.serviceTimes : undefined,
      languages: Array.isArray(body.languages) ? body.languages : undefined,
      ministries: Array.isArray(body.ministries) ? body.ministries : undefined,
      pastorName: body.pastorName?.trim(),
      phone: body.phone?.trim(),
      email: body.email?.trim(),
      source: 'community',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      submittedBy,
      verifications: [],
    };

    // Store in pending-churches list
    const updatedPending = [...pendingChurches, church];
    await kv.set(`pending-churches:${stateCode}`, updatedPending);

    // Also add to main churches list (marked as pending)
    const updatedChurches = [...existingChurches, church];
    await kv.set(`churches:${stateCode}`, updatedChurches);

    // Update meta counts
    const meta = (await kv.get<{ stateCounts: Record<string, number> }>('churches:meta')) || {
      stateCounts: {},
    };
    meta.stateCounts[stateCode] = updatedChurches.length;
    await kv.set('churches:meta', meta);

    return res.status(201).json({
      success: true,
      church: {
        id: church.id,
        shortId: church.shortId,
        name: church.name,
        city: church.city,
        state: church.state,
        lat: church.lat,
        lng: church.lng,
        status: church.status,
        submittedAt: church.submittedAt,
      },
      message: 'Church submitted successfully. It will appear as pending until verified.',
    });
  } catch (e) {
    console.error('Error adding church:', e);
    return res.status(500).json({ error: String(e) });
  }
}
