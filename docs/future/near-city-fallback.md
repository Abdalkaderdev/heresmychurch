# Future: "Near {city}" fallback for churches without address/city

When a church has no street address and no city, we show a fallback location string (e.g. "Somewhere in Central Iowa", "Somewhere in NW Texas"). This doc describes a possible enhancement: showing **"Near {city}"** when we can derive a nearby city from the church’s coordinates.

## Goal

- **Input:** Church with `lat`, `lng`, `state`, and missing/empty `city` (and no meaningful `address`).
- **Output:** A fallback string like **"Near Des Moines"** instead of (or in addition to) quadrant/Central when we can resolve a sensible city name from the coordinates.

## Current behavior

- Fallback is computed in `src/app/components/church-data.ts` via `getFallbackLocation()`.
- We already support: state-only ("Somewhere in Iowa"), quadrant ("Somewhere in NW Iowa"), and **Central** ("Somewhere in Central Iowa") when the point is near the state’s geographic center.
- All of this uses only `STATE_BOUNDS` and `STATE_NAMES` from `map-constants.ts`; no external API or extra data.

## Two implementation options

### Option A: Reverse geocoding (e.g. Nominatim)

- The app already uses **Nominatim** (OpenStreetMap) for forward geocoding in `AddChurchForm.tsx` (`geocodeAddress`). Nominatim supports **reverse** geocoding: `GET https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json` returns address components including `address.city`, `address.town`, or `address.village`.
- Add a helper such as `reverseGeocodeToCity(lat: number, lng: number): Promise<string | null>` and, when building the fallback, optionally call it and show **"Near {city}"** when a result is returned.
- **Caveats:** Nominatim’s usage policy asks for **1 request per second**. With many churches lacking city data, that could mean many requests and noticeable latency. Mitigations:
  - **Cache** by rounded (lat, lng) in memory or sessionStorage so we don’t re-request for the same area.
  - Show quadrant/Central first, then **asynchronously** replace with "Near {city}" when the result arrives (with a loading or placeholder UX so the UI doesn’t block).

### Option B: Static "nearest city" dataset

- Add a **static** dataset (e.g. JSON or TS module) of populated places per state: each entry has at least `name` and `lat`/`lng` (and optionally state for validation). Sources could be Census Bureau, Natural Earth, or a curated list of major cities/towns per state.
- At runtime, for a given (lat, lng) and state, find the **nearest** city in that state (e.g. by haversine distance) and show **"Near {city name}"**.
- **Pros:** No external API, fast, works offline, deterministic, no rate limits. **Cons:** Dataset size and maintenance; "nearest" might be a very small town name.

## Recommendation

- **Option B (static dataset)** is better long-term for performance, reliability, and avoiding rate limits.
- **Option A** is viable if we want to avoid adding and maintaining static data and can accept caching plus async loading and strict throttling (e.g. 1 req/s or batched background resolution).

## Where to integrate

- **Call sites** for fallback location (unchanged conceptually): `ChurchListModal`, `MapSearchBar`, `MapOverlays`, `ChurchDetailPanel` — they already use `getFallbackLocation(church)`.
- **Implementation:** Either extend `getFallbackLocation()` to accept an optional async "resolve city" step (and have call sites handle async fallback), or add a separate helper that returns "Near {city}" when available and have call sites prefer it over the synchronous quadrant/Central string when both are present.

## Related

- Current fallback logic: `src/app/components/church-data.ts` (`getFallbackLocation`, `isInCentralZone`, `getQuadrantLabel`).
- Forward geocoding: `src/app/components/AddChurchForm.tsx` (`geocodeAddress`).
- State bounds and names: `src/app/components/map-constants.ts` (`STATE_BOUNDS`, `STATE_NAMES`).
