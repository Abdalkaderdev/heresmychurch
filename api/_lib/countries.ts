// Middle East countries (Arab League + Turkey)
export interface CountryInfo {
  abbrev: string;
  name: string;
  lat: number;
  lng: number;
}

export const COUNTRIES: [string, string, number, number][] = [
  ["SA", "Saudi Arabia", 24.71, 46.68],
  ["AE", "United Arab Emirates", 24.47, 54.37],
  ["QA", "Qatar", 25.30, 51.18],
  ["KW", "Kuwait", 29.38, 47.99],
  ["BH", "Bahrain", 26.03, 50.55],
  ["OM", "Oman", 21.47, 55.98],
  ["JO", "Jordan", 31.24, 36.51],
  ["LB", "Lebanon", 33.85, 35.86],
  ["SY", "Syria", 34.80, 39.00],
  ["IQ", "Iraq", 33.22, 43.68],
  ["EG", "Egypt", 26.82, 30.80],
  ["LY", "Libya", 26.34, 17.23],
  ["TN", "Tunisia", 33.89, 9.54],
  ["DZ", "Algeria", 28.03, 1.66],
  ["MA", "Morocco", 31.79, -7.09],
  ["MR", "Mauritania", 21.01, -10.94],
  ["SD", "Sudan", 15.50, 32.56],
  ["YE", "Yemen", 15.55, 48.52],
  ["DJ", "Djibouti", 11.59, 42.59],
  ["KM", "Comoros", -11.88, 43.87],
  ["SO", "Somalia", 5.15, 46.20],
  ["PS", "Palestine", 31.95, 35.23],
  ["TR", "Turkey", 38.96, 35.24],
];

export const ME: CountryInfo[] = COUNTRIES.map(([abbrev, name, lat, lng]) => ({
  abbrev,
  name,
  lat,
  lng,
}));

export function getCountry(abbrev: string): CountryInfo | undefined {
  return ME.find(c => c.abbrev === abbrev.toUpperCase());
}

// Country bounding boxes [south, west, north, east]
export const BOUNDS: Record<string, [number, number, number, number]> = {
  SA: [16.38, 34.50, 32.16, 55.67],
  AE: [22.63, 51.50, 26.08, 56.38],
  QA: [24.47, 50.75, 26.15, 51.64],
  KW: [28.52, 46.55, 30.10, 48.43],
  BH: [25.79, 50.45, 26.29, 50.82],
  OM: [16.65, 52.00, 26.39, 59.84],
  JO: [29.19, 34.96, 33.37, 39.30],
  LB: [33.06, 35.10, 34.69, 36.62],
  SY: [32.31, 35.73, 37.32, 42.38],
  IQ: [29.06, 38.79, 37.38, 48.57],
  EG: [22.00, 24.70, 31.67, 36.90],
  LY: [19.50, 9.39, 33.17, 25.15],
  TN: [30.23, 7.52, 37.54, 11.60],
  DZ: [18.97, -8.67, 37.09, 11.98],
  MA: [27.67, -13.17, 35.92, -0.99],
  MR: [14.72, -17.07, 27.30, -4.83],
  SD: [8.68, 21.84, 22.23, 38.58],
  YE: [12.11, 42.55, 19.00, 54.53],
  DJ: [10.94, 41.77, 12.71, 43.42],
  KM: [-12.42, 43.23, -11.36, 44.54],
  SO: [-1.66, 40.99, 11.98, 51.41],
  PS: [31.22, 34.22, 32.55, 35.57],
  TR: [35.82, 25.67, 42.11, 44.82],
};

// Large countries that use 4-quadrant Overpass queries
export const BIG_COUNTRIES = new Set(["EG", "SA", "DZ", "SD", "TR", "LY", "IQ", "MA"]);

// World Bank 2023 population estimates
export const POPULATIONS: Record<string, number> = {
  SA: 36400000,
  AE: 9440000,
  QA: 2700000,
  KW: 4300000,
  BH: 1500000,
  OM: 4600000,
  JO: 11300000,
  LB: 5500000,
  SY: 22100000,
  IQ: 44500000,
  EG: 109300000,
  LY: 6900000,
  TN: 12400000,
  DZ: 45600000,
  MA: 37100000,
  MR: 4900000,
  SD: 46700000,
  YE: 33700000,
  DJ: 1100000,
  KM: 900000,
  SO: 17600000,
  PS: 5300000,
  TR: 85300000,
};
