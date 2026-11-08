import { describe, expect, it } from "vitest";
import { restaurantLocationQueries, restaurantMapsUrl } from "@/lib/restaurant-location";

describe("Missing restaurant location fallback", () => {
  it("uses the same restaurant and destination query as the Maps search action", () => {
    const name = "Sushi Kashiba (Pike Place Market)";
    const area = "Seattle, WA, USA";
    const queries = restaurantLocationQueries(name, area);
    expect(queries).toEqual([
      "Sushi Kashiba (Pike Place Market) restaurant in Seattle, WA, USA",
      "Sushi Kashiba (Pike Place Market), Seattle, WA, USA",
    ]);
    expect(queries[1]).toBe(new URL(restaurantMapsUrl(name, area)).searchParams.get("query"));
    expect(queries).toHaveLength(2);
  });
});