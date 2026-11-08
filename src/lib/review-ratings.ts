export type GoogleReview = { rating: number; count: number; url: string };
export type ReviewSortable = { price: number; google: GoogleReview | null; rank: number };
export type ReviewSortKey = "rank" | "google" | "reviews" | "price";
export type SortDir = "asc" | "desc";

export function sortByReviews<T extends ReviewSortable>(list: T[], key: ReviewSortKey, dir: SortDir): T[] {
  return [...list].sort((a, b) => {
    if ((key === "google" || key === "reviews") && (!a.google || !b.google)) {
      if (!a.google && b.google) return 1;
      if (a.google && !b.google) return -1;
    }
    const value = (r: T) => key === "rank" ? r.rank : key === "price" ? r.price : key === "reviews" ? r.google?.count ?? 0 : r.google?.rating ?? 0;
    return (dir === "asc" ? 1 : -1) * (value(a) - value(b))
      || (b.google?.rating ?? -1) - (a.google?.rating ?? -1)
      || (b.google?.count ?? 0) - (a.google?.count ?? 0);
  });
}

function normalizedName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
  location?: { latitude: number; longitude: number };
};

// Ambiguous branches and similarly named businesses never inherit each other's ratings.
export function selectGooglePlace(name: string, places: GooglePlace[]): GooglePlace | null {
  const matches = places.filter(p => p.businessStatus !== "CLOSED_PERMANENTLY"
    && normalizedName(p.displayName?.text ?? "") === normalizedName(name));
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function googleReview(place: GooglePlace | null): GoogleReview | null {
  if (!place || typeof place.rating !== "number" || !Number.isFinite(place.rating)
    || place.rating < 1 || place.rating > 5 || !place.userRatingCount || !place.googleMapsUri?.startsWith("https://")) return null;
  return { rating: place.rating, count: place.userRatingCount, url: place.googleMapsUri };
}