import { z } from "zod";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const score = z.number().min(1).max(5).multipleOf(0.5);
export const aiMatchesSchema = z.object({
  results: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    price: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    ratings: z.object({ food: score, ambiance: score, service: score, overall: score }),
  })).min(1).max(9),
});
export type AiMatches = z.infer<typeof aiMatchesSchema>;

export async function recommendationCacheKey(input: { restaurant: string; city: string; cityName: string }) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const encoded = new TextEncoder().encode(JSON.stringify(["compact-sonnet-verified-nine-v2", normalize(input.restaurant), normalize(input.city), normalize(input.cityName)]));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}