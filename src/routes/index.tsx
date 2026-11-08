import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import foodSpread from "@/assets/food-spread.jpg";
import ogPreview from "@/assets/og-preview.mp4.asset.json";
import { SearchShare } from "@/components/SearchShare";
import { RestaurantActions } from "@/components/RestaurantActions";
import { readSearchState, searchTitle, searchUrl, type SearchState } from "@/lib/search-sharing";
import { ResultsMap } from "@/components/ResultsMap";
import { Button } from "@/components/ui/button";
import type { PlaceSuggestion } from "@/lib/places.functions";
import { recommendRestaurants, type Recommendation } from "@/lib/recommend.functions";

const ogVideoUrl = `https://twintable.app${ogPreview.url}`;

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  validateSearch: readSearchState,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => ({ search: deps }),
  head: ({ loaderData }) => ({
    meta: [
      { title: searchTitle(loaderData?.search ?? {}) },
      { name: "description", content: loaderData?.search.restaurant && loaderData.search.city ? searchTitle(loaderData.search) : "Familiar food, unfamiliar places" },
      { property: "og:title", content: loaderData?.search.restaurant && loaderData.search.city ? searchTitle(loaderData.search) : "Familiar food, unfamiliar places" },
      { name: "twitter:title", content: loaderData?.search.restaurant && loaderData.search.city ? searchTitle(loaderData.search) : "Familiar food, unfamiliar places" },
      { property: "og:image", content: "https://twintable.app/og-image.png" },
      { name: "twitter:image", content: "https://twintable.app/og-image.png" },
      { property: "og:video", content: ogVideoUrl },
      { property: "og:video:secure_url", content: ogVideoUrl },
      { property: "og:video:type", content: "video/mp4" },
      { property: "og:video:width", content: "1200" },
      { property: "og:video:height", content: "630" },
      { property: "og:description", content: loaderData?.search.restaurant && loaderData.search.city ? searchTitle(loaderData.search) : "Familiar food, unfamiliar places" },
      { name: "twitter:description", content: loaderData?.search.restaurant && loaderData.search.city ? searchTitle(loaderData.search) : "Familiar food, unfamiliar places" },
      { property: "og:url", content: searchUrl(loaderData?.search ?? {}) },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: searchUrl(loaderData?.search ?? {}) }],
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

const LABELS: [keyof Recommendation["ratings"], string][] = [
  ["food", "Food"],
  ["ambiance", "Ambiance"],
  ["service", "Service"],
];

type RankedRecommendation = Recommendation & { rank: number };

type SortKey = "rank" | "overall" | "food" | "ambiance" | "service" | "price";
type SortDir = "asc" | "desc";

export function sortResults(list: RankedRecommendation[], key: SortKey, dir: SortDir): RankedRecommendation[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const diff =
      key === "price" ? a.price - b.price : key === "rank" ? a.rank - b.rank : a.ratings[key] - b.ratings[key];
    return sign * diff || b.ratings.overall - a.ratings.overall;
  });
}

function Index() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
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
  const [data, setData] = useState<{ reference: string; results: RankedRecommendation[]; cityLat?: number | undefined; cityLng?: number | undefined } | null>(null);
  const [completedSearch, setCompletedSearch] = useState<SearchState | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const t = Math.min(1, window.scrollY / 4500);
      document.documentElement.style.setProperty("--bg-mix", `${(t * 100).toFixed(1)}%`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!place) { setError("Please pick a restaurant from the suggestions."); return; }
    if (!city) { setError("Please pick a city from the suggestions."); return; }
    const next = { restaurant: place.name, restaurantAddress: place.address, city: city.name, cityAddress: city.address };
    if (JSON.stringify(search) === JSON.stringify(next)) void runSearch(next);
    else void navigate({ search: next });
  }

  useEffect(() => {
    if (!search.restaurant || !search.city) {
      setData(null);
      setCompletedSearch(null);
      return;
    }
    setPlace({ name: search.restaurant, address: search.restaurantAddress ?? "", placeId: "" });
    setCity({ name: search.city, address: search.cityAddress ?? "", placeId: "" });
    let cancelled = false;
    void runSearch(search, () => cancelled);
    return () => { cancelled = true; };
  }, [search.restaurant, search.city, search.restaurantAddress, search.cityAddress]);

  async function runSearch(input: SearchState, cancelled = () => false) {
    if (!input.restaurant || !input.city) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await recommend({ data: { restaurant: `${input.restaurant}${input.restaurantAddress ? ` (${input.restaurantAddress})` : ""}`, city: `${input.city}${input.cityAddress ? `, ${input.cityAddress}` : ""}`, cityName: input.city } });
      if (cancelled()) return;
      if (r.ok) {
        setCompletedSearch(input);
        setData({ reference: r.reference, results: r.results.map((x, i) => ({ ...x, rank: i + 1 })), cityLat: r.cityLat, cityLng: r.cityLng });
        if (["twintable.app", "www.twintable.app", "twintable.lovable.app"].includes(window.location.hostname) && r.results.length > 0) {
          window.__lovableEvents?.track?.("project.restaurant_search_completed", { cached: r.cached, result_count: r.results.length });
        }
      }
      else setError(r.error);
    } catch {
      if (!cancelled()) setError("Something went wrong. Please try again.");
    } finally {
      if (!cancelled()) setLoading(false);
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
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Twin Table</p>
        </header>

        <form onSubmit={onSubmit} className="glass mx-auto mt-6 block w-fit rounded-[2.5rem] px-4 py-4 text-center sm:mt-10 sm:px-8 sm:py-6 md:flex md:items-center md:gap-5 md:py-4">
          <div className="font-rounded text-base font-semibold leading-normal tracking-tight sm:text-lg md:whitespace-nowrap md:text-xl md:leading-normal lg:text-2xl">
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
          </div>
          <Button disabled={loading} className="mt-4 h-auto inline-flex items-center gap-2 rounded-full bg-gradient-primary px-10 py-3 font-semibold tracking-wide text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary-foreground/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 hover:brightness-110 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 md:mt-0">
            <Sparkles className="h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        {loading && <p className="mt-10 text-center text-muted-foreground animate-pulse">Tasting the town…</p>}
        {error && <p className="mt-10 text-center text-destructive">{error}</p>}

        {data && (
          <section className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:mt-12">
            {(() => { const sorted = sortResults(data.results, sortKey, sortDir); return (
            <>
            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/5 text-center text-[8px] uppercase tracking-normal text-muted-foreground sm:text-xs sm:tracking-wider">
                    <th rowSpan={2} className="border-b border-primary/10 px-0.5 py-2 font-medium sm:px-4 sm:py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("rank")}
                        aria-sort={sortKey === "rank" ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={`uppercase tracking-wider hover:text-foreground ${sortKey === "rank" ? "text-foreground" : ""}`}
                      >
                        #{sortKey === "rank" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                    <th rowSpan={2} className="border-b border-primary/10 px-0.5 py-2 font-medium sm:px-4 sm:py-3">Restaurant</th>
                    <th rowSpan={2} className="border-b border-primary/10 px-0.5 py-2 font-medium sm:px-4 sm:py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("price")}
                        aria-sort={sortKey === "price" ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={`uppercase tracking-wider hover:text-foreground ${sortKey === "price" ? "text-foreground" : ""}`}
                      >
                        Price{sortKey === "price" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                    <th colSpan={4} className="px-0.5 py-1.5 font-medium sm:px-4 sm:py-2">Similarity Scores</th>
                    <th rowSpan={2} className="border-b border-primary/10 px-1 sm:px-3"><span className="sr-only">Restaurant actions</span></th>
                  </tr>
                  <tr className="border-b border-primary/10 bg-primary/5 text-center text-[8px] uppercase tracking-normal text-muted-foreground sm:text-xs sm:tracking-wider">
                    {([["overall", "Overall"], ...LABELS] as [SortKey, string][]).map(([k, label]) => (
                      <th key={k} className="px-0.5 py-2 font-medium sm:px-4 sm:py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort(k)}
                          aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                          className={`uppercase tracking-wider hover:text-foreground ${sortKey === k ? "text-foreground" : ""}`}
                        >
                          <span className="sm:hidden">{{ rank: "#", price: "Price", overall: "Overall", food: "Food", ambiance: "Amb.", service: "Serv." }[k]}</span>
                          <span className="hidden sm:inline">{label}</span>
                          {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.name} className="border-b border-primary/10 text-center align-middle transition-colors last:border-0 hover:bg-primary/5">
                      <td className="px-0.5 py-2 sm:px-4 sm:py-4">
                        <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-gradient-primary font-mono text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/30 sm:h-7 sm:w-7 sm:text-xs">{r.rank}</span>
                      </td>
                      <td className="w-12 px-0.5 py-2 sm:w-auto sm:px-4 sm:py-4">
                        <a href={r.mapsUrl} target="_blank" rel="noopener" className="block text-center font-display text-[10px] leading-tight underline-offset-4 transition-colors hover:text-primary hover:underline sm:text-lg">{r.name}</a>
                      </td>
                      <td className="whitespace-nowrap px-0.5 py-2 font-mono text-[10px] sm:px-4 sm:py-4 sm:text-sm">
                        <span className="text-primary">{"$".repeat(r.price)}</span>
                        <span className="hidden text-border sm:inline">{"$".repeat(4 - r.price)}</span>
                      </td>
                      <td className="whitespace-nowrap px-0.5 py-2 sm:px-4 sm:py-4">
                        <Stars value={r.ratings.overall} />
                      </td>
                      {LABELS.map(([k]) => (
                        <td key={k} className="whitespace-nowrap px-0.5 py-2 sm:px-4 sm:py-4"><Stars value={r.ratings[k]} /></td>
                      ))}
                      <td className="px-1 py-2 sm:px-3 sm:py-4"><RestaurantActions restaurant={r} city={completedSearch?.city ?? search.city ?? ""} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <ResultsMap results={data.results} cityLat={data.cityLat} cityLng={data.cityLng} />
            </div>
            </>
            ); })()}
            {completedSearch && <div className="mt-4"><SearchShare search={completedSearch} /></div>}
          </section>
        )}
      </div>
    </main>
  );
}
