import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RestaurantActions } from "@/components/RestaurantActions";
import type { Recommendation } from "@/lib/recommend.functions";

afterEach(cleanup);
const restaurant: Recommendation = {
  name: "Sushi Kashiba", price: 4, ratings: { food: 5, ambiance: 4, service: 5, overall: 5 },
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sushi+Kashiba+Seattle",
};

describe("Restaurant location actions", () => {
  it("offers a Maps search rather than claiming directions for an unverified venue", () => {
    render(<RestaurantActions restaurant={restaurant} city="Seattle" />);
    expect(screen.queryByRole("link", { name: "Directions for Sushi Kashiba" })).toBeNull();
    expect(screen.getByRole("link", { name: "Find on Google Maps for Sushi Kashiba" }).getAttribute("href")).toBe(restaurant.mapsUrl);
  });
  it("uses the same verified place identity as the pin for directions", () => {
    render(<RestaurantActions restaurant={{ ...restaurant, lat: 47.6103, lng: -122.3425, address: "86 Pine St, Seattle", placeId: "kashiba-seattle" }} city="Seattle" />);
    const link = screen.getByRole("link", { name: "Directions for Sushi Kashiba" });
    expect(new URL(link.getAttribute("href") ?? "").searchParams.get("destination_place_id")).toBe("kashiba-seattle");
  });
});