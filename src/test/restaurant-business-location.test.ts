import { describe, expect, it } from "vitest";
import { restaurantBusinessLocation, type BusinessPlace } from "@/lib/restaurant-location";

const listing: BusinessPlace = {
  id: "google-business", displayName: { text: "Twin Cafe" }, types: ["cafe", "food"],
  formattedAddress: "123 Main St, Austin, TX", location: { latitude: 30.2672, longitude: -97.7431 },
  addressComponents: [{ longText: "Austin", types: ["locality"] }],
};
describe("Google business locations", () => {
  it("uses the Google listing's address and coordinates without an AI address", () => {
    expect(restaurantBusinessLocation([listing], "Twin Cafe", "Austin")).toEqual({ lat: 30.2672, lng: -97.7431, address: "123 Main St, Austin, TX", placeId: "google-business" });
  });
  it("rejects city centroids", () => {
    expect(restaurantBusinessLocation([{ ...listing, types: ["locality", "political"] }], "Twin Cafe", "Austin")).toBeNull();
  });
  it("rejects an unrelated business", () => {
    expect(restaurantBusinessLocation([{ ...listing, displayName: { text: "Other Cafe" } }], "Twin Cafe", "Austin")).toBeNull();
  });
  it("rejects a branch in a different city", () => {
    expect(restaurantBusinessLocation([listing], "Twin Cafe", "Seattle")).toBeNull();
  });
  it("rejects permanently closed businesses", () => {
    expect(restaurantBusinessLocation([{ ...listing, businessStatus: "CLOSED_PERMANENTLY" }], "Twin Cafe", "Austin")).toBeNull();
  });
  it("rejects invalid coordinates", () => {
    expect(restaurantBusinessLocation([{ ...listing, location: { latitude: 100, longitude: 0 } }], "Twin Cafe", "Austin")).toBeNull();
  });
  it("matches apostrophe variations in Google's business name", () => {
    expect(restaurantBusinessLocation([{ ...listing, displayName: { text: "Joe’s Cafe" } }], "Joes Cafe", "Austin")?.placeId).toBe("google-business");
  });
  it("matches restaurant descriptors without requiring them in Google's title", () => {
    expect(restaurantBusinessLocation([listing], "Twin Cafe Restaurant", "Austin")?.placeId).toBe("google-business");
  });
  it("matches ampersands and written conjunctions", () => {
    expect(restaurantBusinessLocation([{ ...listing, displayName: { text: "Salt & Time" } }], "Salt and Time", "Austin")?.placeId).toBe("google-business");
  });
  it("does not match names made only of generic restaurant descriptors", () => {
    expect(restaurantBusinessLocation([listing], "Cafe Restaurant", "Austin")).toBeNull();
  });
});