import type { AiMatches } from "./recommendation-cache";
import { hasRestaurantCoordinates, restaurantMapsUrl } from "./restaurant-location";

export const MAX_RECOMMENDATION_RESULTS = 6;
export const MAX_RECOMMENDATION_CANDIDATES = 9;

type Location = { lat: number; lng: number; address: string; placeId: string; website?: string | undefined };

// Fill only vacant result slots, keeping provider order and at most six lookups in flight.
export async function verifyRecommendationCandidates(
  candidates: AiMatches["results"],
  lookup: (name: string) => Promise<Location | null>,
) {
  const names = new Set<string>();
  const unique = candidates.slice(0, MAX_RECOMMENDATION_CANDIDATES).filter((candidate) => {
    const key = candidate.name.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
    if (names.has(key)) return false;
    names.add(key);
    return true;
  });
  const results: Array<AiMatches["results"][number] & Location & { mapsUrl: string }> = [];
  const placeIds = new Set<string>();
  let cursor = 0;
  while (cursor < unique.length && results.length < MAX_RECOMMENDATION_RESULTS) {
    const batch = unique.slice(cursor, cursor + MAX_RECOMMENDATION_RESULTS - results.length);
    cursor += batch.length;
    const verified = await Promise.all(batch.map(async (candidate) => ({ candidate, location: await lookup(candidate.name) })));
    for (const { candidate, location } of verified) {
      if (!location || !hasRestaurantCoordinates(location) || !location.address || !location.placeId || placeIds.has(location.placeId)) continue;
      placeIds.add(location.placeId);
      results.push({ ...candidate, ...location, mapsUrl: restaurantMapsUrl(candidate.name, location.address, location.placeId) });
    }
  }
  return results;
}