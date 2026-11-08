import { describe, expect, it } from "vitest";
import { restaurantBusinessLocation, type BusinessPlace } from "@/lib/restaurant-location";

const venue: BusinessPlace = {
  id: "kashiba-seattle", displayName: { text: "Sushi Kashiba" }, types: ["japanese_restaurant"], businessStatus: "OPERATIONAL",
  formattedAddress: "86 Pine St, Seattle, WA 98101", location: { latitude: 47.6103, longitude: -122.3425 },
  addressComponents: [{ longText: "Seattle", types: ["locality"] }],
};

describe("Restaurant pin identity", () => {
  it("accepts a business when its recommendation includes a parenthetical branch label", () => {
    expect(restaurantBusinessLocation([venue], "Sushi Kashiba (Pike Place Market)", "Seattle")?.placeId).toBe("kashiba-seattle");
  });
  it("accepts a destination suffix without treating it as part of the business name", () => {
    expect(restaurantBusinessLocation([venue], "Sushi Kashiba - Seattle", "Seattle")?.placeId).toBe("kashiba-seattle");
  });
  it("does not accept another city's branch after removing a branch label", () => {
    expect(restaurantBusinessLocation([venue], "Sushi Kashiba (Pike Place Market)", "Chicago", { lat: 41.8781, lng: -87.6298 })).toBeNull();
  });
  it("still rejects an unrelated restaurant with a branch label", () => {
    expect(restaurantBusinessLocation([venue], "Other Sushi (Seattle)", "Seattle")).toBeNull();
  });
});