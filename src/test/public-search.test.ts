import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => { throw new Error("Search must not require a signed-in session"); },
      inputValidator: () => builder,
      handler: (handler: (args: { data: unknown }) => unknown) => handler,
    };
    return builder;
  },
}));

vi.mock("@lovable.dev/ai-gateway", () => ({
  generateMessage: vi.fn().mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify({ reference: "Test", results: [] }) }],
  }),
  GatewayError: class extends Error {},
}));
vi.mock("@/lib/google-locations.server", () => ({ findRestaurantBusiness: vi.fn() }));

describe("Public restaurant search", () => {
  it("allows autocomplete without any authenticated context", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      suggestions: [{ placePrediction: { placeId: "austin", structuredFormat: { mainText: { text: "Austin" } } } }],
    }))));
    try {
      const { autocompleteRestaurants } = await import("@/lib/places.functions");
      const result = await autocompleteRestaurants({ data: { input: "Austin", sessionToken: "ebd434e3-f0c2-4c0e-b069-21f529182932" } });
      expect(result.suggestions[0]?.name).toBe("Austin");
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it("allows recommendations without any authenticated context", async () => {
    const { recommendRestaurants } = await import("@/lib/recommend.functions");
    const result = await recommendRestaurants({ data: { restaurant: "Franklin Barbecue", city: "Austin, Texas", cityName: "Austin" } });
    expect(result.ok).toBe(true);
  });
});