import { authenticatedUser, jsonResponse, readJson } from "./_shared.js";

const SUPPORTED_GAMES = new Set([
  "pokemon", "pokemon-japan", "magic", "yugioh", "one-piece", "lorcana", "digimon",
  "flesh-and-blood", "grand-archive", "gundam", "star-wars-unlimited", "union-arena",
  "universe", "sorcery", "riftbound", "dragon-ball-super-fusion-world", "hololive-official-card-game",
  "cyberpunk", "dragon-ball-super-masters", "palworld"
]);

export async function onRequestPost({ request, env }) {
  if (env.ENABLE_CARD_PRICING !== "true") return jsonResponse({ error: "Card market lookup is not enabled for this CACHE deployment." }, 503);
  try {
    if (!(await authenticatedUser(request, env))) return jsonResponse({ error: "Sign in again before looking up card values." }, 401);
  } catch {
    return jsonResponse({ error: "Could not validate your CACHE session. Try again." }, 502);
  }
  if (!env.JUSTTCG_API_KEY) return jsonResponse({ error: "The owner needs to add the JustTCG API key as a Cloudflare secret." }, 503);

  let input;
  try { input = await readJson(request, 3000); } catch { return jsonResponse({ error: "Invalid card lookup request." }, 400); }
  const game = typeof input?.game === "string" ? input.game.toLowerCase() : "";
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 100) : "";
  const set = typeof input?.set === "string" ? input.set.trim().slice(0, 100) : "";
  const number = typeof input?.number === "string" ? input.number.trim().slice(0, 40) : "";
  const printing = typeof input?.printing === "string" ? input.printing.trim().slice(0, 80) : "";
  const language = typeof input?.language === "string" ? input.language.trim().slice(0, 40) : "";
  const graded = input?.cardType === "graded";
  const gradingCompanyValue = typeof input?.gradingCompany === "string" ? input.gradingCompany.toUpperCase() : "";
  const gradingCompany = gradingCompanyValue === "BECKETT" ? "BGS" : gradingCompanyValue;
  const grade = typeof input?.grade === "string" ? input.grade.trim().slice(0, 12) : "";
  const variantId = typeof input?.variantId === "string" ? input.variantId.slice(0, 160) : "";

  if (!SUPPORTED_GAMES.has(game)) return jsonResponse({ error: "Choose a supported trading card game. Sports-card values need a separate provider." }, 400);
  if (!variantId && name.length < 2) return jsonResponse({ error: "Enter a card name to search." }, 400);
  if (graded && (!new Set(["PSA", "BGS", "CGC", "BCCG", "BVG", "SGC"]).has(gradingCompany) || !grade)) return jsonResponse({ error: "Enter the grading company and grade recorded on the card." }, 400);

  const params = new URLSearchParams({ regions: "NA", limit: "20" });
  if (variantId) params.set("variant_id", variantId);
  else {
    params.set("game", game);
    params.set("q", [name, set, number && `#${number}`].filter(Boolean).join(" ").slice(0, 220));
    if (number) params.set("number", number);
    params.set("graded", graded ? "only" : "exclude");
    if (graded) {
      params.set("grading_company", gradingCompany);
      params.set("grade", grade);
    }
  }

  try {
    const response = await fetch(`https://api.justtcg.com/v2/cards?${params}`, {
      headers: { "x-api-key": env.JUSTTCG_API_KEY, Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) return jsonResponse({ error: "The card-price provider limit was reached. Wait before trying again." }, 429);
      return jsonResponse({ error: response.status === 401 || response.status === 403 ? "The configured card-price API key is invalid or does not allow this request." : "The card-price provider could not complete this lookup." }, 502);
    }

    const cards = (payload.data || []).slice(0, 20).map((card) => ({
      id: String(card.id || card.slug || ""),
      name: String(card.name || ""),
      game: String(card.game?.name || card.game || ""),
      set: String(card.set?.name || card.set_name || card.set || ""),
      number: String(card.number || ""),
      rarity: String(card.rarity || ""),
      variants: (card.variants || []).slice(0, 40).map((variant) => {
        const market = (variant.markets || []).find((entry) => entry.region === "NA") || variant.markets?.[0] || {};
        const grading = variant.grading || {};
        const periods = market.periods || {};
        const sales90d = Number(periods["90d"]?.sales_count) || 0;
        return {
          id: String(variant.id || variant.slug || ""),
          type: variant.type === "graded" ? "graded" : "raw",
          condition: String(variant.condition || ""),
          printing: String(variant.printing || ""),
          language: String(variant.language || ""),
          grade: String(grading.canonical || (grading.company && grading.grade != null ? `${grading.company} ${grading.grade}` : "")),
          price: market.price == null ? null : Number(market.price),
          lastPrice: market.last_price == null ? null : Number(market.last_price),
          currency: String(market.currency || "USD"),
          priceStatus: String(market.price_status || "unknown"),
          updatedAt: Number(market.updated_at) || 0,
          sales90d,
          priceChange24hPercent: Number.isFinite(Number(market.change_24h_pct)) ? Number(market.change_24h_pct) : null
        };
      })
    })).filter((card) => card.id && card.name);
    return jsonResponse({ cards, provider: "JustTCG", apiVersion: "v2 beta", usage: payload._metadata || null });
  } catch {
    return jsonResponse({ error: "Could not connect to the card-price provider. Try again later." }, 502);
  }
}
