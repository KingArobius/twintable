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
  addressComponents?: { longText?: string; types?: string[] }[];
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

const restaurantDescriptors = new Set(["the", "and", "restaurant", "restaurants", "cafe", "bar", "grill", "kitchen", "bakery"]);
function businessWords(value: string) {
  return normalized(value).split(" ").filter((word) => word && !restaurantDescriptors.has(word));
}

// Places coordinates identify the business itself, not an AI-supplied address.
export function restaurantBusinessLocation(places: BusinessPlace[], name: string, city: string) {
  const requested = businessWords(name);
  for (const place of places) {
    const location = place.location;
    const title = businessWords(place.displayName?.text ?? "");
    const business = place.types?.some((type) => ["restaurant", "food", "cafe", "bar", "bakery", "meal_takeaway"].includes(type));
    const cities = place.addressComponents?.filter((part) => part.types?.some((type) => ["locality", "postal_town", "sublocality", "sublocality_level_1"].includes(type))) ?? [];
    const sameCity = cities.some((part) => normalized(part.longText ?? "") === normalized(city));
    const sameName = requested.length > 0 && requested.every((word) => title.includes(word));
    if (!business || !sameCity || !sameName || !place.id || !place.formattedAddress || !location
      || place.businessStatus === "CLOSED_PERMANENTLY"
      || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)
      || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) continue;
    return { lat: location.latitude, lng: location.longitude, address: place.formattedAddress, placeId: place.id };
  }
  return null;
}