/**
 * MapCanvas — extracted from ChurchMap to reduce render-tree depth.
 * Contains ComposableMap, ZoomableGroup, state/county Geographies,
 * the background click-rect, and ChurchDots.
 */
import { memo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { ChurchDots } from "./ChurchDots";
import type { Church, StateInfo } from "./church-data";
import {
  GEO_URL,
  COUNTRY_CODE_TO_ABBREV,
  getStateTier,
  MIDDLE_EAST_COUNTRIES,
} from "./map-constants";

export type CountyStats = {
  byFips: Record<string, { churchCount: number; population: number; perCapita: number; peoplePer: number; name: string }>;
  sortedByPerCapita: Array<{ fips: string; name: string; churchCount: number; population: number; perCapita: number; peoplePer: number }>;
};

interface MapCanvasProps {
  center: [number, number];
  zoom: number;
  minZoom?: number;
  focusedState: string | null;
  hoveredState: string | null;
  states: StateInfo[];
  filteredChurches: Church[];
  selectedChurchId: string | null;
  onMoveEnd: (coords: [number, number], z: number) => void;
  onStateClick: (abbrev: string) => void;
  onResetView: () => void;
  onStateHover: (abbrev: string | null) => void;
  onChurchClick: (church: Church) => void;
  onChurchHover: (church: Church | null) => void;
  isTransitioning: boolean;
  onUserInteractionStart?: () => void;
  countyStats: CountyStats | null;
  hoveredCounty: string | null;
  onCountyHover: (fips: string | null) => void;
}

export const MapCanvas = memo(function MapCanvas({
  center,
  zoom,
  minZoom = 1,
  focusedState,
  hoveredState,
  states,
  filteredChurches,
  selectedChurchId,
  onMoveEnd,
  onStateClick,
  onResetView,
  onStateHover,
  onChurchClick,
  onChurchHover,
  isTransitioning,
  onUserInteractionStart,
  countyStats,
  hoveredCounty,
  onCountyHover,
}: MapCanvasProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const markTouch = useCallback(() => setIsTouchDevice(true), []);

  return (
    <div
      className={isTransitioning ? 'map-transitioning' : ''}
      style={{ width: '100%', height: '100%' }}
      onTouchStart={markTouch}
    >
    <ComposableMap
      projection="geoMercator"
      style={{ width: "100%", height: "100%" }}
      projectionConfig={{
        center: [40, 28],  // Middle East center (lng, lat)
        scale: 600,
      }}
    >
      <ZoomableGroup
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={120}
        onMoveStart={() => { if (onUserInteractionStart) onUserInteractionStart(); }}
        onMoveEnd={({ coordinates, zoom: z }: { coordinates: [number, number]; zoom: number }) => {
          if (coordinates && coordinates[0] != null && coordinates[1] != null) {
            onMoveEnd(coordinates, z);
          }
        }}
      >
        {focusedState && (
          <rect
            x={-500} y={-500} width={2000} height={2000}
            fill="transparent"
            onClick={onResetView}
            style={{ cursor: "pointer" }}
          />
        )}

        <StateGeographies
          focusedState={focusedState}
          hoveredState={hoveredState}
          states={states}
          onStateClick={onStateClick}
          onResetView={onResetView}
          onStateHover={onStateHover}
        />

        {/* County boundaries not applicable for Middle East */}

        {filteredChurches.length > 0 && (
          <ChurchDots
            churches={filteredChurches}
            selectedChurchId={selectedChurchId}
            zoom={zoom}
            center={center}
            onChurchClick={onChurchClick}
            onChurchHover={onChurchHover}
          />
        )}
      </ZoomableGroup>
    </ComposableMap>
    </div>
  );
});

/* ── Country boundaries ── */
const StateGeographies = memo(function StateGeographies({
  focusedState,
  hoveredState,
  states,
  onStateClick,
  onResetView,
  onStateHover,
}: {
  focusedState: string | null;
  hoveredState: string | null;
  states: StateInfo[];
  onStateClick: (abbrev: string) => void;
  onResetView: () => void;
  onStateHover: (abbrev: string | null) => void;
}) {
  return (
    <Geographies geography={GEO_URL}>
      {({ geographies }: { geographies: any[] }) =>
        (geographies || [])
          .filter((geo) => {
            // Only render Middle East countries
            const numericCode = String(geo.id);
            const countryAbbrev = COUNTRY_CODE_TO_ABBREV[numericCode];
            return countryAbbrev && MIDDLE_EAST_COUNTRIES.includes(countryAbbrev);
          })
          .map((geo) => {
            const numericCode = String(geo.id);
            const countryAbbrev = COUNTRY_CODE_TO_ABBREV[numericCode];
            const countryInfo = states.find((s) => s.abbrev === countryAbbrev);
            const isFocused = focusedState === countryAbbrev;
            const isHovered = hoveredState === countryAbbrev;

            const churchCount = countryInfo?.churchCount || 0;
            const tier = getStateTier(churchCount);
            let fill = tier.color;
            if (isFocused) fill = "#C9A0DC";
            else if (isHovered && !focusedState) fill = "#D4B8E8";
            else if (focusedState && !isFocused) fill = "#EDE4F3";

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke={isFocused ? "#6B21A8" : "#C9A0DC"}
                strokeWidth={isFocused ? 1.5 : 0.5}
                onClick={(e: React.MouseEvent) => {
                  if (countryAbbrev && !focusedState) {
                    onStateClick(countryAbbrev);
                  } else if (focusedState && isFocused) {
                    e.stopPropagation();
                  } else if (focusedState && !isFocused) {
                    onResetView();
                  }
                }}
                onMouseEnter={() => onStateHover(countryAbbrev || null)}
                onMouseLeave={() => onStateHover(null)}
                style={{
                  default: { outline: "none", cursor: focusedState && isFocused ? "default" : "pointer" },
                  hover: { outline: "none", cursor: focusedState && isFocused ? "default" : "pointer" },
                  pressed: { outline: "none", cursor: focusedState && isFocused ? "default" : "pointer" },
                }}
              />
            );
          })
      }
    </Geographies>
  );
});

/* County boundaries not applicable for Middle East */