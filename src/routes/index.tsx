import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import { ResultsMap } from "@/components/ResultsMap";
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

type SortKey = "overall" | "food" | "ambiance" | "service" | "menu" | "price";
type SortDir = "asc" | "desc";

export function sortResults(list: Recommendation[], key: SortKey, dir: SortDir): Recommendation[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const diff = key === "price" ? a.price - b.price : a.ratings[key] - b.ratings[key];
    return sign * diff || b.ratings.overall - a.ratings.overall;
  });
}

function Index() {
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "asc" : "desc");
    }
  }
  const recommend = useServerFn(recommendRestaurants);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [city, setCity] = useState<PlaceSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ reference: string; results: Recommendation[] } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!place) { setError("Please pick a restaurant from the suggestions."); return; }
    if (!city) { setError("Please pick a city from the suggestions."); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await recommend({ data: { restaurant: `${place.name} (${place.address})`, city: `${city.name}, ${city.address}` } });
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
          <RestaurantPicker value={city} onChange={setCity} types={["locality"]} placeholder="City (e.g. Chicago)" ariaLabel="City" emptyMessage="No matching cities found." className="md:border-l" />
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
            {(() => { const sorted = sortResults(data.results, sort); return (
            <>
            <ResultsMap results={sorted} />
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Restaurant</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Overall</th>
                    {LABELS.map(([k, label]) => (
                      <th key={k} className="px-4 py-3 font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={r.name} className="border-b last:border-0 align-top hover:bg-muted/50">
                      <td className="px-4 py-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{i + 1}</span>
                      </td>
                      <td className="px-4 py-4">
                        <a href={r.mapsUrl} target="_blank" rel="noopener" className="font-display text-lg hover:underline">{r.name}</a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono">
                        <span className="text-primary">{"$".repeat(r.price)}</span>
                        <span className="text-border">{"$".repeat(4 - r.price)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="flex items-center gap-2"><Stars value={r.ratings.overall} /><span className="font-mono text-xs">{r.ratings.overall}</span></span>
                      </td>
                      {LABELS.map(([k]) => (
                        <td key={k} className="whitespace-nowrap px-4 py-4"><Stars value={r.ratings[k]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
            ); })()}
          </section>
        )}
      </div>
    </main>
  );
}
