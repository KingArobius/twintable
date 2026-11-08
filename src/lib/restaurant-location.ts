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
      || (business && result.geometry?.location_type === "GEOMETRIC_CENTER");
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