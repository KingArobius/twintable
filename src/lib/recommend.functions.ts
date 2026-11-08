import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { restaurantMapsUrl, type GeocodedPlace } from "./restaurant-location";
import { aiMatchesSchema, recommendationCacheKey } from "./recommendation-cache";

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
    const prompt = `Find 6 distinct real restaurants in ${data.city} most similar to "${data.restaurant}". Rank best overall match first. Rate similarity from 1 to 5 in half-star increments: food (cuisine and dishes), ambiance (vibe and decor), service (service style), overall. Price is 1-4 ($-$$$$). Use your independent knowledge, not Google review scores. Return only compact JSON: {"results":[{"name":"Restaurant name","price":2,"ratings":{"food":4.5,"ambiance":4,"service":4,"overall":4}}]}. No addresses, descriptions, reference text, cuisine labels, neighborhoods, or menu scores.`;
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
      const lookups = new Map<string, ReturnType<typeof findRestaurantBusiness>>();
      const results = await Promise.all(
        parsed.results.slice(0, 6).map(async (r) => {
          const name = r.name.trim().slice(0, 120);
          const key = name.toLowerCase();
          let lookup = lookups.get(key);
          if (!lookup) {
            lookup = findRestaurantBusiness(name, data.cityName, cityLoc, data.city);
            lookups.set(key, lookup);
          }
          const loc = await lookup;
          return {
            ...r,
            lat: loc?.lat,
            lng: loc?.lng,
            address: loc?.address,
            placeId: loc?.placeId,
            website: loc?.website,
            mapsUrl: restaurantMapsUrl(r.name, loc?.address ?? data.city, loc?.placeId),
          };
        }),
      );
      return { ok: true as const, reference: "", results, cityLat: cityLoc?.lat, cityLng: cityLoc?.lng, cached };
    } catch (e) {
      console.error(e);
      const msg = e instanceof GatewayError ? "The AI service is busy or unavailable. Please try again." : e instanceof Error && e.message.startsWith("Google") ? e.message : "Couldn't read the recommendations. Please try again.";
      return { ok: false as const, error: msg };
    }
  });
