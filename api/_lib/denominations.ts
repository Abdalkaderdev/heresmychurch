// Denomination matching rules for Middle East churches
type DenomRule = [string, string[]?, string?, string[]?];

const RULES: DenomRule[] = [
  // Orthodox churches (largest Christian presence in Middle East)
  ["Coptic Orthodox", ["coptic orthodox", "coptic_orthodox"]],
  ["Coptic Orthodox", , "\\b(coptic|قبطي)\\b", ["catholic"]],
  ["Greek Orthodox", ["greek orthodox", "greek_orthodox", "rum orthodox"]],
  ["Greek Orthodox", , "\\brum\\b", ["catholic"]],
  ["Armenian Apostolic", ["armenian apostolic", "armenian_apostolic", "armenian orthodox"]],
  ["Armenian Apostolic", , "\\barmenian\\b", ["catholic"]],
  ["Syriac Orthodox", ["syriac orthodox", "syrian orthodox", "syriac_orthodox"]],
  ["Antiochian Orthodox", ["antiochian", "antioch orthodox"]],
  ["Ethiopian Orthodox", ["ethiopian orthodox", "ethiopian_orthodox"]],
  ["Eritrean Orthodox", ["eritrean orthodox", "eritrean_orthodox"]],
  ["Orthodox", ["orthodox"]],
  // Eastern Catholic (in communion with Rome)
  ["Maronite Catholic", ["maronite"]],
  ["Melkite Catholic", ["melkite", "melkite greek catholic"]],
  ["Chaldean Catholic", ["chaldean"]],
  ["Coptic Catholic", ["coptic catholic"]],
  ["Armenian Catholic", ["armenian catholic"]],
  ["Syriac Catholic", ["syriac catholic", "syrian catholic"]],
  // Latin Catholic
  ["Catholic", ["catholic", "roman_catholic"]],
  ["Catholic", , "\\b(parish|basilica|sacred heart|immaculate|our lady|blessed sacrament|holy (family|cross|spirit|trinity|rosary|name|redeemer))\\b", ["orthodox", "maronite", "melkite", "chaldean", "coptic", "armenian", "syriac"]],
  ["Catholic", , "\\bst\\. (patrick|joseph|mary|anne|anthony|michael|peter|paul|john|james|francis|theresa|catherine|augustine|thomas|elizabeth|jude)\\b", ["orthodox", "lutheran", "episcopal", "baptist", "methodist", "presbyterian", "anglican"]],
  // Assyrian Church of the East
  ["Assyrian Church of the East", ["assyrian church", "church of the east"]],
  ["Assyrian Church of the East", , "\\bassyrian\\b", ["catholic"]],
  // Protestant mainline
  ["Anglican", ["anglican", "episcopal", "church of england"]],
  ["Lutheran", ["lutheran"]],
  ["Presbyterian", ["presbyterian"]],
  ["Methodist", ["methodist", "wesleyan"]],
  ["Baptist", ["baptist"]],
  // Evangelical/Pentecostal
  ["Assemblies of God", ["assemblies of god", "assembly of god", "assemblies_of_god", "assembly_of_god"]],
  ["Pentecostal", ["pentecostal", "foursquare", "full gospel"]],
  ["Evangelical", ["evangelical", "bible church"]],
  // Seventh-day Adventist
  ["Seventh-day Adventist", ["seventh", "adventist", "sda"]],
  // Expat/International churches
  ["Non-denominational", ["nondenominational", "non-denominational", "non_denominational", "community church", "international church", "fellowship"]],
  ["Non-denominational", , "\\b(international|expat|fellowship|worship center|faith church|grace church|bible fellowship|international christian)\\b"],
  // Salvation Army
  ["Salvation Army", ["salvation army"]],
  // Arabic church names
  ["Non-denominational", , "\\b(كنيسة|كنيست)\\b"],
];

interface CompiledRule {
  result: string;
  includes?: string[];
  excludes?: string[];
  regex: RegExp | null;
}

let compiled: CompiledRule[] = [];

function getCompiled(): CompiledRule[] {
  if (compiled.length) return compiled;
  compiled = RULES.map(([result, includes, pattern, excludes]) => ({
    result,
    includes,
    excludes: excludes ? (typeof excludes === "string" ? excludes.split(",") : excludes) : undefined,
    regex: pattern ? new RegExp(pattern, "i") : null,
  }));
  return compiled;
}

function matchDenomination(text: string): string | null {
  const lower = text.toLowerCase().replace(/[''ʼ]/g, "'").replace(/[‐–—]/g, "-");
  for (const { result, includes, excludes, regex } of getCompiled()) {
    if (excludes && excludes.some(e => lower.includes(e))) continue;
    if (includes && includes.some(inc => lower.includes(inc))) {
      if (regex) {
        if (regex.test(lower)) return result;
      } else {
        return result;
      }
      continue;
    }
    if (regex && !includes && regex.test(lower)) return result;
  }
  return null;
}

export function normalizeDenomination(tags: Record<string, string>): string {
  if (tags.denomination) {
    const m = matchDenomination(tags.denomination);
    if (m) return m;
    const c = tags.denomination.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()).substring(0, 40);
    if (c && c !== "Unknown" && c !== "Other") return c;
  }
  for (const k of ["operator", "network"]) {
    if (tags[k]) {
      const m = matchDenomination(tags[k]);
      if (m) return m;
    }
  }
  if (tags.brand) {
    const m = matchDenomination(tags.brand);
    if (m) return m;
  }
  const name = tags.name || tags["name:en"] || "";
  if (name) {
    const m = matchDenomination(name);
    if (m) return m;
  }
  for (const k of ["description", "note", "official_name", "alt_name", "website"]) {
    if (tags[k]) {
      const m = matchDenomination(tags[k]);
      if (m) return m;
    }
  }
  return "Non-denominational";
}

// Middle East church attendance medians
export const DMED: Record<string, number> = {
  "Coptic Orthodox": 150,
  "Greek Orthodox": 100,
  "Armenian Apostolic": 80,
  "Syriac Orthodox": 60,
  "Antiochian Orthodox": 80,
  "Ethiopian Orthodox": 100,
  "Eritrean Orthodox": 60,
  "Orthodox": 80,
  "Maronite Catholic": 200,
  "Melkite Catholic": 100,
  "Chaldean Catholic": 80,
  "Coptic Catholic": 60,
  "Armenian Catholic": 50,
  "Syriac Catholic": 50,
  "Catholic": 150,
  "Assyrian Church of the East": 50,
  "Anglican": 80,
  "Lutheran": 60,
  "Presbyterian": 60,
  "Methodist": 50,
  "Baptist": 70,
  "Assemblies of God": 100,
  "Pentecostal": 80,
  "Evangelical": 100,
  "Seventh-day Adventist": 40,
  "Non-denominational": 120,
  "Salvation Army": 30,
};

// Blocked denominations
const BLOCKED_DENOMINATIONS_CANONICAL = new Set<string>([
  "Latter-day Saints",
  "Jehovah's Witnesses",
  "Unitarian",
  "Christian Science",
]);

const BLOCKED_DENOMINATION_KEYWORDS = [
  "latter-day saints",
  "latter day saints",
  "church of jesus christ of latter-day saints",
  "lds",
  "mormon",
  "mormons",
  "jehovah's witnesses",
  "jehovahs witnesses",
  "unitarian",
  "unitarian universalist",
  "universalist unitarian",
  "christian science",
  "church of christ, scientist",
];

export function isBlockedDenomination(denomination: string | undefined | null): boolean {
  if (!denomination) return false;
  const v = denomination.trim();
  if (!v) return false;
  if (BLOCKED_DENOMINATIONS_CANONICAL.has(v)) return true;
  const l = v.toLowerCase();
  return BLOCKED_DENOMINATION_KEYWORDS.some(k => l.includes(k));
}
