import { aiMatchesSchema, CACHE_TTL_MS, type AiMatches } from "./recommendation-cache";

// Only independently generated AI matches are stored. Google responses stay fresh.
export async function readCachedMatches(key: string): Promise<AiMatches | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("ai_recommendation_cache")
      .select("payload").eq("cache_key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) { console.error("Recommendation cache read failed", error.code); return null; }
    const parsed = aiMatchesSchema.safeParse(data?.payload);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export async function writeCachedMatches(key: string, matches: AiMatches): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_recommendation_cache").upsert({
      cache_key: key,
      payload: aiMatchesSchema.parse(matches),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });
    if (error) console.error("Recommendation cache write failed", error.code);
  } catch { /* Cache failures must not block a restaurant search. */ }
}