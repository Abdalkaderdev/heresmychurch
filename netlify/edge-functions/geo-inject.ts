/**
 * Netlify Edge Function: inject detected country code into HTML for client-side preselection.
 * Uses context.geo (no third-party API).
 */
import type { Context } from "https://edge.netlify.com";

// Middle East countries covered by this app
const VALID_COUNTRIES = new Set([
  "SA", "AE", "QA", "KW", "BH", "OM", "JO", "LB", "SY", "IQ",
  "EG", "LY", "TN", "DZ", "MA", "MR", "SD", "YE", "DJ", "KM",
  "SO", "PS", "TR",
]);

export default async function handler(request: Request, context: Context): Promise<Response> {
  const response = await context.next();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const country = context.geo?.country?.code;
  if (!country || !VALID_COUNTRIES.has(country))
    return response;

  const html = await response.text();
  const tag = `<meta name="x-user-region" content="${country}" />`;
  const out = html.replace("</head>", `${tag}\n</head>`);
  return new Response(out, { status: response.status, headers: response.headers });
}
