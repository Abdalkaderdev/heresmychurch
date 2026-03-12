# Future: Presence-Spike Celebration Tweet

When concurrent "people here now" (from existing Supabase Realtime presence) crosses a milestone, post a celebration tweet **immediately** on X — no queue, no schedule. This would celebrate traffic spikes as they happen.

**Current state:** Presence is already tracked client-side via `useActiveUsers` (channel `active-users`); the count is shown as "X people with you now" in the map UI. The server does not see this count; the Twitter automation only runs on a 5x/day cron (church/deploy/milestone/funfact).

## Goal

- Client reports "people here now" when it crosses a milestone (e.g. 5, 10, 25, 50, 100).
- Server receives the report, checks rate limit and idempotency, and **posts the tweet right away** in the same request (no queue).
- Keeps the moment special: at most one presence celebration tweet per day; per-milestone idempotency so we don’t post twice for the same milestone.

## Flow

1. User has the map open; `useActiveUsers()` sees `people >= 5` (first milestone).
2. Client calls `POST /twitter/presence-spike` with `{ count: 5 }` (or current people count).
3. Server validates, finds largest milestone ≤ count (e.g. 5), checks KV: have we already posted for milestone 5 today? If no, and we haven’t already posted a presence tweet today, call `postTweet(...)` and store that we posted for 5 and today’s date.
4. Return `{ posted: true }` or `{ posted: false }`; no webhook or cron involved.

## Server (Edge Function)

**File:** `supabase/functions/make-server-283d8046/index.ts`

- **Milestones:** e.g. `PRESENCE_MILESTONES = [5, 10, 25, 50, 100]`. Use **people** (non-bot) count only. Starting at 5 lets the first celebration fire with ~6 people; tune the array later as traffic grows.
- **KV keys:** e.g. `twitter:presence-last-date` (last calendar date we posted a presence tweet) and `twitter:presence-milestones` (e.g. `{ "5": 1731234567890, "10": ... }` for last tweet time per milestone).
- **Rate limit:** At most one presence celebration tweet per calendar day.
- **Idempotency:** For a given milestone, only post once per day (or once ever — either is fine).
- **Auth:** Accept normal `Authorization: Bearer <anon>` (same as other client-called endpoints). No webhook secret in the client. Rely on rate limit + idempotency to limit abuse.
- **Logic:** Parse `count` from body; find largest milestone `m` with `count >= m`; if already posted for `m` today or already posted any presence tweet today, return 200 `{ posted: false }`. Otherwise build tweet text (under 280 chars), call `postTweet(text)`, store milestone + date in KV, return 200 `{ posted: true, tweetId?: string }`.
- **New route:** `app.post(\`${P}/twitter/presence-spike\`, ...)` next to the other Twitter routes (e.g. after `queue-deploy`).

## Client

- **Where:** `activePeople` (and `activeBots`) already exist in `ChurchMap.tsx` via `useActiveUsers()` (`src/app/components/hooks/useActiveUsers.ts`).
- **Behavior:** When `people` crosses a new milestone (e.g. goes from 4 to 5), call the new endpoint once. Use a ref to remember which milestones were already reported this session so we don’t re-send on every presence tick.
- **Recommendation:** Put the "report milestone" logic in the hook so any consumer of `useActiveUsers` gets it; the hook calls an API helper that POSTs `{ count: people }` to `/twitter/presence-spike`. Duplicate the milestones array in the client (e.g. `[5, 10, 25, 50, 100]`) for "which milestone did we cross?" or keep it in sync with the server.
- **API helper:** In `src/app/components/api.ts`, add e.g. `reportPresenceSpike(count: number): Promise<{ posted: boolean }>` that POSTs JSON `{ count }` with the usual headers.

Multiple tabs may all POST when count hits 5; the server’s idempotency and one-tweet-per-day limit mean the first request wins and the rest get `posted: false`.

## Thresholds (milestones)

- Start with **`[5, 10, 25, 50, 100]`** so 5+ triggers the first celebration and the project can grow into 10, 25, etc. (Most seen so far is ~6, so 5 is achievable.)
- Keep the list in one place on the server; client can duplicate the same array. Server can be updated later (e.g. add 250, 500) without client changes — client just sends `count`, server decides which milestone applies.

## Tweet copy

- Under 280 characters. Example: *"Right now 5+ people are exploring churches on Here's My Church — join them!"* (optional: add a single emoji like 🗺️; drop if preferred.)

## Summary

| Piece  | Action |
|--------|--------|
| Server | Add `PRESENCE_MILESTONES`, KV keys for last date + per-milestone, `POST /twitter/presence-spike` with anon auth, rate limit 1/day, idempotency per milestone, call `postTweet` immediately when allowed. |
| Client | In `useActiveUsers` (or ChurchMap): when `people` crosses a new milestone, call `reportPresenceSpike(people)`; use a ref to avoid re-sending same milestone in one session. |
| API    | Add `reportPresenceSpike(count)` in `api.ts` that POSTs `{ count }` to the new endpoint. |

Presence tweets are **instant** from this endpoint; the existing 5x/day cron is unchanged and only handles church/deploy/milestone/funfact.
