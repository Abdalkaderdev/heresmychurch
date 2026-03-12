import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  submittedBy?: string;
  verifications: string[];
  lastVerified?: string;
}

const VERIFICATIONS_REQUIRED = 3;

function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pendingId } = req.query;

    if (!pendingId || typeof pendingId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid pendingId parameter' });
    }

    // Extract state from the pendingId (format: community-STATE-timestamp-random)
    const parts = pendingId.split('-');
    if (parts.length < 4 || parts[0] !== 'community') {
      return res.status(400).json({ error: 'Invalid pending church ID format' });
    }

    const stateCode = parts[1].toUpperCase();

    // Get verifier IP
    const verifierIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const verifierHash = hashIp(verifierIp);

    // Find the pending church
    const pendingChurches = (await kv.get<Church[]>(`pending-churches:${stateCode}`)) || [];
    const churchIndex = pendingChurches.findIndex((c) => c.id === pendingId);

    if (churchIndex === -1) {
      return res.status(404).json({ error: 'Pending church not found' });
    }

    const church = pendingChurches[churchIndex];

    // Check if already verified by this user
    if (church.verifications.includes(verifierHash)) {
      return res.status(409).json({
        error: 'You have already verified this church',
        verifications: church.verifications.length,
        required: VERIFICATIONS_REQUIRED,
      });
    }

    // Prevent self-verification (submitter cannot verify their own submission)
    if (church.submittedBy && hashIp(church.submittedBy) === verifierHash) {
      return res.status(403).json({
        error: 'You cannot verify your own submission',
      });
    }

    // Add verification
    church.verifications.push(verifierHash);
    church.lastVerified = new Date().toISOString();

    // Check if enough verifications to approve
    const isApproved = church.verifications.length >= VERIFICATIONS_REQUIRED;
    if (isApproved) {
      church.status = 'approved';
    }

    // Update pending churches list
    pendingChurches[churchIndex] = church;
    await kv.set(`pending-churches:${stateCode}`, pendingChurches);

    // Update main churches list
    const allChurches = (await kv.get<Church[]>(`churches:${stateCode}`)) || [];
    const mainIndex = allChurches.findIndex((c) => c.id === pendingId);

    if (mainIndex !== -1) {
      allChurches[mainIndex] = church;
      await kv.set(`churches:${stateCode}`, allChurches);
    }

    // Update community stats if approved
    if (isApproved) {
      const stats = (await kv.get<any>('community:stats')) || {
        totalCorrections: 0,
        churchesImproved: [],
        totalConfirmations: 0,
        totalVerifications: 0,
        approvedChurches: 0,
        corrections: [],
        lastUpdated: null,
      };

      stats.approvedChurches = (stats.approvedChurches || 0) + 1;
      stats.lastUpdated = new Date().toISOString();
      await kv.set('community:stats', stats);
    }

    return res.status(200).json({
      success: true,
      church: {
        id: church.id,
        name: church.name,
        status: church.status,
        verifications: church.verifications.length,
        required: VERIFICATIONS_REQUIRED,
        lastVerified: church.lastVerified,
      },
      approved: isApproved,
      message: isApproved
        ? 'Church has been approved and is now fully visible'
        : `Verification recorded. ${VERIFICATIONS_REQUIRED - church.verifications.length} more verification(s) needed for approval.`,
    });
  } catch (e) {
    console.error('Error verifying church:', e);
    return res.status(500).json({ error: String(e) });
  }
}
