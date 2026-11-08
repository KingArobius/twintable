declare global {
  interface Window {
    __twinTableMapsReady?: () => void;
  }
}

let pending: Promise<void> | undefined;

// Reuse one script across result changes; onload is not Maps API readiness.
export function loadGoogleMap() {
  if (typeof google !== "undefined" && google.maps?.Map) return Promise.resolve();
  if (pending) return pending;
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
  if (!key) return Promise.reject(new Error("Google Maps isn't configured."));
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 20000);
    function fail() {
      window.clearTimeout(timeout);
      delete window.__twinTableMapsReady;
      script.remove();
      pending = undefined;
      reject(new Error("Google Maps could not load."));
    }
    window.__twinTableMapsReady = () => {
      window.clearTimeout(timeout);
      delete window.__twinTableMapsReady;
      resolve();
    };
    const params = new URLSearchParams({ key, loading: "async", callback: "__twinTableMapsReady", channel: channel ?? "" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}