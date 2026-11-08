import { Navigation, MapPin, Globe, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Recommendation } from "@/lib/recommend.functions";
import { directionsUrl, reservationUrl, safeWebsite } from "@/lib/reservations";
import { hasRestaurantCoordinates } from "@/lib/restaurant-location";

export function RestaurantActions({ restaurant, city }: { restaurant: Recommendation; city: string }) {
  const website = safeWebsite(restaurant.website);
  const located = hasRestaurantCoordinates(restaurant);
  const actions = [
    located
      ? { label: "Directions", href: directionsUrl(restaurant.name, restaurant.address ?? `${restaurant.lat},${restaurant.lng}`, restaurant.placeId), Icon: Navigation }
      : { label: "Find on Google Maps", href: restaurant.mapsUrl, Icon: MapPin },
    ...(website ? [{ label: "Menu / Website", href: website, Icon: Globe }] : []),
    { label: "Reserve", href: reservationUrl(restaurant.name, city), Icon: CalendarDays },
  ];
  return <TooltipProvider delayDuration={200}>
    <div className="flex justify-end gap-0 py-1 sm:gap-1">
      {actions.map(({ label, href, Icon }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="size-6 shrink-0 text-primary [&_svg]:size-2.5 sm:size-9 sm:[&_svg]:size-4">
              <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} for ${restaurant.name}`}><Icon className="size-2.5 sm:size-4" aria-hidden="true" /></a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  </TooltipProvider>;
}