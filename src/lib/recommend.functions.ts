import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Recommendation = {
  name: string;
  neighborhood: string;
  cuisine: string;
  price: 1 | 2 | 3 | 4;
  summary: string;
  ratings: { food: number; ambiance: number; service: number; menu: number; overall: number };
};

export const recommendRestaurants = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ restaurant: z.string().trim().min(1).max(120), city: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateMessage, GatewayError } = await import("@lovable.dev/ai-gateway");
    const prompt = `Find 6 real restaurants in ${data.city} that are most similar to "${data.restaurant}". Rate each 1-5 (half stars allowed) on how similar it is to "${data.restaurant}" for: food (cuisine & dishes), ambiance (vibe & decor), service (style of service), menu (format/price-structure similarity), and overall similarity. price is 1-4 ($ to $$$$). Reply with ONLY JSON, no prose: {"reference":"one sentence describing ${data.restaurant}","results":[{"name":"","neighborhood":"","cuisine":"","price":2,"summary":"why it's similar, 1-2 sentences","ratings":{"food":4.5,"ambiance":4,"service":4,"menu":3.5,"overall":4}}]}`;
    try {
      const res = await generateMessage({
        model: "anthropic/claude-sonnet-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (res.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as { reference: string; results: Recommendation[] };
      return { ok: true as const, reference: parsed.reference, results: parsed.results };
    } catch (e) {
      console.error(e);
      const msg = e instanceof GatewayError ? "The AI service is busy or unavailable. Please try again." : "Couldn't read the recommendations. Please try again.";
      return { ok: false as const, error: msg };
    }
  });
