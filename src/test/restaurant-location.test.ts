import { describe, expect, it } from "vitest";
import { exactRestaurantLocation, restaurantMapsUrl, type GeocodedPlace } from "@/lib/restaurant-location";

const venue: GeocodedPlace = {
  formatted_address: "123 Main St, Austin, TX",
  place_id: "verified-restaurant",
  types: ["restaurant", "establishment"],
  geometry: { location: { lat: 30.2672, lng: -97.7431 }, location_type: "ROOFTOP" },
};

describe("Exact restaurant locations", () => {
  it("rejects a city-only result rather than pinning the city", () => {
    expect(exactRestaurantLocation([{ ...venue, types: ["locality", "political"], geometry: { ...venue.geometry, location_type: "APPROXIMATE" } }])).toBeNull();
  });
  it("keeps a verified restaurant's exact coordinates and address", () => {
    expect(exactRestaurantLocation([venue])).toEqual({ lat: 30.2672, lng: -97.7431, address: "123 Main St, Austin, TX", placeId: "verified-restaurant" });
  });
  it("rejects partial matches instead of pretending they are exact", () => {
    expect(exactRestaurantLocation([{ ...venue, partial_match: true }])).toBeNull();
  });
  it("rejects street midpoints", () => {
    expect(exactRestaurantLocation([{ ...venue, geometry: { ...venue.geometry, location_type: "RANGE_INTERPOLATED" } }])).toBeNull();
  });
  it("accepts a street-level match when it has a real street number", () => {
    const streetMatch: GeocodedPlace = {
      formatted_address: "456 Oak Ave, Austin, TX",
      types: ["route"],
      address_components: [
        { types: ["street_number"], long_name: "456" },
        { types: ["route"], long_name: "Oak Avenue" },
      ],
      geometry: { location: { lat: 30.27, lng: -97.75 }, location_type: "RANGE_INTERPOLATED" },
    };
    expect(exactRestaurantLocation([streetMatch])).toEqual({ lat: 30.27, lng: -97.75, address: "456 Oak Ave, Austin, TX", placeId: undefined });
  });
  it("links the restaurant by its verified place ID and full address", () => {
    const url = new URL(restaurantMapsUrl("Twin Cafe", "123 Main St, Austin, TX", "verified-restaurant"));
    expect(url.searchParams.get("query_place_id")).toBe("verified-restaurant");
    expect(url.searchParams.get("query")).toBe("Twin Cafe, 123 Main St, Austin, TX");
  });
});