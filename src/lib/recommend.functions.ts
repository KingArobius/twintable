import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exactRestaurantLocation, restaurantMapsUrl, type GeocodedPlace } from "./restaurant-location";

export type Recommendation = {
  name: string;
  neighborhood: string;
  cuisine: string;
  price: 1 | 2 | 3 | 4;
  summary: string;
  ratings: { food: number; ambiance: number; service: number; menu: number; overall: number };
  lat?: number | undefined;
  lng?: number | undefined;
  mapsUrl: string;
  address?: string;
  placeId?: string;
};

async function geocode(name: string, address: string | undefined, city: string) {
  const lk = process.env["LOVABLE_API_KEY"];
  const gk = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lk || !gk || !address?.trim()) return null;
  try {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(`${name}, ${address}, ${city}`)}`,
      { headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk } },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Google location lookup failed [${res.status}]: ${body}`);
      if (res.status === 403) throw new Error("Google Maps denied the location lookup. Check the server key's API and application restrictions in Google Cloud Console.");
      throw new Error(`Google location lookup failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { status?: string; error_message?: string; results?: GeocodedPlace[] };
    if (json.status && !["OK", "ZERO_RESULTS"].includes(json.status)) throw new Error(`Google location lookup failed: ${json.status} ${json.error_message ?? ""}`);
    return exactRestaurantLocation(json.results ?? []);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export const recommendRestaurants = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ restaurant: z.string().trim().min(1).max(120), city: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateMessage, GatewayError } = await import("@lovable.dev/ai-gateway");
    const prompt = `Find 6 real restaurants in ${data.city} that are most similar to "${data.restaurant}". Include the full street address of the specific branch in that city (street number, street, city, region). Never supply only a city as an address; if the street address is unknown use an empty string. Rate each 1-5 (half stars allowed) on how similar it is to "${data.restaurant}" for: food (cuisine & dishes), ambiance (vibe & decor), service (style of service), menu (format/price-structure similarity), and overall similarity. price is 1-4 ($ to $$$$). Reply with ONLY JSON, no prose: {"reference":"exactly 3 short words describing ${data.restaurant}, separated by dots, e.g. No-frills · Authentic · Cheap","results":[{"name":"","address":"","neighborhood":"","cuisine":"","price":2,"summary":"why it's similar, 1-2 sentences","ratings":{"food":4.5,"ambiance":4,"service":4,"menu":3.5,"overall":4}}]}`;
    try {
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
      const parsed = JSON.parse(json) as { reference: string; results: Recommendation[] };
      const results = await Promise.all(
        parsed.results.slice(0, 6).map(async (r) => {
          const loc = await geocode(r.name, r.address, data.city);
          return {
            ...r,
            lat: loc?.lat,
            lng: loc?.lng,
            address: loc?.address,
            placeId: loc?.placeId,
            mapsUrl: restaurantMapsUrl(r.name, loc?.address ?? data.city, loc?.placeId),
          };
        }),
      );
      return { ok: true as const, reference: parsed.reference, results };
    } catch (e) {
      console.error(e);
      const msg = e instanceof GatewayError ? "The AI service is busy or unavailable. Please try again." : "Couldn't read the recommendations. Please try again.";
      return { ok: false as const, error: msg };
    }
  });
