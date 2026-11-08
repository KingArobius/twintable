import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import type { PlaceSuggestion } from "@/lib/places.functions";
import { recommendRestaurants, type Recommendation } from "@/lib/recommend.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Twin Table — Find restaurants like your favorite" },
      { name: "description", content: "Search a restaurant and a city to discover similar spots, rated for food, ambiance and more." },
      { property: "og:title", content: "Twin Table — Find restaurants like your favorite" },
      { property: "og:description", content: "Discover restaurants similar to the ones you love, in any city." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  return (
    <span className="relative inline-block text-lg leading-none tracking-widest" aria-label={`${value} of 5`}>
      <span className="text-border">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-primary" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

const LABELS: [keyof Recommendation["ratings"], string][] = [
  ["food", "Food"],
  ["ambiance", "Ambiance"],
  ["service", "Service"],
  ["menu", "Menu & format"],
];

type SortKey = "overall" | "food" | "ambiance" | "service" | "menu" | "priceAsc" | "priceDesc";
const SORTS: [SortKey, string][] = [
  ["overall", "Overall match"],
  ["food", "Food"],
  ["ambiance", "Ambiance"],
  ["service", "Service"],
  ["menu", "Menu & format"],
  ["priceAsc", "Price: low to high"],
  ["priceDesc", "Price: high to low"],
];

export function sortResults(list: Recommendation[], key: SortKey): Recommendation[] {
  return [...list].sort((a, b) => {
    if (key === "priceAsc") return a.price - b.price || b.ratings.overall - a.ratings.overall;
    if (key === "priceDesc") return b.price - a.price || b.ratings.overall - a.ratings.overall;
    return b.ratings[key] - a.ratings[key] || b.ratings.overall - a.ratings.overall;
  });
}

function Index() {
  const [sort, setSort] = useState<SortKey>("overall");
  const recommend = useServerFn(recommendRestaurants);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ reference: string; results: Recommendation[] } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!place) { setError("Please pick a restaurant from the suggestions."); return; }
    if (!city.trim()) { setError("Please enter a city."); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await recommend({ data: { restaurant: `${place.name} (${place.address})`, city } });
      if (r.ok) setData({ reference: r.reference, results: r.results });
      else setError(r.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Twin Table</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl">Love a place? Find its twin.</h1>
          <p className="mt-4 text-muted-foreground">Name a restaurant you adore and a city — we'll find the closest matches there.</p>
        </header>

        <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm md:flex-row md:items-start">
          <RestaurantPicker value={place} onChange={setPlace} />
          <input value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" placeholder="City (e.g. Chicago)" className="flex-1 self-stretch md:self-auto rounded-xl bg-transparent px-4 py-3 outline-none focus:bg-muted md:border-l" />
          <button disabled={loading} className="rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {loading && <p className="mt-10 text-center text-muted-foreground animate-pulse">Tasting the town…</p>}
        {error && <p className="mt-10 text-center text-destructive">{error}</p>}

        {data && (
          <section className="mt-12">
            <p className="mb-6 text-center italic text-muted-foreground">{data.reference}</p>
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-sm">
              <label htmlFor="sort" className="text-muted-foreground">Sort by</label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border bg-card px-3 py-2">
                {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              {sortResults(data.results, sort).map((r) => (
                <article key={r.name} className="rounded-2xl border bg-card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl">{r.name}</h2>
                      <p className="text-sm text-muted-foreground">{r.cuisine} · {r.neighborhood}</p>
                    </div>
                    <span className="font-mono text-lg">
                      <span className="text-primary">{"$".repeat(r.price)}</span>
                      <span className="text-border">{"$".repeat(4 - r.price)}</span>
                    </span>
                  </div>
                  <p className="mt-3 text-sm">{r.summary}</p>
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <span className="font-medium">Overall match</span>
                    <span className="flex items-center gap-2"><Stars value={r.ratings.overall} /><span className="font-mono text-sm">{r.ratings.overall}</span></span>
                  </div>
                  <dl className="mt-2 grid gap-1 md:grid-cols-2 md:gap-x-10">
                    {LABELS.map(([k, label]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd><Stars value={r.ratings[k]} /></dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
