import { useEffect, useRef, useState } from "react";
import { loadGoogleMap } from "@/lib/google-map-loader";
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
    let map: google.maps.Map | undefined;
    const markers: google.maps.Marker[] = [];
    setFailed(false);
    loadGoogleMap()
      .then(() => {
        if (cancelled || !ref.current) return;
        map = new google.maps.Map(ref.current, {
          clickableIcons: false, mapTypeControl: false, streetViewControl: false,
          gestureHandling: "cooperative",
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        const bounds = new google.maps.LatLngBounds();
        located.forEach(({ r, rank }) => {
          if (!map || typeof r.lat !== "number" || typeof r.lng !== "number") return;
          const pos = { lat: r.lat, lng: r.lng };
          bounds.extend(pos);
          const marker = new google.maps.Marker({
            map, position: pos,
            title: `${r.name}${r.address ? ` — ${r.address}` : ""}`,
            label: String(rank),
          });
          markers.push(marker);
          marker.addListener("click", () => window.open(r.mapsUrl, "_blank", "noopener,noreferrer"));
        });
        if (located.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(17);
        } else {
          map.fitBounds(bounds, 30);
          google.maps.event.addListenerOnce(map, "idle", () => {
            if (map && (map.getZoom() ?? 0) > 17) map.setZoom(17);
          });
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      markers.forEach((marker) => { google.maps.event.clearInstanceListeners(marker); marker.setMap(null); });
      if (map) google.maps.event.clearInstanceListeners(map);
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
