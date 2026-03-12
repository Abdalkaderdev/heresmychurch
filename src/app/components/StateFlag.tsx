type Size = "sm" | "md";

const dimensions: Record<Size, { width: number; height: number }> = {
  sm: { width: 16, height: 11 },
  md: { width: 24, height: 16 },
};

// ISO 3166-1 alpha-2 to regional indicator flag emoji
// Works in most browsers; falls back to country code text
function countryToEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  // Convert country code to regional indicator symbols
  // 'A' = 0x1F1E6, etc.
  const offset = 0x1F1E6 - 65; // 65 is 'A'
  const first = code.charCodeAt(0) + offset;
  const second = code.charCodeAt(1) + offset;
  return String.fromCodePoint(first, second);
}

// Country name lookup for alt text
const COUNTRY_NAMES: Record<string, string> = {
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  JO: "Jordan",
  LB: "Lebanon",
  SY: "Syria",
  IQ: "Iraq",
  EG: "Egypt",
  LY: "Libya",
  TN: "Tunisia",
  DZ: "Algeria",
  MA: "Morocco",
  MR: "Mauritania",
  SD: "Sudan",
  YE: "Yemen",
  DJ: "Djibouti",
  KM: "Comoros",
  SO: "Somalia",
  PS: "Palestine",
  TR: "Turkey",
};

export function StateFlag({
  abbrev,
  size = "sm",
}: {
  abbrev: string;
  size?: Size;
}) {
  const { width, height } = dimensions[size];
  const countryCode = abbrev.toUpperCase();
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const flagEmoji = countryToEmoji(countryCode);
  const fontSize = size === "sm" ? 12 : 16;

  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-sm flex-shrink-0"
      style={{ width, height, position: "relative", fontSize }}
      aria-label={`Flag of ${countryName}`}
      title={countryName}
    >
      {flagEmoji}
    </span>
  );
}

// Alternative: Use flagcdn.com for SVG flags (more consistent rendering)
export function CountryFlagImage({
  abbrev,
  size = "sm",
}: {
  abbrev: string;
  size?: Size;
}) {
  const { width, height } = dimensions[size];
  const countryCode = abbrev.toLowerCase();
  const countryName = COUNTRY_NAMES[abbrev.toUpperCase()] || abbrev;

  return (
    <img
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
      width={width}
      height={height}
      alt={`Flag of ${countryName}`}
      className="inline-block rounded-sm flex-shrink-0"
      style={{ width, height, objectFit: "cover" }}
      loading="lazy"
    />
  );
}
