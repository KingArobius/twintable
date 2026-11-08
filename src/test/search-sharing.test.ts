import { describe, expect, it } from "vitest";
import { readSearchState, searchUrl, shareText, searchTitle, tweetUrl } from "@/lib/search-sharing";
import { directionsUrl, reservationUrl, RESERVATION_AFFILIATE_ID, safeWebsite } from "@/lib/reservations";

describe("Shareable restaurant searches", () => {
  it("round-trips a restaurant and city with their destination context", () => {
    const input = { restaurant: "Joe's Pizza", city: "Chicago", restaurantAddress: "New York, NY", cityAddress: "IL, USA" };
    expect(readSearchState(Object.fromEntries(new URL(searchUrl(input)).searchParams))).toEqual(input);
  });
  it("uses the requested sharing text", () => {
    expect(shareText("Nobu", "Miami")).toBe("I found restaurants like Nobu in Miami on Twin Table 🍽️");
  });
  it("uses a distinct restaurant and city result title", () => {
    expect(searchTitle({ restaurant: "Nobu", city: "Miami" })).toBe("Restaurants like Nobu in Miami | Twin Table");
  });
  it("includes the sharing text and URL in the tweet", () => {
    const url = new URL(tweetUrl(shareText("Nobu", "Miami"), searchUrl({ restaurant: "Nobu", city: "Miami" })));
    expect(url.searchParams.get("text")).toBe("I found restaurants like Nobu in Miami on Twin Table 🍽️");
    expect(url.searchParams.get("url")).toBe("https://twintable.app/?restaurant=Nobu&city=Miami");
  });
});

describe("Restaurant actions", () => {
  it("leaves affiliate tracking absent by default", () => {
    expect(RESERVATION_AFFILIATE_ID).toBe("");
    const url = new URL(reservationUrl("Nobu", "Miami"));
    expect(url.searchParams.get("term")).toBe("Nobu Miami");
    expect(url.searchParams.has("ref")).toBe(false);
  });
  it("appends affiliate tracking only when configured", () => {
    expect(new URL(reservationUrl("Nobu", "Miami", "partner123")).searchParams.get("ref")).toBe("partner123");
  });
  it("directions identify Google's validated business", () => {
    const url = new URL(directionsUrl("Nobu", "123 Main St, Miami", "place123"));
    expect(url.searchParams.get("destination")).toBe("Nobu, 123 Main St, Miami");
    expect(url.searchParams.get("destination_place_id")).toBe("place123");
  });
  it("rejects non-web website links", () => {
    expect(safeWebsite("javascript:alert(1)")).toBeUndefined();
    expect(safeWebsite("https://example.com/menu")).toBe("https://example.com/menu");
  });
});