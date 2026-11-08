import { useEffect, useRef, useState } from "react";
import type { Recommendation } from "@/lib/recommend.functions";

declare global {
  interface Window {
    google?: any;
  }
}

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
  if (!key) return Promise.reject(new Error("no key"));
  loaderPromise = new Promise((resolve, reject) => {
    const cb = `__initTwinTableMap${Date.now()}`;
    (window as any)[cb] = () => {
      delete (window as any)[cb];
      resolve();
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=${cb}&channel=${channel}`;
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export function ResultsMap({ results, cityLat, cityLng }: { results: (Recommendation & { rank?: number })[]; cityLat?: number | undefined; cityLng?: number | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const located = results
    .map((r, i) => ({ r, rank: r.rank ?? i + 1 }))
    .filter((x) => typeof x.r.lat === "number" && typeof x.r.lng === "number");
  const hasCityCenter = typeof cityLat === "number" && typeof cityLng === "number";

  useEffect(() => {
    if ((!located.length && !hasCityCenter) || !ref.current) return;
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        const bounds = new window.google.maps.LatLngBounds();
        const map = new window.google.maps.Map(ref.current, {
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        located.forEach(({ r, rank }) => {
          if (typeof r.lat !== "number" || typeof r.lng !== "number") return;
          const pos = { lat: r.lat, lng: r.lng };
          bounds.extend(pos);
          const marker = new window.google.maps.Marker({
            map,
            position: pos,
            title: `${r.name}${r.address ? ` — ${r.address}` : ""}`,
            label: { text: String(rank), color: "#ffffff" },
          });
          marker.addListener("click", () => window.open(r.mapsUrl, "_blank", "noopener"));
        });
        if (located.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(17);
        } else if (located.length > 1) {
          map.fitBounds(bounds, 60);
        } else if (hasCityCenter) {
          map.setCenter({ lat: cityLat!, lng: cityLng! });
          map.setZoom(12);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, cityLat, cityLng]);

  if (failed || (!located.length && !hasCityCenter)) return null;

  return (
    <div className="glass mb-6 overflow-hidden rounded-3xl">
      <div ref={ref} className="h-44 w-full sm:h-80" aria-label="Map of recommended restaurants" />
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {located.length < results.length ? `${results.length - located.length} restaurant location(s) could not be verified and are not pinned.` : null}
      </p>
    </div>
  );
}
