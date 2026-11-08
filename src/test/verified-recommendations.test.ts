import { describe, expect, it } from "vitest";
import { aiMatchesSchema } from "@/lib/recommendation-cache";
import { verifyRecommendationCandidates } from "@/lib/verified-recommendations";

const candidate = (name: string) => ({ name, price: 2 as const, ratings: { food: 4, ambiance: 4, service: 4, overall: 4 } });
const candidates = Array.from({ length: 9 }, (_, i) => candidate(`Venue ${i + 1}`));
const location = (id: string) => ({ lat: 47.61, lng: -122.34, address: "86 Pine St, Seattle", placeId: id });

describe("Verified recommendation shortlist", () => {
  it("accepts nine AI candidates but rejects an unbounded shortlist", () => {
    expect(aiMatchesSchema.parse({ results: candidates }).results).toHaveLength(9);
    expect(aiMatchesSchema.safeParse({ results: [...candidates, candidate("Venue 10")] }).success).toBe(false);
  });
  it("replaces two unverified candidates with backups and returns six in AI order", async () => {
    const result = await verifyRecommendationCandidates(candidates, async (name) => ["Venue 1", "Venue 2"].includes(name) ? null : location(name));
    expect(result.map((r) => r.name)).toEqual(["Venue 3", "Venue 4", "Venue 5", "Venue 6", "Venue 7", "Venue 8"]);
    expect(result.every((r) => r.address && r.placeId && Number.isFinite(r.lat))).toBe(true);
  });
  it("stops after six verified results and never exceeds six concurrent lookups", async () => {
    let calls = 0;
    let active = 0;
    let peak = 0;
    const result = await verifyRecommendationCandidates(candidates, async (name) => {
      calls++; active++; peak = Math.max(peak, active);
      await Promise.resolve(); active--;
      return location(name);
    });
    expect(result).toHaveLength(6);
    expect(calls).toBe(6);
    expect(peak).toBeLessThanOrEqual(6);
  });
  it("deduplicates names before lookup and Google business IDs before display", async () => {
    const names: string[] = [];
    const result = await verifyRecommendationCandidates([candidate("Venue 1"), candidate("  VENUE 1  "), candidate("Venue 2"), candidate("Venue 3")], async (name) => {
      names.push(name);
      return location(name === "Venue 2" ? "Venue 1" : name);
    });
    expect(names).toEqual(["Venue 1", "Venue 2", "Venue 3"]);
    expect(result.map((r) => r.name)).toEqual(["Venue 1", "Venue 3"]);
  });
  it("returns only the available verified matches rather than padding the list", async () => {
    const result = await verifyRecommendationCandidates(candidates, async (name) => name === "Venue 9" ? location(name) : null);
    expect(result.map((r) => r.name)).toEqual(["Venue 9"]);
    expect(await verifyRecommendationCandidates(candidates, async () => null)).toEqual([]);
  });
  it("never exposes a result whose coordinates are invalid", async () => {
    expect(await verifyRecommendationCandidates([candidate("Venue 1")], async () => ({ ...location("one"), lat: 100 }))).toEqual([]);
  });
});