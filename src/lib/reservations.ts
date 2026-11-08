// Set after joining a reservation partner program; parameter format may depend on that agreement.
export const RESERVATION_AFFILIATE_ID = "";

export function reservationUrl(restaurant: string, city: string, affiliateId = RESERVATION_AFFILIATE_ID) {
  const url = new URL("https://www.opentable.com/s");
  url.searchParams.set("term", `${restaurant} ${city}`);
  if (affiliateId.trim()) url.searchParams.set("ref", affiliateId.trim());
  return url.href;
}

export function directionsUrl(name: string, address: string, placeId?: string) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${name}, ${address}`);
  if (placeId) url.searchParams.set("destination_place_id", placeId);
  return url.href;
}

export function safeWebsite(value?: string) {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}