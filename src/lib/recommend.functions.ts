import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { googleReview, sortByReviews, type GoogleReview } from "./review-ratings";

export type Recommendation = {
  name: string;
  neighborhood: string;
  cuisine: string;
  price: 1 | 2 | 3 | 4;
  summary: string;
  google: GoogleReview | null;
  rank: number;
  lat?: number | undefined;
  lng?: number | undefined;
  mapsUrl: string;
};

export const recommendRestaurants = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ restaurant: z.string().trim().min(1).max(120), city: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireVisitorSession } = await import("./visitor-session.server");
    await requireVisitorSession();
    const lk = process.env["LOVABLE_API_KEY"];
    const gk = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lk || !gk) return { ok: false as const, error: "Google ratings aren't configured." };
    const { findGoogleRestaurant } = await import("./google-reviews.server");
    const { generateMessage, GatewayError } = await import("@lovable.dev/ai-gateway");
    const prompt = `Find 6 real restaurants in ${data.city} most similar to "${data.restaurant}" for cuisine, dishes, ambiance and service. Use the exact Google Maps listing name and a specific neighborhood to identify a single branch. Do not provide or guess ratings or review counts: these will be retrieved from Google. price is an estimate 1-4 ($ to $$$$). Reply with ONLY JSON: {"reference":"","results":[{"name":"","neighborhood":"","cuisine":"","price":2,"summary":"why it's similar"}]}`;
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
      const parsed = z.object({ results: z.array(z.object({ name: z.string().min(1).max(120), neighborhood: z.string().max(120), cuisine: z.string(), price: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), summary: z.string() })).min(1).max(6) }).parse(JSON.parse(json));
      const candidates = parsed.results.filter((r, i, all) => all.findIndex(other => other.name.toLowerCase() === r.name.toLowerCase()) === i);
      const results: Recommendation[] = [];
      const warnings = new Set<string>();
      // At most six lookups, two at a time, never polling or retrying failed upstream calls.
      for (let i = 0; i < candidates.length; i += 2) {
        const batch = await Promise.all(candidates.slice(i, i + 2).map(async (r): Promise<Recommendation> => {
          try {
            const place = await findGoogleRestaurant(r.name, r.neighborhood, data.city, lk, gk);
            if (!place) warnings.add("Some restaurant listings couldn't be matched confidently; their Google ratings are unavailable.");
            return { ...r, rank: 0, google: googleReview(place), lat: place?.location?.latitude, lng: place?.location?.longitude,
              mapsUrl: place?.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${r.neighborhood}, ${data.city}`)}` };
          } catch (error) {
            warnings.add(error instanceof Error ? error.message : "Google ratings are unavailable.");
            return { ...r, rank: 0, google: null, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${data.city}`)}` };
          }
        }));
        results.push(...batch);
      }
      const ranked = sortByReviews(results, "google", "desc").map((r, i) => ({ ...r, rank: i + 1 }));
      return { ok: true as const, reference: "", results: ranked, warning: [...warnings].join(" ") };
    } catch (e) {
      console.error(e);
      const msg = e instanceof GatewayError ? "The AI service is busy or unavailable. Please try again." : "Couldn't read the recommendations. Please try again.";
      return { ok: false as const, error: msg };
    }
  });
