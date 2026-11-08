import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { autocompleteRestaurants, type PlaceSuggestion } from "@/lib/places.functions";

export function RestaurantPicker({
  value,
  onChange,
  types,
  placeholder = "Restaurant (e.g. Nobu)",
  ariaLabel = "Restaurant",
  emptyMessage = "No matching restaurants found.",
  className = "",
}: {
  value: PlaceSuggestion | null;
  onChange: (p: PlaceSuggestion | null) => void;
  types?: string[];
  placeholder?: string;
  ariaLabel?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const fetchSuggestions = useServerFn(autocompleteRestaurants);
  const [text, setText] = useState("");
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (value || text.trim().length < 2) {
      setItems([]);
      setMsg(null);
      return;
    }
    if (!token.current) token.current = crypto.randomUUID();
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetchSuggestions({ data: { input: text, sessionToken: token.current!, types } });
        if (id !== reqId.current) return;
        setItems(r.suggestions);
        setActive(0);
        setMsg(r.error ?? (r.suggestions.length ? null : emptyMessage));
        setOpen(true);
      } catch {
        if (id === reqId.current) setMsg("Couldn't load suggestions.");
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, value, fetchSuggestions]);

  function pick(p: PlaceSuggestion) {
    onChange(p);
    setText(p.name);
    setOpen(false);
    token.current = null;
  }

  return (
    <div className={`relative flex-1 ${className}`}>
      <input
        value={text}
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
          if (e.key === "Enter") { e.preventDefault(); const it = items[active]; if (it) pick(it); }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg bg-transparent px-1 py-0 leading-none outline-none transition-colors focus:bg-primary/10"
      />
      {open && !value && (items.length > 0 || msg) && (
        <ul role="listbox" className="glass-popover absolute left-0 top-full z-20 mt-2 max-h-60 w-max min-w-56 max-w-80 overflow-y-auto rounded-2xl border border-primary/15 p-1.5 font-sans text-sm text-popover-foreground shadow-2xl shadow-primary/15 animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-200 max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:w-auto max-sm:max-w-none">
          {items.map((p, i) => (
            <li
              key={p.placeId}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-xl px-3 py-2 transition-colors ${i === active ? "bg-accent text-accent-foreground" : ""}`}
            >
              <div className="truncate font-medium">{p.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{p.address}</div>
            </li>
          ))}
          {!items.length && msg && <li className="px-3 py-2 text-xs text-muted-foreground">{msg}</li>}
        </ul>
      )}
    </div>
  );
}
