export type GeocodedPlace = {
  place_id?: string;
  formatted_address?: string;
  partial_match?: boolean;
  types?: string[];
  address_components?: { types: string[]; long_name: string }[];
  geometry?: { location?: { lat: number; lng: number }; location_type?: string };
};

// Never turn a city centroid, approximate match, or street midpoint into a venue pin.
export function exactRestaurantLocation(results: GeocodedPlace[]) {
  for (const result of results) {
    const location = result.geometry?.location;
    const types = result.types ?? [];
    const business = types.some((type) => ["restaurant", "food", "establishment", "point_of_interest"].includes(type));
    const streetAddress = result.address_components?.some((component) => component.types.includes("street_number"))
      && result.address_components?.some((component) => component.types.includes("route"));
    const precise = result.geometry?.location_type === "ROOFTOP"
      || (business && result.geometry?.location_type === "GEOMETRIC_CENTER")
      || (streetAddress && result.geometry?.location_type === "RANGE_INTERPOLATED");
    if (result.partial_match || !precise || (!business && !streetAddress) || !result.formatted_address || !location
      || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)
      || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) continue;
    return { ...location, address: result.formatted_address, placeId: business ? result.place_id : undefined };
  }
  return null;
}

export function restaurantMapsUrl(name: string, address: string, placeId?: string) {
  const params = new URLSearchParams({ api: "1", query: `${name}, ${address}` });
  if (placeId) params.set("query_place_id", placeId);
  return `https://www.google.com/maps/search/?${params}`;
}

export type BusinessPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  businessStatus?: string;
  websiteUri?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

const restaurantDescriptors = new Set(["the", "and", "le", "la", "les", "el", "il", "los", "las", "restaurant", "restaurants", "cafe", "bar", "grill", "kitchen", "bakery"]);
function businessWords(value: string) {
  return normalized(value).split(" ").filter((word) => word && !restaurantDescriptors.has(word));
}

// Recommendations may annotate a venue with a branch/neighborhood; verify its area separately.
function businessIdentity(value: string, city: string) {
  const base = value.replace(/\([^)]*\)/g, " ").trim();
  const parts = base.split(/\s+[-–—]\s+/);
  const suffix = parts[parts.length - 1];
  return parts.length > 1 && suffix && normalized(suffix) === normalized(city)
    ? parts.slice(0, -1).join(" ") : base;
}

export function hasRestaurantCoordinates(place: { lat?: number; lng?: number }): place is { lat: number; lng: number } {
  return typeof place.lat === "number" && typeof place.lng === "number"
    && Number.isFinite(place.lat) && Number.isFinite(place.lng)
    && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180;
}

// Google often files venues under a neighborhood or neighboring town (Brooklyn, Santa Monica, Chuo City),
// so accept either a matching locality component or a location near the searched city's center.
export const METRO_RADIUS_KM = 40;
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function sameBusinessName(requested: string[], title: string[]) {
  if (requested.length === 0) return false;
  const missing = requested.filter((word) => !title.includes(word)).length;
  // Long names may differ by one word (e.g. "Comptoir du Panthéon" vs "Le Comptoir du Panthéon Paris").
  return missing === 0 || (requested.length >= 3 && missing === 1);
}

// Places coordinates identify the business itself, not an AI-supplied address.
export function restaurantBusinessLocation(places: BusinessPlace[], name: string, city: string, center?: { lat: number; lng: number } | null) {
  const requested = businessWords(businessIdentity(name, city));
  for (const place of places) {
    const location = place.location;
    const title = businessWords(businessIdentity(place.displayName?.text ?? "", city));
    const business = place.types?.some((type) => type.endsWith("_restaurant") || ["restaurant", "food", "cafe", "bar", "bakery", "meal_takeaway", "deli", "steak_house"].includes(type));
    if (!business || !sameBusinessName(requested, title) || !place.id || !place.formattedAddress || !location
      || place.businessStatus === "CLOSED_PERMANENTLY"
      || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)
      || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) continue;
    const cities = place.addressComponents?.filter((part) => part.types?.some((type) => ["locality", "postal_town"].includes(type) || type.startsWith("sublocality"))) ?? [];
    const sameCity = cities.some((part) => normalized(part.longText ?? "") === normalized(city));
    const nearCity = !!center && distanceKm(center, { lat: location.latitude, lng: location.longitude }) <= METRO_RADIUS_KM;
    if (!sameCity && !nearCity) continue;
    return { lat: location.latitude, lng: location.longitude, address: place.formattedAddress, placeId: place.id, website: place.websiteUri };
  }
  return null;
}
