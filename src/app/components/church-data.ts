// Types and constants for church map

export interface Church {
  id: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  attendance: number;
  denomination: string;
  address?: string;
  website?: string;
}

export interface StateInfo {
  abbrev: string;
  name: string;
  lat: number;
  lng: number;
  churchCount: number;
  isPopulated: boolean;
}

export type SizeCategory =
  | "< 50"
  | "50–250"
  | "250–500"
  | "500–1,000"
  | "1,000–5,000"
  | "5,000+";

export const sizeCategories: {
  label: SizeCategory;
  min: number;
  max: number;
  radius: number;
  color: string;
}[] = [
  { label: "< 50", min: 0, max: 49, radius: 2.5, color: "#E8D5F5" },
  { label: "50–250", min: 50, max: 250, radius: 4, color: "#C9A0DC" },
  { label: "250–500", min: 251, max: 500, radius: 6, color: "#A855F7" },
  { label: "500–1,000", min: 501, max: 1000, radius: 8, color: "#8B2FC9" },
  { label: "1,000–5,000", min: 1001, max: 5000, radius: 11, color: "#6B21A8" },
  { label: "5,000+", min: 5001, max: Infinity, radius: 15, color: "#4C1D95" },
];

export function getSizeCategory(attendance: number) {
  return (
    sizeCategories.find((c) => attendance >= c.min && attendance <= c.max) ||
    sizeCategories[0]
  );
}

// Major denomination groups for filtering
export const DENOMINATION_GROUPS: { label: string; matches: string[] }[] = [
  { label: "Catholic", matches: ["Catholic"] },
  { label: "Baptist", matches: ["Baptist"] },
  { label: "Methodist", matches: ["Methodist", "Wesleyan"] },
  { label: "Lutheran", matches: ["Lutheran"] },
  { label: "Presbyterian", matches: ["Presbyterian"] },
  { label: "Episcopal", matches: ["Episcopal", "Anglican"] },
  { label: "Pentecostal", matches: ["Pentecostal", "Foursquare"] },
  { label: "Assemblies of God", matches: ["Assemblies of God"] },
  { label: "Latter-day Saints", matches: ["Latter-day Saints"] },
  { label: "Church of Christ", matches: ["Church of Christ"] },
  { label: "Church of God", matches: ["Church of God"] },
  { label: "Orthodox", matches: ["Orthodox", "Coptic", "Antiochian"] },
  { label: "Seventh-day Adventist", matches: ["Seventh-day Adventist"] },
  { label: "Jehovah's Witnesses", matches: ["Jehovah"] },
  { label: "Evangelical", matches: ["Evangelical", "Alliance", "Moravian"] },
  { label: "Nazarene", matches: ["Nazarene"] },
  { label: "Congregational", matches: ["Congregational"] },
  { label: "Disciples of Christ", matches: ["Disciples of Christ"] },
  { label: "Mennonite", matches: ["Mennonite", "Brethren", "Hutterite"] },
  { label: "Amish", matches: ["Amish"] },
  { label: "Reformed", matches: ["Reformed"] },
  { label: "Quaker", matches: ["Quaker", "Friends"] },
  { label: "Covenant", matches: ["Covenant"] },
  { label: "Unitarian", matches: ["Unitarian", "Universalist"] },
  { label: "Salvation Army", matches: ["Salvation Army"] },
  { label: "Christian Science", matches: ["Christian Science", "Scientist"] },
  { label: "Non-denominational", matches: ["Other", "Unknown"] }, // catch-all
];

export function getDenominationGroup(denomination: string): string {
  for (const group of DENOMINATION_GROUPS) {
    if (group.matches.some((m) => denomination.includes(m))) {
      return group.label;
    }
  }
  return "Non-denominational";
}