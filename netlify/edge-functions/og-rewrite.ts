/**
 * Netlify Edge Function: rewrite HTML meta tags for social crawlers
 * so /country/:abbrev and /country/:abbrev/:shortId get correct og:image, og:title, og:url.
 *
 * Required Netlify env vars (for bot requests):
 *   SUPABASE_FUNCTIONS_BASE_URL - e.g. https://PROJECT.supabase.co/functions/v1/make-server-283d8046
 *   SUPABASE_ANON_KEY - Supabase anon key for API calls
 */
import type { Context } from "https://edge.netlify.com";

const BOT_UA_PATTERNS = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Pinterest",
  "Applebot",
  "Googlebot",
  "bingbot",
  "Slurp",
  "DuckDuckBot",
  "Baiduspider",
  "YandexBot",
  "facebot",
  "ia_archiver",
];

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

const SITE_URL = "https://heresmychurch.com";
const DEFAULT_DESCRIPTION = "An interactive map of Christian churches in the Middle East. Find your church or find a new church. 100% free and crowd-sourced.";

function isBot(userAgent: string): boolean {
  const ua = userAgent || "";
  return BOT_UA_PATTERNS.some((p) => ua.includes(p));
}

function getCountryName(abbrev: string): string {
  return COUNTRY_NAMES[abbrev.toUpperCase()] ?? abbrev;
}

interface OgMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!isBot(userAgent)) {
    return context.next();
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split("/").filter(Boolean); // ["country", "LB"] or ["country", "LB", "16692500"]

  const apiBase = Deno.env.get("SUPABASE_FUNCTIONS_BASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!apiBase || !anonKey) {
    return context.next();
  }

  let meta: OgMeta = {
    title: "Here's My Church - Middle East",
    description: DEFAULT_DESCRIPTION,
    image: `${SITE_URL}/og-image.png`,
    url: SITE_URL,
  };

  // Support both /country/ and legacy /state/ URLs
  if ((pathParts[0] === "country" || pathParts[0] === "state") && pathParts[1]) {
    const countryAbbrev = pathParts[1].toUpperCase();
    const shortId = pathParts[2];

    if (!shortId) {
      const countryName = getCountryName(countryAbbrev);
      meta = {
        title: `Churches in ${countryName}`,
        description: `Find Christian churches in ${countryName}. ${DEFAULT_DESCRIPTION}`,
        image: `${apiBase}/og-image?type=state&state=${encodeURIComponent(countryAbbrev)}`,
        url: `${SITE_URL}/country/${countryAbbrev}`,
      };
    } else {
      try {
        const res = await fetch(`${apiBase}/churches/${countryAbbrev}`, {
          headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          const churches = data.churches ?? [];
          const church = churches.find((c: { shortId?: string }) => String(c.shortId) === String(shortId));
          if (church) {
            const name = church.name ?? "Church";
            const city = church.city ?? "";
            const denom = church.denomination ?? "";
            const ogParams = new URLSearchParams({
              type: "church",
              name: name,
              state: countryAbbrev,
            });
            if (city) ogParams.set("city", city);
            if (denom) ogParams.set("denomination", denom);
            meta = {
              title: name,
              description: [city, countryAbbrev].filter(Boolean).join(", ") + (denom ? ` · ${denom}` : ""),
              image: `${apiBase}/og-image?${ogParams.toString()}`,
              url: `${SITE_URL}/country/${countryAbbrev}/${shortId}`,
            };
          }
        }
      } catch (_) {
        // keep default meta
      }
    }
  }

  const response = await context.next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();

  function escapeAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let out = html;
  out = out.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeAttr(meta.title)}" />`);
  out = out.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${escapeAttr(meta.url)}" />`);
  out = out.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${escapeAttr(meta.image)}" />`);
  out = out.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escapeAttr(meta.description)}" />`);
  out = out.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`);
  out = out.replace(/<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:url" content="${escapeAttr(meta.url)}" />`);
  out = out.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`);
  out = out.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`);
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(meta.title)}</title>`);

  return new Response(out, {
    status: response.status,
    headers: new Headers(response.headers),
  });
}
