import { createBrowserRouter } from "react-router";
import { ChurchMapPage } from "./components/ChurchMapPage";
import { RouteError } from "./components/RouteError";

// All routes render ChurchMapPage — URL params drive the map state
// /                             → Regional overview (Middle East)
// /country/:countryCode         → Country view (zoomed into a country with churches)
// /country/:countryCode/:segment1/:segment2? → segment1=8-digit shortId (new) or "church" + segment2=legacy churchId
export const router = createBrowserRouter([
  { path: "/", Component: ChurchMapPage, ErrorBoundary: RouteError },
  { path: "/country/:stateAbbrev", Component: ChurchMapPage, ErrorBoundary: RouteError },
  { path: "/country/:stateAbbrev/:segment1/:segment2?", Component: ChurchMapPage, ErrorBoundary: RouteError },
  // Legacy /state/ routes redirect to /country/
  { path: "/state/:stateAbbrev", Component: ChurchMapPage, ErrorBoundary: RouteError },
  { path: "/state/:stateAbbrev/:segment1/:segment2?", Component: ChurchMapPage, ErrorBoundary: RouteError },
  { path: "*", Component: ChurchMapPage, ErrorBoundary: RouteError },
]);
