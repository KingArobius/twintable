import { createServerFn } from "@tanstack/react-start";

// Browser keys are public by design (referrer-restricted). The user's own key
// allows twintable.app; the managed connector key only allows *.lovable.app.
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  return process.env["GOOGLE_API_KEY"] || process.env["GOOGLE_MAPS_BROWSER_KEY"] || "";
});
