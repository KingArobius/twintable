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

export function ResultsMap({ results }: { results: Recommendation[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const located = results
    .map((r, i) => ({ r, rank: i + 1 }))
    .filter((x) => typeof x.r.lat === "number" && typeof x.r.lng === "number");

  useEffect(() => {
    if (!located.length || !ref.current) return;
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
          const pos = { lat: r.lat!, lng: r.lng! };
          bounds.extend(pos);
          const marker = new window.google.maps.Marker({
            map,
            position: pos,
            title: r.name,
            label: { text: String(rank), color: "#ffffff" },
          });
          marker.addListener("click", () => window.open(r.mapsUrl, "_blank", "noopener"));
        });
        if (located.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(13);
        } else {
          map.fitBounds(bounds, 60);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  if (!located.length || failed) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border shadow-sm">
      <div ref={ref} className="h-80 w-full" aria-label="Map of recommended restaurants" />
      <p className="bg-card px-4 py-2 text-xs text-muted-foreground">
        Numbered markers match the list below — click one to open the restaurant in Google Maps.
      </p>
    </div>
  );
}
