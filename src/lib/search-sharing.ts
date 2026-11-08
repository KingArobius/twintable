export type SearchState = { restaurant?: string; city?: string; restaurantAddress?: string; cityAddress?: string };

export function readSearchState(input: Record<string, unknown>): SearchState {
  return Object.fromEntries(["restaurant", "city", "restaurantAddress", "cityAddress"].flatMap((key) =>
    typeof input[key] === "string" ? [[key, input[key]]] : []));
}

export function searchUrl(search: SearchState, origin = "https://twintable.app") {
  const url = new URL("/", origin);
  for (const key of ["restaurant", "city", "restaurantAddress", "cityAddress"] as const) {
    if (search[key]) url.searchParams.set(key, search[key]);
  }
  return url.href;
}

export function searchTitle(search: SearchState) {
  return search.restaurant && search.city ? `Restaurants like ${search.restaurant} in ${search.city} | Twin Table` : "Twin Table — Familiar food, unfamiliar places";
}

export function shareText(restaurant: string, city: string) {
  return `I found restaurants like ${restaurant} in ${city} on Twin Table 🍽️`;
}

export function tweetUrl(text: string, url: string) {
  return `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url })}`;
}