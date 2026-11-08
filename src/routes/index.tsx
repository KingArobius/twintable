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
    <span className="relative inline-block text-[10px] leading-none tracking-normal sm:text-lg sm:tracking-widest" aria-label={`${value} of 5`}>
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
        </header>

        <form onSubmit={onSubmit} className="mt-10 text-center">
          <p className="font-cursive text-lg leading-normal md:whitespace-nowrap md:text-2xl md:leading-normal">
            <span className="block md:inline">
              I'm looking for a restaurant in{" "}
              <span className="inline-block w-24 border-b-2 border-primary/40 text-left align-baseline md:w-32">
                <RestaurantPicker value={city} onChange={setCity} types={["locality"]} placeholder="City" ariaLabel="City" emptyMessage="No matching cities found." />
              </span>
            </span>{" "}
            <span className="block md:inline">
              similar to{" "}
              <span className="inline-block w-28 border-b-2 border-primary/40 text-left align-baseline md:w-36">
                <RestaurantPicker value={place} onChange={setPlace} placeholder="Restaurant" />
              </span>
              .
            </span>
          </p>
          <button disabled={loading} className="mt-6 rounded-full bg-gradient-primary px-10 py-3 font-semibold tracking-wide text-primary-foreground shadow-lg shadow-primary/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 hover:brightness-110 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0">
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {loading && <p className="mt-10 text-center text-muted-foreground animate-pulse">Tasting the town…</p>}
        {error && <p className="mt-10 text-center text-destructive">{error}</p>}

        {data && (
          <section className="mt-12">
            <p className="mb-6 text-center italic text-muted-foreground">{data.reference}</p>
            <p className="mb-4 text-right text-sm text-muted-foreground">Click a column heading to sort</p>
            {(() => { const sorted = sortResults(data.results, sortKey, sortDir); return (
            <>
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                    <th className="px-1.5 py-2 font-medium sm:px-4 sm:py-3">#</th>
                    <th className="px-1.5 py-2 font-medium sm:px-4 sm:py-3">Restaurant</th>
                    {([["price", "Price"], ["overall", "Overall"], ...LABELS] as [SortKey, string][]).map(([k, label]) => (
                      <th key={k} className="px-1.5 py-2 font-medium sm:px-4 sm:py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort(k)}
                          aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                          className={`uppercase tracking-wider hover:text-foreground ${sortKey === k ? "text-foreground" : ""}`}
                        >
                          {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={r.name} className="border-b last:border-0 align-top hover:bg-muted/50">
                      <td className="px-1.5 py-2 sm:px-4 sm:py-4">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground sm:h-7 sm:w-7 sm:text-xs">{data.results.indexOf(r) + 1}</span>
                      </td>
                      <td className="max-w-20 px-1 py-2 sm:max-w-none sm:px-4 sm:py-4">
                        <a href={r.mapsUrl} target="_blank" rel="noopener" className="block truncate font-display text-xs hover:underline sm:text-lg">{r.name}</a>
                      </td>
                      <td className="whitespace-nowrap px-1 py-2 font-mono text-[10px] sm:px-4 sm:py-4 sm:text-sm">
                        <span className="text-primary">{"$".repeat(r.price)}</span>
                        <span className="text-border">{"$".repeat(4 - r.price)}</span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-4 sm:py-4">
                        <Stars value={r.ratings.overall} />
                      </td>
                      {LABELS.map(([k]) => (
                        <td key={k} className="whitespace-nowrap px-1.5 py-2 sm:px-4 sm:py-4"><Stars value={r.ratings[k]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResultsMap results={sorted} />
            </>
            ); })()}
          </section>
        )}
      </div>
    </main>
  );
}
