import { restaurantBusinessLocation, restaurantLocationQueries, type BusinessPlace } from "./restaurant-location";

export async function findRestaurantBusiness(name: string, city: string, center: { lat: number; lng: number } | null, searchArea = city) {
  const lk = process.env["LOVABLE_API_KEY"];
  const gk = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lk || !gk) throw new Error("Google restaurant lookup isn't configured.");
  const queries = restaurantLocationQueries(name, searchArea);
  for (const [attempt, textQuery] of queries.entries()) {
  const response = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk, "Content-Type": "application/json",
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.addressComponents,places.websiteUri",
    },
    body: JSON.stringify({
      textQuery, pageSize: 6,
      ...(attempt === 0 && center ? { locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 25000 } } } : {}),
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google business lookup failed [${response.status}]: ${body}`);
    if (response.status === 403) {
      let reason: string | undefined;
      try {
        const error = JSON.parse(body) as { error?: { details?: { reason?: string }[] } };
        reason = error.error?.details?.find((detail) => detail.reason)?.reason;
      } catch { /* Preserve Google's original error below. */ }
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") throw new Error("Google Maps server key is referrer-restricted. Set its application restrictions to None or IP addresses in Google Cloud Console.");
      if (reason === "API_KEY_SERVICE_BLOCKED") throw new Error("Google Maps server key does not allow Places API (New). Add it to the allowed APIs in Google Cloud Console.");
      throw new Error(`Google restaurant lookup denied [403]: ${body}`);
    }
    throw new Error(`Google restaurant lookup failed [${response.status}]: ${body}`);
  }
  const json = await response.json() as { places?: BusinessPlace[] };
  const location = restaurantBusinessLocation(json.places ?? [], name, city, center);
  if (location) return location;
  }
  return null;
}