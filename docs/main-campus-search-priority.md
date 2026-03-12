# Main Campus Search: Priority Order (Same State → Surrounding → National)

**Status: Still not working as intended.** The list does not consistently show same-state results first, then surrounding states, then national.

---

## What We're Trying To Do

In **Update Church Info** → **Link to main campus**, when a user searches for a main campus to link:

1. **Fetch order:** The server should search the **current church’s state first**, then **surrounding (neighboring) states**, then the **rest of the country**.
2. **Display order:** The results list should show:
   - **Same state** first
   - **Surrounding states** next
   - **National** (all other states) last

So a campus’s main campus is usually nearby; we want fast, relevant results and a clear order in the UI.

---

## What We’ve Done

### 1. State-neighbor map (client)

- **File:** `src/app/components/map-constants.ts`
- **Change:** Added `STATE_NEIGHBORS`: a map of state abbreviation → array of neighboring state abbreviations (contiguous US + DC with MD).
- **Purpose:** Know which states count as “surrounding” for any given state.

### 2. Server: `priorityStates` and early exit

- **Files:** `supabase/functions/server/index.tsx`, `supabase/functions/make-server-283d8046/index.ts`
- **Changes:**
  - Accept optional query param `priorityStates=TX,OK,LA,NM,...` (comma-separated).
  - Build the state iteration order as: **priority states first** (that are populated), then the rest.
  - **Early exit:** After processing the last priority state, if we already have enough candidates (`>= limit`), stop and do not fetch remaining states (so we often only hit 1–2 states).
  - When `priorityStates` is set (and no single `state` filter), use a higher limit (cap 100) so the UI can show enough results.
- **Purpose:** Speed up search by querying same/surrounding states first and stopping when we have enough.

### 3. Server: State-tier sort

- **Files:** Same server files as above.
- **Change:** When `priorityStatesParam` is non-empty, after sorting by text score we **sort by state tier**: tier 0 = same state (first in `priorityStates`), tier 1 = other priority states (neighbors), tier 2 = all others. Within each tier we keep score order, then name. State comparison uses a normalized 2-letter abbrev (`trim`, `toUpperCase`, `slice(0,2)`).
- **Purpose:** API response order should already be same state → surrounding → national.

### 4. Client API: `priorityStates` param

- **File:** `src/app/components/api.ts`
- **Change:** `searchChurches(query, limit, state?, priorityStates?)`. If `priorityStates` is provided, append `&priorityStates=TX,OK,...` to the URL and do **not** send `state`, so the server uses the priority + early-exit path.
- **Purpose:** Main campus search can tell the server which states to prioritize.

### 5. Client: Normalize church state and fallback from id

- **File:** `src/app/components/SuggestEditForm.tsx`
- **Change:** Added `normalizeStateAbbrev(churchState, churchId)`:
  - If `churchState` is already 2 characters (e.g. `"TX"`), use it.
  - Else if it’s a full name (e.g. `"Texas"`), resolve to 2-letter abbrev via `STATE_NAMES`.
  - If still empty, derive state from `currentChurchId`: e.g. `"TX-12345"` → `TX`, `"community-CA-..."` → `CA`.
- **Purpose:** We always have a 2-letter state for tiering and for building `priorityStates`, even when `church.state` is missing or a full name.

### 6. Client: Priority list and tier sort in MainCampusSearch

- **File:** `src/app/components/SuggestEditForm.tsx`
- **Changes:**
  - `stateNorm` = result of `normalizeStateAbbrev(churchState, currentChurchId)`.
  - `priorityStates` = `[stateNorm, ...STATE_NEIGHBORS[stateNorm]]` (deduped, 2-letter only). Passed to `searchChurches(q, 20, undefined, priorityStates)`.
  - After receiving results, **tier sort** on the client: normalize each result’s `state` (trim, uppercase, slice 0–2), then tier 0 = same state (including DC/MD equivalence), tier 1 = in neighbor set, tier 2 = rest. Within tier, sort by name for stability.
  - Tier sort runs for every response (when `stateNorm` is empty, every result gets tier 2 so order is unchanged).
- **Purpose:** Request uses current + neighboring states; display order is explicitly same state → surrounding → national.

### 7. Removed distance-based sorting

- Earlier we tried sorting by **literal distance** (haversine) from the current church. That made the experience worse (slow). We removed it and kept only **state-based** priority: same state, then surrounding states, then national.

---

## Files Touched

| Area   | File(s) |
|--------|---------|
| Client | `src/app/components/SuggestEditForm.tsx` (MainCampusSearch, normalizeStateAbbrev, tier sort) |
| Client | `src/app/components/api.ts` (searchChurches `priorityStates` param) |
| Client | `src/app/components/map-constants.ts` (STATE_NEIGHBORS) |
| Server | `supabase/functions/server/index.tsx` (search handler: priorityStates, exp order, early exit, tier sort) |
| Server | `supabase/functions/make-server-283d8046/index.ts` (same search logic) |

---

## Current Behavior (Intended vs Actual)

- **Intended:** Results list shows all same-state hits first, then surrounding states, then national.
- **Actual:** Same-state results do **not** consistently appear first; the list is still not working as intended.

---

## Possible Next Steps for Debugging

1. **Verify request:** In the browser Network tab, confirm that when using “Link to main campus” the search request includes `priorityStates` with the correct state first (e.g. `priorityStates=TX,OK,LA,AR,NM` for a Texas church).
2. **Verify response order:** Inspect the JSON response from `/churches/search`: are the first N results all from the same state as the church being edited?
3. **Verify client state:** Log or inspect `church.state`, `church.id`, and the computed `stateNorm` and `priorityStates` when the edit form is open, to ensure they’re not empty or wrong (e.g. full name not resolved, or id format not parsed).
4. **Church id format:** If church ids ever use a format other than `STATE-numeric` or `community-STATE-...`, the id fallback in `normalizeStateAbbrev` may not derive state (e.g. `US-TX-123` would yield `US` with the current “dash at index 2” logic).
5. **Server vs client tier:** Add temporary logging on server (tier assigned per result) and client (tier per result after sort) to confirm both sides agree on tier 0/1/2 and that the client isn’t re-sorting in an unexpected way.

---

*Last updated: summary of main campus search priority work; behavior still not correct.*
