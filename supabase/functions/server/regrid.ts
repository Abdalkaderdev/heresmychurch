/**
 * Regrid parcel API client for batch point lookups.
 * Used to get building square footage (ll_bldg_footprint_sqft) per church for attendance estimates.
 * Trial limit: 2,000 parcel records per batch — we cap each request at 2,000 points.
 */

const REGRID_BASE = "https://app.regrid.com/api/v2/us";
const BATCH_CAP = 2000; // Trial limit: 2,000 parcel records

function getToken(): string {
  const t = Deno.env.get("REGRID_TOKEN");
  if (!t?.trim()) throw new Error("Regrid token not set.");
  return t.trim();
}

export interface BatchPoint {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Submit a batch of points for parcel lookup. Caps at BATCH_CAP points.
 * Returns job_uuid to poll and download.
 */
export async function submitBatch(
  points: BatchPoint[]
): Promise<{ job_uuid: string }> {
  const token = getToken();
  const capped = points.slice(0, BATCH_CAP);
  const features = capped.map((p) => ({
    type: "Feature",
    properties: { custom_id: p.id },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  }));
  const body = { geojson: { type: "FeatureCollection", features } };
  const url = `${REGRID_BASE}/batch/points?token=${encodeURIComponent(token)}&return_geometry=false`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Regrid submitBatch ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { job_uuid?: string; message?: string };
  if (!data.job_uuid) throw new Error("Regrid did not return job_uuid");
  return { job_uuid: data.job_uuid };
}

export interface BatchStatus {
  status: string;
  percent_complete?: number;
  processed_count?: number;
  failed_count?: number;
}

/**
 * Get status of a batch job. status is one of: queued, running, ready, downloaded, removed, failed.
 */
export async function getBatchStatus(jobUuid: string): Promise<BatchStatus> {
  const token = getToken();
  const url = `${REGRID_BASE}/batch/${jobUuid}/status?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Regrid getBatchStatus ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { job?: BatchStatus };
  if (!data.job) throw new Error("Regrid status missing job");
  return data.job;
}

/**
 * Download batch results as newline-delimited GeoJSON.
 * Returns a Map: church id (custom_id) -> building sqft (ll_bldg_footprint_sqft).
 * When multiple parcels match the same point, we keep the maximum sqft.
 */
export async function downloadBatchResults(
  jobUuid: string
): Promise<Map<string, number>> {
  const token = getToken();
  const url = `${REGRID_BASE}/batch/${jobUuid}/download?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Regrid download ${res.status}: ${text}`);
  }
  const text = await res.text();
  const byId = new Map<string, number>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const feature = JSON.parse(trimmed) as {
        properties?: {
          custom_id?: string;
          ll_uuid?: string | null;
          fields?: { ll_bldg_footprint_sqft?: number };
        };
      };
      const props = feature.properties;
      if (!props?.custom_id) continue;
      if (props.ll_uuid == null) continue; // no parcel match
      const sqft = props.fields?.ll_bldg_footprint_sqft;
      if (typeof sqft !== "number" || sqft <= 0) continue;
      const existing = byId.get(props.custom_id);
      if (existing === undefined || sqft > existing) {
        byId.set(props.custom_id, sqft);
      }
    } catch {
      // skip malformed lines
    }
  }
  return byId;
}
