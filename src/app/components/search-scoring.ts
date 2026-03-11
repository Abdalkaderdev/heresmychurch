/**
 * Relevance scoring for church search. Keeps server (make-server) in sync when
 * changing: same rules are inlined in the Edge Function.
 */

const PHRASE_IN_NAME = 1000;
const ALL_TOKENS_IN_NAME = 500;
const NAME_STARTS_WITH_FIRST = 300;
const TOKEN_IN_NAME = 50;
const TOKEN_IN_CITY_OR_ADDRESS = 30;

export interface ChurchForScoring {
  name: string;
  city?: string;
  address?: string;
}

/**
 * Returns a relevance score for a church match. Higher = better.
 * Name match is primary; city/address add refinement boost.
 */
export function scoreChurchMatch(
  query: string,
  church: ChurchForScoring
): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const tokens = q.split(/\s+/).filter(Boolean);
  const name = (church.name || "").toLowerCase();
  const city = (church.city || "").toLowerCase();
  const address = (church.address || "").toLowerCase();

  let score = 0;

  // Query as phrase in name (e.g. "grace church" in "Grace Community Church")
  if (name.includes(q)) {
    score += PHRASE_IN_NAME;
  }

  // All tokens found in name
  const tokensInName = tokens.filter((t) => name.includes(t));
  if (tokensInName.length === tokens.length) {
    score += ALL_TOKENS_IN_NAME;
  }

  // Name starts with first token
  if (tokens.length > 0 && name.startsWith(tokens[0])) {
    score += NAME_STARTS_WITH_FIRST;
  }

  // Per-token in name
  score += tokensInName.length * TOKEN_IN_NAME;

  // Refinement: each token in city or address
  for (const t of tokens) {
    if (city.includes(t) || address.includes(t)) {
      score += TOKEN_IN_CITY_OR_ADDRESS;
    }
  }

  return score;
}
