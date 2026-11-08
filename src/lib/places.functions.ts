import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlaceSuggestion = { placeId: string; name: string; address: string };

export const autocompleteRestaurants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ input: z.string().trim().min(2).max(100), sessionToken: z.string().uuid(), types: z.array(z.string()).optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ suggestions: PlaceSuggestion[]; error?: string }> => {
    const lk = process.env["LOVABLE_API_KEY"];
    const gk = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lk || !gk) return { suggestions: [], error: "Place lookup isn't configured." };
    const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:autocomplete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lk}`,
        "X-Connection-Api-Key": gk,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        includedPrimaryTypes: data.types ?? ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
      }),
    });
    if (!res.ok) {
      console.error(`Places autocomplete failed [${res.status}]: ${await res.text()}`);
      return { suggestions: [], error: "Couldn't load suggestions." };
    }
    const json = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[];
    };
    return {
      suggestions: (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .slice(0, 6)
        .map((p) => ({
          placeId: p.placeId,
          name: p.structuredFormat?.mainText?.text ?? "",
          address: p.structuredFormat?.secondaryText?.text ?? "",
        })),
    };
  });
