import { Share2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { searchUrl, shareText, tweetUrl, type SearchState } from "@/lib/search-sharing";

export function SearchShare({ search }: { search: SearchState }) {
  const text = shareText(search.restaurant ?? "", search.city ?? "");
  const url = searchUrl(search);
  async function share() {
    try {
      if (window.matchMedia("(pointer: coarse)").matches && navigator.share) {
        await navigator.share({ title: "Twin Table", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Couldn't share this link. Please copy it from your address bar.");
    }
  }
  return <div className="flex flex-wrap items-center justify-end gap-2">
    <Button type="button" variant="outline" onClick={share}><Share2 />Share</Button>
    <Button asChild variant="outline"><a href={tweetUrl(text, url)} target="_blank" rel="noopener noreferrer"><Send />Share on X</a></Button>
  </div>;
}