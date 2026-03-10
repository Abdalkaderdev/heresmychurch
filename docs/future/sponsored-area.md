# Future: Sponsored Area (Approved Church Ad Network)

A lightweight, tasteful ad placement system for Here's My Church, modeled after [Carbon Ads](https://www.carbonads.net/) but purpose-built for an approved network of churches and Christian organizations.

**What it is NOT:** a self-serve ad auction, a banner farm, or anything that degrades trust. It should feel like a recommendation from a friend, not an ad.

## Concept

A single, small sponsored card appears in the **SummaryPanel** (`src/app/components/SummaryPanel.tsx`). One sponsor at a time, rotated per impression. No third-party ad scripts, no tracking pixels — just a first-party system that respects the privacy-first ethos (Fathom) of the project.

```
+------------------------------------------+
|  [icon/img]  Sponsored                   |
|  Christ Community Church                 |
|  Join us Sundays at 10am in Austin, TX   |
|  [Visit ->]                              |
+------------------------------------------+
```

Placement: inside `SummaryPanel`, between the "Community Impact" card and "Interesting Finds" — the natural content flow position.

Design constraints:
- Matches the existing dark purple card style (`bg-white/4 border border-white/5 rounded-lg`)
- Clearly labeled "Sponsored" in `text-[10px] uppercase tracking-widest` like other section headers
- Single card, never more than one visible at a time
- Small, tasteful — no larger than the existing "Community Impact" card
- Image is optional (small 28x28 rounded icon if provided)
- Click-through opens in new tab and fires the `/sponsors/:id/click` endpoint

## Approval Flow

Modeled after the existing `pending-churches` pattern in the codebase:

1. Church/org submits a sponsorship request (name, tagline, URL, optional image, target state, desired tier)
2. Stored in `sponsors:pending` KV key
3. Admin reviews and approves/rejects (same pattern as the existing "Review Pending Submissions" flow in `VerificationModal.tsx`)
4. On approval, moved to `sponsors:active` with a start/end date

## Data Model

New keys in the existing `kv_store_283d8046` table (no schema migration needed):

**`sponsors:active`** — Array of approved, currently active sponsor objects:

```json
[
  {
    "id": "sp_abc123",
    "name": "Christ Community Church",
    "tagline": "Join us Sundays at 10am in Austin, TX",
    "url": "https://christcommunity.org",
    "imageUrl": "https://...",
    "type": "church",
    "state": "TX",
    "tier": "standard",
    "impressions": 0,
    "clicks": 0,
    "startDate": "2026-03-01",
    "endDate": "2026-03-31",
    "approved": true
  }
]
```

**`sponsors:pending`** — Submissions awaiting approval (same shape, `approved: false`)

**`sponsors:stats:{id}`** — Monthly rollups per sponsor:

```json
{
  "months": {
    "2026-03": { "impressions": 12450, "clicks": 87 },
    "2026-02": { "impressions": 9800, "clicks": 62 }
  }
}
```

**`sponsors:config`** — Global config (max active, pricing tiers, rotation logic)

## Targeting / Rotation Logic

Keep it simple to start:

1. **State-level targeting (optional):** A sponsor can optionally target a state. When a user is viewing Texas, a Texas-targeted sponsor gets priority.
2. **Fallback:** If no state-targeted sponsor exists, pick from the general pool.
3. **Rotation:** Round-robin or weighted random across active sponsors. Tracked via a simple index counter on the client or a lightweight server-side pick.

## API Routes

New Hono routes in `supabase/functions/make-server-283d8046/index.ts`:

| Method | Route                      | Purpose                                                                                 |
| ------ | -------------------------- | --------------------------------------------------------------------------------------- |
| `GET`  | `/sponsors/active`         | Fetch current active sponsor(s) for display; accepts optional `?state=TX` for targeting |
| `POST` | `/sponsors/submit`         | Submit a new sponsorship request (goes to pending)                                      |
| `GET`  | `/sponsors/pending`        | Admin: list pending requests                                                            |
| `POST` | `/sponsors/:id/approve`    | Admin: approve a pending sponsor                                                        |
| `POST` | `/sponsors/:id/reject`     | Admin: reject a pending sponsor                                                         |
| `POST` | `/sponsors/:id/impression` | Record an impression (batched client-side, sent periodically)                           |
| `POST` | `/sponsors/:id/click`      | Record a click-through                                                                  |
| `GET`  | `/sponsors/:id/stats`      | Sponsor/admin: get monthly stats for a sponsor                                          |
| `GET`  | `/sponsors/report`         | Admin: aggregate report pulling Fathom API data + sponsor stats                         |

## Impression Tracking (Privacy-Respecting)

Stays consistent with the Fathom philosophy — no cookies, no fingerprinting, no third-party scripts.

- When `SponsoredCard` mounts and is visible (`IntersectionObserver`), fire a single impression count to `/sponsors/:id/impression`.
- Debounce: one impression per sponsor per session (use `sessionStorage` flag).
- Click tracking: fire on click-through, one per session per sponsor.
- Server-side: increment counters in `sponsors:stats:{id}`. No IP logging, no user identification.

## Fathom Analytics API for Monthly Reporting

Sponsors need proof of value. The Fathom aggregation API can power a lightweight sponsor dashboard or monthly report email without adding any new tracking.

**API details:**
- **Endpoint:** `GET https://api.usefathom.com/v1/aggregations`
- **Site ID:** `FIHVDBJH` (already in `index.html`)
- **Auth:** Bearer token from https://app.usefathom.com/api (store as Supabase Edge Function secret `FATHOM_API_TOKEN`)
- **Rate limit:** 10 req/min on aggregations; each request counts as 1 pageview against Fathom quota
- **Data accuracy:** March 2021 onward

**Example call for monthly pageviews:**

```
GET https://api.usefathom.com/v1/aggregations
  ?entity=pageview
  &entity_id=FIHVDBJH
  &aggregates=pageviews,visits,uniques
  &date_grouping=month
  &date_from=2026-02-01 00:00:00
  &date_to=2026-02-28 23:59:59
  &timezone=America/New_York
```

**Monthly report object** (combining Fathom site data with per-sponsor stats):

```json
{
  "month": "2026-02",
  "site": {
    "pageviews": 45000,
    "visits": 32000,
    "uniques": 28000
  },
  "sponsor": {
    "id": "sp_abc123",
    "impressions": 12450,
    "clicks": 87,
    "ctr": "0.70%"
  }
}
```

This could be triggered as a cron job (Supabase `pg_cron`) or manual admin action, exposed via `/sponsors/report`, and optionally formatted into an email to sponsors.

## Frontend Components

### `SponsoredCard` (new)
Small card matching existing SummaryPanel aesthetics. Fires impression on visibility, click on tap-through. Fetches from `/sponsors/active?state=XX`.

### `SponsorSubmitForm` (new, Phase 2)
Similar to existing `SuggestEditForm.tsx`. Fields: church/org name, tagline (max 80 chars), website URL, image URL (optional), target state (optional dropdown), contact email.

### `SponsorReviewModal` (new, Phase 2)
Similar to existing `VerificationModal.tsx`. Lists pending submissions with approve/reject buttons and a card preview.

## Pricing Tiers (Suggestion)

Keep it simple and church-friendly:

- **Standard** — $25–50/month: rotation in the general pool, shown across all states
- **State-targeted** — $50–100/month: priority placement when users view a specific state
- **Founding supporter** — custom: early adopters get a lifetime reduced rate and a "founding supporter" badge

Priced to be accessible to small churches but sustainable for the project. Carbon Ads charges ~$2–5 CPM; with the current traffic this would be modest but meaningful.

## Phased Rollout

### Phase 1 — MVP (manual)
- Build `SponsoredCard` component in SummaryPanel
- Hardcode 1–2 sponsor entries in KV store (manually added)
- Basic impression/click counting
- No submission form yet — sponsors onboarded via email

### Phase 2 — Self-serve submission + admin
- `SponsorSubmitForm` component
- `SponsorReviewModal` for admin approval
- Full API routes for CRUD
- Fathom API integration for monthly reporting

### Phase 3 — Dashboard + automation
- Sponsor-facing stats page (impressions, clicks, CTR, site traffic context from Fathom)
- Automated monthly report emails
- Payment integration (Stripe or similar)
- Auto-expire sponsors when their term ends

## Files to Modify/Create

- `src/app/components/SummaryPanel.tsx` — Add `SponsoredCard` placement
- `src/app/components/SponsoredCard.tsx` — **New** component
- `src/app/components/SponsorSubmitForm.tsx` — **New** component (Phase 2)
- `src/app/components/SponsorReviewModal.tsx` — **New** component (Phase 2)
- `src/app/components/api.ts` — Add sponsor API functions
- `supabase/functions/make-server-283d8046/index.ts` — Add sponsor Hono routes
- Supabase secrets — Add `FATHOM_API_TOKEN` for server-side Fathom calls

## Open Questions

- **Placement:** The `ChurchListModal` is another high-visibility spot — should the card also appear there?
- **Scope:** Should sponsors be limited to churches, or also orgs like Bible apps, Christian publishers, etc.? The "approved network" concept supports either.
- **Targeting:** State-level targeting from day one, or start simpler with just a global pool?
- **Payment:** Manual invoicing to start, or Stripe from the beginning?
- **Transparency:** Should Fathom report data be public (builds trust) or private (sponsor-only)?
