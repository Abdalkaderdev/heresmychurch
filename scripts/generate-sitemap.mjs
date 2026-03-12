#!/usr/bin/env node
/**
 * Generates public/sitemap.xml with homepage and all country URLs.
 * Run before build (e.g. prebuild) so dist includes the sitemap.
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://heresmychurch.com";

// Country abbreviations matching map-constants (23 Middle East countries)
const COUNTRY_ABBREVS = [
  "SA", "AE", "QA", "KW", "BH", "OM", "JO", "LB", "SY", "IQ",
  "EG", "LY", "TN", "DZ", "MA", "MR", "SD", "YE", "DJ", "KM",
  "SO", "PS", "TR",
];

const now = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: `${BASE}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${BASE}/llms.txt`, changefreq: "monthly", priority: "0.3" },
  ...COUNTRY_ABBREVS.map((abbrev) => ({
    loc: `${BASE}/country/${abbrev}`,
    changefreq: "weekly",
    priority: "0.8",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

const outPath = join(__dirname, "..", "public", "sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log("Wrote", outPath);
