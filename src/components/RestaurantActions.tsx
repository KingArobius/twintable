import { Navigation, Globe, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/recommend.functions";
import { directionsUrl, reservationUrl, safeWebsite } from "@/lib/reservations";

export function RestaurantActions({ restaurant, city }: { restaurant: Recommendation; city: string }) {
  const website = safeWebsite(restaurant.website);
  return <div className="flex flex-wrap justify-center gap-2 py-1">
    <Button asChild variant="outline" size="sm" className="h-9"><a href={directionsUrl(restaurant.name, restaurant.address ?? city, restaurant.placeId)} target="_blank" rel="noopener noreferrer"><Navigation />Directions</a></Button>
    {website && <Button asChild variant="outline" size="sm" className="h-9"><a href={website} target="_blank" rel="noopener noreferrer"><Globe />Menu / Website</a></Button>}
    <Button asChild variant="outline" size="sm" className="h-9"><a href={reservationUrl(restaurant.name, city)} target="_blank" rel="noopener noreferrer"><CalendarDays />Reserve</a></Button>
  </div>;
}