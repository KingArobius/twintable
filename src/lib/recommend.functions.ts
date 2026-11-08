import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type GeocodedPlace } from "./restaurant-location";
import { aiMatchesSchema, recommendationCacheKey } from "./recommendation-cache";
import { MAX_RECOMMENDATION_CANDIDATES, verifyRecommendationCandidates } from "./verified-recommendations";

export type Recommendation = {
  name: string;
  price: 1 | 2 | 3 | 4;
  ratings: { food: number; ambiance: number; service: number; overall: number };
  lat?: number | undefined;
  lng?: number | undefined;
  mapsUrl: string;
  address?: string | undefined;
  placeId?: string | undefined;
  website?: string | undefined;
};

async function geocodeCity(city: string) {
  const lk = process.env["LOVABLE_API_KEY"];
  const gk = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lk || !gk) return null;
  try {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(city)}`,
      { headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: GeocodedPlace[] };
    const loc = json.results?.[0]?.geometry?.location;
    return loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? loc : null;
  } catch {
    return null;
  }
}

export const recommendRestaurants = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ restaurant: z.string().trim().min(1).max(120), city: z.string().trim().min(1).max(120), cityName: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateMessage, GatewayError } = await import("@lovable.dev/ai-gateway");
    const prompt = `Find up to ${MAX_RECOMMENDATION_CANDIDATES} distinct real, currently operating restaurants in ${data.city} most similar to "${data.restaurant}". Include extra candidates so we can select six after Google business verification. Never invent a local branch or include a known closed venue; return fewer if you do not know enough real restaurants. Rank best overall match first. Rate similarity from 1 to 5 in half-star increments: food (cuisine and dishes), ambiance (vibe and decor), service (service style), overall. Price is 1-4 ($-$$$$). Use your independent knowledge, not Google review scores. Return only compact JSON: {"results":[{"name":"Restaurant name","price":2,"ratings":{"food":4.5,"ambiance":4,"service":4,"overall":4}}]}. No addresses, descriptions, reference text, cuisine labels, neighborhoods, or menu scores.`;
    try {
      const { readCachedMatches, writeCachedMatches } = await import("./recommendation-cache.server");
      const cacheKey = await recommendationCacheKey(data);
      let parsed = await readCachedMatches(cacheKey);
      const cached = parsed !== null;
      if (!parsed) {
      const res = await generateMessage({
        model: "anthropic/claude-sonnet-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (res.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      parsed = aiMatchesSchema.parse(JSON.parse(json));
      await writeCachedMatches(cacheKey, parsed);
      }
      const { findRestaurantBusiness } = await import("./google-locations.server");
      const cityLoc = await geocodeCity(data.city);
      const results = await verifyRecommendationCandidates(
        parsed.results,
        (name) => findRestaurantBusiness(name, data.cityName, cityLoc, data.city),
      );
      if (results.length === 0) return { ok: false as const, error: "No open restaurants could be verified for this search. Please try another restaurant or city." };
      return { ok: true as const, reference: "", results, cityLat: cityLoc?.lat, cityLng: cityLoc?.lng, cached };
    } catch (e) {
      console.error(e);
      const msg = e instanceof GatewayError ? "The AI service is busy or unavailable. Please try again." : e instanceof Error && e.message.startsWith("Google") ? e.message : "Couldn't read the recommendations. Please try again.";
      return { ok: false as const, error: msg };
    }
  });
