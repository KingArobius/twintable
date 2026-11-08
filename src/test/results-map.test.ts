import { describe, expect, it } from "vitest";
import { mapRestaurants } from "@/components/ResultsMap";
import type { Recommendation } from "@/lib/recommend.functions";

const restaurant: Recommendation & { rank: number } = {
  name: "Twin Cafe", rank: 2, neighborhood: "", cuisine: "", summary: "", price: 2,
  ratings: { food: 4, ambiance: 4, service: 4, menu: 4, overall: 4 },
  lat: 30.2672, lng: -97.7431, mapsUrl: "https://www.google.com/maps/search/?api=1&query=Twin+Cafe",
};

describe("Restaurant map pins", () => {
  it("keeps the same restaurant number after sorting", () => {
    const other = { ...restaurant, name: "Other Cafe", rank: 6 };
    expect(mapRestaurants([other, restaurant]).map(({ r, rank }) => [r.name, rank])).toEqual([["Other Cafe", 6], ["Twin Cafe", 2]]);
  });
  it("preserves verified coordinates exactly", () => {
    expect(mapRestaurants([restaurant]).map(({ r }) => [r.lat, r.lng])).toEqual([[30.2672, -97.7431]]);
  });
  it("does not pin missing or invalid coordinates", () => {
    expect(mapRestaurants([{ ...restaurant, lat: undefined }, { ...restaurant, lat: NaN }, { ...restaurant, lng: 181 }])).toEqual([]);
  });
});