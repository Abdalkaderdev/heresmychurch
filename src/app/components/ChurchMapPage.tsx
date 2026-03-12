import { useLocation, useNavigate } from "react-router";
import { useMemo, useCallback, useEffect } from "react";
import { ChurchMap } from "./ChurchMap";

/**
 * Thin routing wrapper — parses URL params and passes navigation
 * callbacks down to ChurchMap. This keeps all React Router logic
 * in one place so ChurchMap doesn't need to import router hooks directly.
 * URLs: /country/LB/16692500 (shortId) or /country/LB/church/legacy-id (legacy).
 */
export function ChurchMapPage() {
  const location = useLocation();
  const nav = useNavigate();

  // Redirect legacy /state/ URLs to /country/
  useEffect(() => {
    if (location.pathname.startsWith("/state/")) {
      const newPath = location.pathname.replace(/^\/state\//, "/country/");
      nav(newPath + location.search, { replace: true });
    }
  }, [location.pathname, location.search, nav]);

  const routeParams = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    // Support both /country/ and legacy /state/ (before redirect)
    const isCountryRoute = parts[0] === "country" || parts[0] === "state";
    const countryCode =
      isCountryRoute && parts[1] ? parts[1].toUpperCase() : null;
    const segment1 = parts[2];
    const segment2 = parts[3];
    const legacyChurchId =
      segment1 === "church" && segment2
        ? decodeURIComponent(segment2)
        : null;
    const churchShortId =
      segment1 && segment1 !== "church" ? segment1 : null;
    const openReviewModalFromQuery =
      new URLSearchParams(location.search).get("review") === "true";
    return { stateAbbrev: countryCode, churchShortId, legacyChurchId, openReviewModalFromQuery };
  }, [location.pathname, location.search]);

  const navigateToState = useCallback(
    (abbrev: string) => nav(`/country/${abbrev}`),
    [nav]
  );
  const navigateToStateWithReview = useCallback(
    (abbrev: string) => nav(`/country/${abbrev}?review=true`),
    [nav]
  );
  const navigateToChurch = useCallback(
    (countryCode: string, churchShortId: string, options?: { replace?: boolean }) =>
      nav(`/country/${countryCode}/${churchShortId}`, options ?? {}),
    [nav]
  );
  const navigateToNational = useCallback(() => nav("/"), [nav]);

  const clearReviewQueryParam = useCallback(() => {
    if (new URLSearchParams(location.search).get("review") === "true") {
      nav(location.pathname, { replace: true });
    }
  }, [nav, location.pathname, location.search]);

  return (
    <ChurchMap
      routeStateAbbrev={routeParams.stateAbbrev}
      routeChurchShortId={routeParams.churchShortId}
      routeLegacyChurchId={routeParams.legacyChurchId}
      openReviewModalFromQuery={routeParams.openReviewModalFromQuery}
      clearReviewQueryParam={clearReviewQueryParam}
      navigateToState={navigateToState}
      navigateToStateWithReview={navigateToStateWithReview}
      navigateToChurch={navigateToChurch}
      navigateToNational={navigateToNational}
    />
  );
}
