import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import foodSpread from "@/assets/food-spread.jpg";
import { ResultsMap } from "@/components/ResultsMap";
import type { PlaceSuggestion } from "@/lib/places.functions";
import { recommendRestaurants, type Recommendation } from "@/lib/recommend.functions";
import { Button } from "@/components/ui/button";
import { sortByReviews, type ReviewSortKey, type SortDir } from "@/lib/review-ratings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Twin Table — Find restaurants like your favorite" },
      { name: "description", content: "Discover restaurants similar to your favorite, ranked by AI similarity and real Google review ratings." },
      { property: "og:title", content: "Twin Table — Find restaurants like your favorite" },
      { property: "og:description", content: "Find your restaurant's twin with blended AI similarity and Google ratings, review counts and Maps links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  return (
    <span className="relative inline-block text-[9px] leading-none tracking-normal sm:text-lg sm:tracking-widest" aria-label={`${value} of 5`}>
      <span className="text-border">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-primary" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

function Index() {
  const [sortKey, setSortKey] = useState<ReviewSortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: ReviewSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "price" || key === "rank" ? "asc" : "desc");
    }
  }
  const recommend = useServerFn(recommendRestaurants);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [city, setCity] = useState<PlaceSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ reference: string; results: Recommendation[]; warning?: string } | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const t = Math.min(1, window.scrollY / Math.min(max, 900));
      document.documentElement.style.setProperty("--bg-mix", `${(t * 100).toFixed(1)}%`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!place) { setError("Please pick a restaurant from the suggestions."); return; }
    if (!city) { setError("Please pick a city from the suggestions."); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await recommend({ data: { restaurant: `${place.name} (${place.address})`, city: `${city.name}, ${city.address}` } });
      if (r.ok) setData({ reference: r.reference, results: r.results, warning: r.warning });
      else setError(r.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-16 text-foreground">
      <div className="mx-auto max-w-4xl">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <img
            src={foodSpread}
            alt=""
            width={1536}
            height={640}
            className="h-full w-full scale-105 object-cover opacity-40 blur-md"
          />
        </div>
        <form onSubmit={onSubmit} className="glass mx-auto mt-6 block w-fit rounded-[2.5rem] px-4 py-4 text-center sm:mt-10 sm:px-8 sm:py-6 md:flex md:items-center md:gap-5 md:py-4">
          <p className="font-rounded text-base font-semibold leading-normal tracking-tight sm:text-lg md:whitespace-nowrap md:text-xl md:leading-normal lg:text-2xl">
            <span className="block md:inline">
              I'm looking for a restaurant in{" "}
              <span className="inline-block border-b-2 border-primary/40 text-left align-baseline">
                <RestaurantPicker value={city} onChange={setCity} types={["locality"]} placeholder="city" ariaLabel="City" emptyMessage="No matching cities found." />
              </span>
            </span>{" "}
            <span className="block md:inline">
              similar to{" "}
              <span className="inline-block border-b-2 border-primary/40 text-left align-baseline">
                <RestaurantPicker value={place} onChange={setPlace} placeholder="restaurant" />
              </span>
              .
            </span>
          </p>
          <Button type="submit" disabled={loading} className="mt-4 h-auto inline-flex items-center gap-2 rounded-full bg-gradient-primary px-10 py-3 font-semibold tracking-wide text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary-foreground/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 hover:brightness-110 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 md:mt-0">
            <Sparkles className="h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        <header className="mt-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Twin Table</p>
        </header>

        {loading && <p className="mt-10 text-center text-muted-foreground animate-pulse">Tasting the town…</p>}
        {error && <p className="mt-10 text-center text-destructive">{error}</p>}

        {data && (
          <section className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:mt-12">
            {(() => { const sorted = sortByReviews(data.results, sortKey, sortDir); return (
            <>
            {data.warning && <p role="status" className="mb-3 break-words text-center text-xs text-muted-foreground">{data.warning}</p>}
            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/5 text-center text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                    <th className="border-b border-primary/10 px-0.5 py-2 font-medium sm:px-4 sm:py-3">
                      <Button variant="ghost" size="sm"
                        type="button"
                        onClick={() => toggleSort("rank")}
                        aria-sort={sortKey === "rank" ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={`h-auto px-0.5 text-[9px] uppercase tracking-normal hover:text-foreground sm:px-3 sm:text-xs ${sortKey === "rank" ? "text-foreground" : ""}`}
                      >
                        #{sortKey === "rank" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </Button>
                    </th>
                    <th className="border-b border-primary/10 px-0.5 py-2 font-medium sm:px-4 sm:py-3">Restaurant</th>
                    <th className="border-b border-primary/10 px-0.5 py-2 font-medium sm:px-4 sm:py-3">
                      <Button variant="ghost" size="sm"
                        type="button"
                        onClick={() => toggleSort("price")}
                        aria-sort={sortKey === "price" ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={`h-auto px-0.5 text-[9px] uppercase tracking-normal hover:text-foreground sm:px-3 sm:text-xs ${sortKey === "price" ? "text-foreground" : ""}`}
                      >
                        Price{sortKey === "price" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </Button>
                    </th>
                    {([["overall", "Overall"], ["similarity", "AI Similarity"], ["google", "Google Rating"], ["reviews", "Reviews"]] as [ReviewSortKey, string][]).map(([k, label]) => (
                      <th key={k} className="px-0.5 py-2 font-medium sm:px-2 sm:py-3" title={k === "overall" ? "50% AI similarity + 50% Google rating; AI only when Google is unavailable" : label}>
                        <Button variant="ghost" size="sm"
                          type="button"
                          onClick={() => toggleSort(k)}
                          aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                          className={`h-auto px-0.5 text-[9px] uppercase tracking-normal hover:text-foreground sm:px-1 sm:text-xs ${sortKey === k ? "text-foreground" : ""}`}
                        >
                          <span className="sm:hidden">{{ overall: "Overall", similarity: "AI", google: "Google", reviews: "Reviews", rank: "#", price: "Price" }[k]}</span>
                          <span className="hidden sm:inline">{label}</span>
                          {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.name} className="border-b border-primary/8 text-center align-middle transition-colors last:border-0 hover:bg-primary/5">
                      <td className="px-0.5 py-2 sm:px-4 sm:py-4">
                        <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-gradient-primary font-mono text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/30 sm:h-7 sm:w-7 sm:text-xs">{r.rank}</span>
                      </td>
                      <td className="w-16 px-0.5 py-2 sm:w-auto sm:px-4 sm:py-4">
                        <a href={r.mapsUrl} target="_blank" rel="noopener" className="block text-center font-display text-[10px] leading-tight underline-offset-4 transition-colors hover:text-primary hover:underline sm:text-lg">{r.name}</a>
                      </td>
                      <td className="whitespace-nowrap px-0.5 py-2 font-mono text-[10px] sm:px-4 sm:py-4 sm:text-sm">
                        <span className="text-primary">{"$".repeat(r.price)}</span>
                        <span className="hidden text-border sm:inline">{"$".repeat(4 - r.price)}</span>
                      </td>
                      <td className="whitespace-nowrap px-0.5 py-2 sm:px-2 sm:py-4">
                        <span className="inline-flex flex-col items-center gap-1" title={r.google ? "50% AI similarity + 50% Google rating" : "AI only: Google rating unavailable"}>
                          <Stars value={r.overall} />
                          {!r.google && <span className="text-[8px] text-muted-foreground sm:text-[10px]">AI only</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-0.5 py-2 sm:px-2 sm:py-4" title="AI-estimated similarity to your restaurant"><Stars value={r.similarity} /></td>
                      <td className="whitespace-nowrap px-0.5 py-2 sm:px-4 sm:py-4">
                        {r.google ? <a href={r.google.url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-col items-center gap-1 hover:text-primary" aria-label={`${r.name}: Google rating ${r.google.rating} of 5`}>
                          <Stars value={r.google.rating} />
                          <span className="font-mono text-[10px] sm:text-xs">{r.google.rating.toFixed(1)}</span>
                        </a> : <span className="text-xs text-muted-foreground" title="Google rating unavailable">—</span>}
                      </td>
                      <td className="px-0.5 py-2 font-mono text-[10px] sm:px-4 sm:py-4 sm:text-sm">{r.google ? r.google.count.toLocaleString("en-US") : "—"}</td>
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
