import { describe, expect, it, vi } from "vitest";
import { aiMatchesSchema, CACHE_TTL_MS, recommendationCacheKey } from "@/lib/recommendation-cache";

const matches = { results: [{ name: "Test BBQ", price: 2, ratings: { food: 4, ambiance: 4.5, service: 3, overall: 4 } }] };
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/lib/recommendation-cache.server", () => ({
  readCachedMatches: vi.fn(), writeCachedMatches: vi.fn(),
}));
vi.mock("@/lib/google-locations.server", () => ({ findRestaurantBusiness: vi.fn().mockResolvedValue(null) }));
vi.mock("@lovable.dev/ai-gateway", () => ({
  generateMessage: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(matches) }] }),
  GatewayError: class extends Error {},
}));

describe("Recommendation cost controls", () => {
  it("uses a 24-hour reuse window", () => expect(CACHE_TTL_MS).toBe(86400000));
  it("normalizes identical searches but separates cities", async () => {
    const a = { restaurant: "Franklin BBQ", city: "Austin, Texas", cityName: "Austin" };
    expect(await recommendationCacheKey(a)).toBe(await recommendationCacheKey({ restaurant: "  FRANKLIN   BBQ ", city: "austin, texas", cityName: "austin" }));
    expect(await recommendationCacheKey(a)).not.toBe(await recommendationCacheKey({ ...a, city: "Dallas, Texas", cityName: "Dallas" }));
  });
  it("stores only the displayed AI fields, never Google locations", () => {
    const parsed = aiMatchesSchema.parse({ ...matches, reference: "unused", results: [{ ...matches.results[0], lat: 30, address: "123 Main St", summary: "unused" }] });
    expect(parsed).toEqual(matches);
  });
  it("skips Claude on a cache hit but still refreshes Google locations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ geometry: { location: { lat: 30.2, lng: -97.7 } } }] }))));
    const { readCachedMatches } = await import("@/lib/recommendation-cache.server");
    const { generateMessage } = await import("@lovable.dev/ai-gateway");
    const { findRestaurantBusiness } = await import("@/lib/google-locations.server");
    vi.mocked(readCachedMatches).mockResolvedValue(aiMatchesSchema.parse(matches));
    const { recommendRestaurants } = await import("@/lib/recommend.functions");
    const result = await recommendRestaurants({ data: { restaurant: "Franklin BBQ", city: "Austin, Texas", cityName: "Austin" } });
    expect(result.ok).toBe(true);
    expect(generateMessage).not.toHaveBeenCalled();
    expect(findRestaurantBusiness).toHaveBeenCalledWith("Test BBQ", "Austin", { lat: 30.2, lng: -97.7 });
    vi.unstubAllGlobals();
  });
});