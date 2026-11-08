import { selectGooglePlace, type GooglePlace } from "./review-ratings";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
type CacheStore = { match: (request: Request) => Promise<Response | undefined>; put: (request: Request, response: Response) => Promise<void> };

export async function findGoogleRestaurant(name: string, neighborhood: string, city: string, lovableKey: string, googleKey: string): Promise<GooglePlace | null> {
  const query = `${name}, ${neighborhood}, ${city}`;
  // Edge cache is optional in development; no module-global snapshots or polling.
  const cache = (globalThis as typeof globalThis & { caches?: { default?: CacheStore } }).caches?.default;
  const cacheRequest = new Request(`https://twin-table-cache.invalid/google-place?q=${encodeURIComponent(query)}`);
  const cached = await cache?.match(cacheRequest);
  if (cached) return await cached.json() as GooglePlace | null;
  const response = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": googleKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.businessStatus",
    },
    body: JSON.stringify({ textQuery: query, pageSize: 3 }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google ratings failed [${response.status}]: ${body}`);
    if (response.status === 403) {
      if (body.includes("API_KEY_HTTP_REFERRER_BLOCKED")) throw new Error(`Google server key is referrer-restricted; update its application restrictions. [403]: ${body}`);
      if (body.includes("API_KEY_SERVICE_BLOCKED")) throw new Error(`Google server key must allow Places API. [403]: ${body}`);
    }
    throw new Error(`Google ratings failed [${response.status}]: ${body}`);
  }
  const json = await response.json() as { places?: GooglePlace[] };
  const place = selectGooglePlace(name, json.places ?? []);
  await cache?.put(cacheRequest, Response.json(place, { headers: { "Cache-Control": "public, max-age=3600" } }));
  return place;
}