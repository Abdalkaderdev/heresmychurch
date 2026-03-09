import { createBrowserRouter } from "react-router";
import { ChurchMapPage } from "./components/ChurchMapPage";

// All routes render ChurchMapPage — URL params drive the map state
// /                            → National overview
// /state/:stateAbbrev          → State view (zoomed into a state with churches)
// /state/:stateAbbrev/church/:churchId → Church detail panel open
export const router = createBrowserRouter([
  { path: "/", Component: ChurchMapPage },
  { path: "/state/:stateAbbrev", Component: ChurchMapPage },
  { path: "/state/:stateAbbrev/church/:churchId", Component: ChurchMapPage },
  { path: "*", Component: ChurchMapPage },
]);
