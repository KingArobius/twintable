import { describe, expect, it } from "vitest";
import { googleReview, selectGooglePlace, sortByReviews } from "./review-ratings";

describe("Google-only ratings", () => {
  it("preserves the exact Google rating rather than inventing or rounding it", () => {
    expect(googleReview({ id: "a", rating: 4.3, userRatingCount: 2231, googleMapsUri: "https://maps.google.com/?cid=1" })).toEqual({ rating: 4.3, count: 2231, url: "https://maps.google.com/?cid=1" });
  });
  it("leaves missing ratings unavailable", () => {
    expect(googleReview({ id: "a", userRatingCount: 0 })).toBeNull();
    expect(googleReview(null)).toBeNull();
  });
  it("ranks by Google rating, not Claude's ordering", () => {
    const rows = [{ rank: 1, price: 2, google: { rating: 3.5, count: 100, url: "" } }, { rank: 2, price: 3, google: { rating: 4.8, count: 10, url: "" } }];
    expect(sortByReviews(rows, "google", "desc").map(r => r.google.rating)).toEqual([4.8, 3.5]);
  });
  it("keeps unavailable ratings last in both directions", () => {
    const rows = [{ rank: 1, price: 2, google: null }, { rank: 2, price: 3, google: { rating: 4.3, count: 10, url: "" } }];
    expect(sortByReviews(rows, "google", "asc")[1]?.google).toBeNull();
    expect(sortByReviews(rows, "google", "desc")[1]?.google).toBeNull();
  });
  it("rejects a different restaurant and ambiguous branches", () => {
    expect(selectGooglePlace("Shake Shack", [{ id: "a", displayName: { text: "Shack Burgers" } }])).toBeNull();
    expect(selectGooglePlace("Shake Shack", [{ id: "a", displayName: { text: "Shake Shack" } }, { id: "b", displayName: { text: "Shake Shack" } }])).toBeNull();
  });
  it("matches punctuation differences and excludes closed businesses", () => {
    expect(selectGooglePlace("P. Terry’s", [{ id: "a", displayName: { text: "P Terrys" } }])?.id).toBe("a");
    expect(selectGooglePlace("P Terrys", [{ id: "a", displayName: { text: "P Terrys" }, businessStatus: "CLOSED_PERMANENTLY" }])).toBeNull();
  });
});