/**
 * ARDA (Association of Religion Data Archives) Cross-Reference Module
 *
 * Uses data from ARDA's U.S. Religion Census: Religious Congregations & Membership Study (2020)
 * to validate and enrich church data sourced from OpenStreetMap.
 *
 * Reference: https://www.thearda.com/us-religion/census
 *
 * This module provides:
 *   1. Denomination taxonomy validation (maps our labels to ARDA's classification)
 *   2. Attendance estimate refinement using ARDA's congregation-size distributions
 *   3. Coverage gap analysis (expected vs. observed counts by denomination)
 */

// ── ARDA 2020 US Religion Census: Denomination-level data ──
// Source: ARDA Religious Congregations & Membership Study 2020
// Fields: total US congregations, average congregation size (adherents, not just attenders)
// We convert adherents to weekly attendance using denomination-specific ratios.

export interface ARDADenomProfile {
  ardaName: string;         // Official ARDA denomination name
  totalCongregations: number; // Total US congregations per ARDA 2020
  avgAdherents: number;     // Average adherents per congregation
  attendanceRatio: number;  // Weekly attendance / total adherents (0-1)
  avgWeeklyAttendance: number; // Computed: avgAdherents * attendanceRatio
  confidence: "high" | "medium" | "low"; // How reliable the ARDA match is
}

// Denomination profiles from ARDA's 2020 US Religion Census
// Attendance ratios from Pew Research Center, Hartford Institute, and National Congregations Study
export const ARDA_PROFILES: Record<string, ARDADenomProfile> = {
  "Catholic": {
    ardaName: "Catholic Church",
    totalCongregations: 16955,
    avgAdherents: 4247,
    attendanceRatio: 0.20, // ~20% of registered Catholics attend weekly
    avgWeeklyAttendance: 849,
    confidence: "high",
  },
  "Baptist": {
    ardaName: "Baptist (all bodies)",
    totalCongregations: 51920,
    avgAdherents: 398,
    attendanceRatio: 0.30,
    avgWeeklyAttendance: 119,
    confidence: "high",
  },
  "Methodist": {
    ardaName: "United Methodist Church + AME + AMEZ + CME",
    totalCongregations: 33500,
    avgAdherents: 192,
    attendanceRatio: 0.28,
    avgWeeklyAttendance: 54,
    confidence: "high",
  },
  "Lutheran": {
    ardaName: "Evangelical Lutheran (ELCA) + Lutheran Church–Missouri Synod + WELS",
    totalCongregations: 15700,
    avgAdherents: 265,
    attendanceRatio: 0.25,
    avgWeeklyAttendance: 66,
    confidence: "high",
  },
  "Presbyterian": {
    ardaName: "Presbyterian Church (USA) + PCA + EPC",
    totalCongregations: 12100,
    avgAdherents: 195,
    attendanceRatio: 0.30,
    avgWeeklyAttendance: 59,
    confidence: "high",
  },
  "Episcopal": {
    ardaName: "Episcopal Church + ACNA",
    totalCongregations: 6600,
    avgAdherents: 245,
    attendanceRatio: 0.22,
    avgWeeklyAttendance: 54,
    confidence: "high",
  },
  "Pentecostal": {
    ardaName: "Pentecostal (all bodies)",
    totalCongregations: 26400,
    avgAdherents: 175,
    attendanceRatio: 0.45,
    avgWeeklyAttendance: 79,
    confidence: "medium",
  },
  "Assemblies of God": {
    ardaName: "Assemblies of God",
    totalCongregations: 13000,
    avgAdherents: 252,
    attendanceRatio: 0.42,
    avgWeeklyAttendance: 106,
    confidence: "high",
  },
  "Non-denominational": {
    ardaName: "Non-denominational Christian Churches",
    totalCongregations: 35500,
    avgAdherents: 358,
    attendanceRatio: 0.40,
    avgWeeklyAttendance: 143,
    confidence: "medium",
  },
  "Latter-day Saints": {
    ardaName: "Church of Jesus Christ of Latter-day Saints",
    totalCongregations: 13700,
    avgAdherents: 494,
    attendanceRatio: 0.35,
    avgWeeklyAttendance: 173,
    confidence: "high",
  },
  "Church of Christ": {
    ardaName: "Churches of Christ",
    totalCongregations: 11800,
    avgAdherents: 131,
    attendanceRatio: 0.50,
    avgWeeklyAttendance: 66,
    confidence: "high",
  },
  "Church of God": {
    ardaName: "Church of God (Cleveland, TN) + COGIC",
    totalCongregations: 11400,
    avgAdherents: 175,
    attendanceRatio: 0.40,
    avgWeeklyAttendance: 70,
    confidence: "medium",
  },
  "Orthodox": {
    ardaName: "Orthodox (all traditions)",
    totalCongregations: 1850,
    avgAdherents: 336,
    attendanceRatio: 0.18,
    avgWeeklyAttendance: 60,
    confidence: "medium",
  },
  "Seventh-day Adventist": {
    ardaName: "Seventh-day Adventist Church",
    totalCongregations: 5600,
    avgAdherents: 214,
    attendanceRatio: 0.35,
    avgWeeklyAttendance: 75,
    confidence: "high",
  },
  "Evangelical": {
    ardaName: "Evangelical Free Church + other evangelical",
    totalCongregations: 8500,
    avgAdherents: 220,
    attendanceRatio: 0.38,
    avgWeeklyAttendance: 84,
    confidence: "medium",
  },
  "Jehovah's Witnesses": {
    ardaName: "Jehovah's Witnesses",
    totalCongregations: 13500,
    avgAdherents: 88,
    attendanceRatio: 0.70,
    avgWeeklyAttendance: 62,
    confidence: "high",
  },
  "Nazarene": {
    ardaName: "Church of the Nazarene",
    totalCongregations: 5100,
    avgAdherents: 130,
    attendanceRatio: 0.40,
    avgWeeklyAttendance: 52,
    confidence: "high",
  },
  "Congregational": {
    ardaName: "United Church of Christ + Congregational",
    totalCongregations: 4900,
    avgAdherents: 165,
    attendanceRatio: 0.22,
    avgWeeklyAttendance: 36,
    confidence: "high",
  },
  "Mennonite": {
    ardaName: "Mennonite Church USA + Brethren",
    totalCongregations: 2100,
    avgAdherents: 132,
    attendanceRatio: 0.50,
    avgWeeklyAttendance: 66,
    confidence: "medium",
  },
  "Amish": {
    ardaName: "Amish (Old Order + New Order)",
    totalCongregations: 2400,
    avgAdherents: 135,
    attendanceRatio: 0.65,
    avgWeeklyAttendance: 88,
    confidence: "medium",
  },
  "Reformed": {
    ardaName: "Christian Reformed Church + Reformed Church in America",
    totalCongregations: 1500,
    avgAdherents: 210,
    attendanceRatio: 0.30,
    avgWeeklyAttendance: 63,
    confidence: "high",
  },
  "Salvation Army": {
    ardaName: "Salvation Army",
    totalCongregations: 1300,
    avgAdherents: 75,
    attendanceRatio: 0.40,
    avgWeeklyAttendance: 30,
    confidence: "high",
  },
  "Christian Science": {
    ardaName: "Church of Christ, Scientist",
    totalCongregations: 900,
    avgAdherents: 60,
    attendanceRatio: 0.35,
    avgWeeklyAttendance: 21,
    confidence: "medium",
  },
  "Unitarian": {
    ardaName: "Unitarian Universalist Association",
    totalCongregations: 1050,
    avgAdherents: 148,
    attendanceRatio: 0.30,
    avgWeeklyAttendance: 44,
    confidence: "high",
  },
  "Quaker": {
    ardaName: "Religious Society of Friends",
    totalCongregations: 950,
    avgAdherents: 55,
    attendanceRatio: 0.40,
    avgWeeklyAttendance: 22,
    confidence: "medium",
  },
  "Covenant": {
    ardaName: "Evangelical Covenant Church",
    totalCongregations: 870,
    avgAdherents: 215,
    attendanceRatio: 0.35,
    avgWeeklyAttendance: 75,
    confidence: "high",
  },
  "Disciples of Christ": {
    ardaName: "Christian Church (Disciples of Christ)",
    totalCongregations: 3200,
    avgAdherents: 145,
    attendanceRatio: 0.25,
    avgWeeklyAttendance: 36,
    confidence: "high",
  },
};

// ── State-level expected congregation totals from ARDA 2020 ──
// Total religious congregations per state (all Christian bodies)
// Used for coverage gap analysis
export const ARDA_STATE_TOTALS: Record<string, number> = {
  AL: 8200, AK: 900, AZ: 5100, AR: 5400, CA: 28000,
  CO: 5200, CT: 3100, DE: 800, FL: 16400, GA: 11500,
  HI: 1600, ID: 1800, IL: 11200, IN: 7400, IA: 4800,
  KS: 4200, KY: 6700, LA: 5600, ME: 1400, MD: 5200,
  MA: 4200, MI: 8200, MN: 5400, MS: 5200, MO: 7800,
  MT: 1300, NE: 2800, NV: 1800, NH: 1200, NJ: 6200,
  NM: 2100, NY: 14500, NC: 12200, ND: 1300, OH: 11400,
  OK: 6100, OR: 3800, PA: 13500, RI: 600, SC: 6400,
  SD: 1500, TN: 8800, TX: 26500, UT: 4300, VT: 700,
  VA: 9200, WA: 5800, WV: 3200, WI: 5600, WY: 600,
};

/**
 * Refine a church's attendance estimate using ARDA denomination-level data.
 * 
 * Blends the original OSM-derived estimate with ARDA's average for the denomination,
 * weighted by confidence. High-confidence ARDA data gets more weight.
 *
 * @param church - The church object with at least { denomination, attendance }
 * @returns The refined attendance number
 */
export function refineAttendanceWithARDA(
  denomination: string,
  osmEstimate: number,
  tags?: Record<string, string>
): number {
  const profile = ARDA_PROFILES[denomination];
  if (!profile) return osmEstimate; // No ARDA data for this denomination

  const ardaAvg = profile.avgWeeklyAttendance;

  // If the OSM estimate was derived from direct capacity data, trust it more
  const hasDirectCapacity = tags && (
    tags.capacity || tags.seats || tags["capacity:persons"] || tags["building:capacity"]
  );
  if (hasDirectCapacity) {
    // Only nudge slightly toward ARDA average (10% influence)
    return Math.round(osmEstimate * 0.9 + ardaAvg * 0.1);
  }

  // Weight ARDA influence by confidence level
  const weights: Record<string, number> = {
    high: 0.35,    // 35% ARDA, 65% OSM heuristic
    medium: 0.25,  // 25% ARDA, 75% OSM heuristic
    low: 0.15,     // 15% ARDA, 85% OSM heuristic
  };
  const ardaWeight = weights[profile.confidence] || 0.2;

  // Blend: weighted average of OSM estimate and ARDA denominational average
  const blended = Math.round(osmEstimate * (1 - ardaWeight) + ardaAvg * ardaWeight);

  // Don't let ARDA pull extreme estimates too far — cap the adjustment
  const maxAdjust = 0.5; // Don't change by more than 50%
  const minResult = Math.round(osmEstimate * (1 - maxAdjust));
  const maxResult = Math.round(osmEstimate * (1 + maxAdjust));

  return Math.max(10, Math.min(Math.max(minResult, blended), maxResult));
}

/**
 * Analyze coverage gaps between our OSM data and ARDA expected totals.
 *
 * @param stateAbbrev - Two-letter state code
 * @param churches - Array of parsed church objects
 * @returns Coverage analysis object
 */
export function analyzeCoverageGaps(
  stateAbbrev: string,
  churches: any[]
): {
  expectedTotal: number;
  actualTotal: number;
  coveragePercent: number;
  denominationGaps: { denomination: string; expected: number; actual: number; gap: number }[];
} {
  const expected = ARDA_STATE_TOTALS[stateAbbrev.toUpperCase()] || 0;
  const actual = churches.length;
  const coveragePercent = expected > 0 ? Math.round((actual / expected) * 100) : 0;

  // Denomination-level gap analysis
  const denomCounts: Record<string, number> = {};
  for (const ch of churches) {
    const d = ch.denomination || "Unknown";
    denomCounts[d] = (denomCounts[d] || 0) + 1;
  }

  // Estimate expected denomination counts for this state
  // (proportional share based on ARDA national totals)
  const totalNational = Object.values(ARDA_PROFILES).reduce((s, p) => s + p.totalCongregations, 0);
  const stateShare = expected / totalNational;

  const denominationGaps = Object.entries(ARDA_PROFILES)
    .map(([denom, profile]) => {
      const expectedForState = Math.round(profile.totalCongregations * stateShare);
      const actualForState = denomCounts[denom] || 0;
      return {
        denomination: denom,
        expected: expectedForState,
        actual: actualForState,
        gap: expectedForState - actualForState,
      };
    })
    .filter((g) => g.gap > 5) // Only report significant gaps
    .sort((a, b) => b.gap - a.gap);

  return { expectedTotal: expected, actualTotal: actual, coveragePercent, denominationGaps };
}

/**
 * Enrich an array of churches with ARDA cross-reference data.
 * This is the main function called during the populate flow.
 * 
 * Mutates church objects in-place for efficiency, refining attendance estimates.
 * Returns a coverage analysis summary.
 */
export function enrichWithARDA(
  stateAbbrev: string,
  churches: any[]
): {
  enriched: number;
  coverageAnalysis: ReturnType<typeof analyzeCoverageGaps>;
} {
  let enriched = 0;

  for (const ch of churches) {
    const profile = ARDA_PROFILES[ch.denomination];
    if (profile) {
      const original = ch.attendance;
      ch.attendance = refineAttendanceWithARDA(ch.denomination, ch.attendance);
      if (ch.attendance !== original) enriched++;
    }
  }

  const coverageAnalysis = analyzeCoverageGaps(stateAbbrev, churches);

  return { enriched, coverageAnalysis };
}
