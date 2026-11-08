import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Recommendation } from "@/lib/recommend.functions";

export function mapRestaurants(results: (Recommendation & { rank?: number })[]) {
  return results.map((r, i) => ({ r, rank: r.rank ?? i + 1 }))
    .filter(({ r }) => typeof r.lat === "number" && Number.isFinite(r.lat) && Math.abs(r.lat) <= 90
      && typeof r.lng === "number" && Number.isFinite(r.lng) && Math.abs(r.lng) <= 180);
}

export function ResultsMap({ results }: { results: (Recommendation & { rank?: number })[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const located = mapRestaurants(results);

  useEffect(() => {
    if (!located.length || !ref.current) return;
    let cancelled = false;
    let map: LeafletMap | undefined;
    setFailed(false);
    import("leaflet")
      .then((L) => {
        if (cancelled || !ref.current) return;
        map = L.map(ref.current, { scrollWheelZoom: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          maxZoom: 19,
        }).addTo(map);
        const bounds = L.latLngBounds([]);
        located.forEach(({ r, rank }) => {
          if (!map || typeof r.lat !== "number" || typeof r.lng !== "number") return;
          const pos = L.latLng(r.lat, r.lng);
          bounds.extend(pos);
          const label = document.createElement("span");
          label.textContent = String(rank);
          const marker = L.marker(pos, {
            title: `${r.name}${r.address ? ` — ${r.address}` : ""}`,
            alt: `Restaurant ${rank}: ${r.name}`,
            icon: L.divIcon({ html: label, className: "restaurant-map-marker", iconSize: [28, 28], iconAnchor: [14, 14] }),
          }).addTo(map);
          marker.on("click", () => window.open(r.mapsUrl, "_blank", "noopener,noreferrer"));
        });
        if (located.length === 1) {
          map.setView(bounds.getCenter(), 17);
        } else {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  if (!located.length) return null;

  return (
    <div className="glass mb-6 overflow-hidden rounded-3xl">
      <div ref={ref} className="restaurant-map h-44 w-full sm:h-80" aria-label="Map of recommended restaurants" />
      {failed && <p role="alert" className="px-4 py-2 text-xs text-destructive">Couldn't load the map. Restaurant links are still available above.</p>}
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {located.length < results.length ? `${results.length - located.length} restaurant location(s) could not be verified and are not pinned.` : null}
      </p>
    </div>
  );
}
