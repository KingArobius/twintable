import { Navigation, Globe, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Recommendation } from "@/lib/recommend.functions";
import { directionsUrl, reservationUrl, safeWebsite } from "@/lib/reservations";

export function RestaurantActions({ restaurant, city }: { restaurant: Recommendation; city: string }) {
  const website = safeWebsite(restaurant.website);
  const actions = [
    { label: "Directions", href: directionsUrl(restaurant.name, restaurant.address ?? city, restaurant.placeId), Icon: Navigation },
    ...(website ? [{ label: "Menu / Website", href: website, Icon: Globe }] : []),
    { label: "Reserve", href: reservationUrl(restaurant.name, city), Icon: CalendarDays },
  ];
  return <TooltipProvider delayDuration={200}>
    <div className="flex justify-end gap-0 py-1 sm:gap-1">
      {actions.map(({ label, href, Icon }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="size-6 shrink-0 text-primary sm:size-9">
              <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} for ${restaurant.name}`}><Icon className="size-3.5 sm:size-4" aria-hidden="true" /></a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  </TooltipProvider>;
}