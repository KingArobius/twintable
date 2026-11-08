import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { autocompleteRestaurants, type PlaceSuggestion } from "@/lib/places.functions";

export function RestaurantPicker({
  value,
  onChange,
}: {
  value: PlaceSuggestion | null;
  onChange: (p: PlaceSuggestion | null) => void;
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
        const r = await fetchSuggestions({ data: { input: text, sessionToken: token.current! } });
        if (id !== reqId.current) return;
        setItems(r.suggestions);
        setActive(0);
        setMsg(r.error ?? (r.suggestions.length ? null : "No matching restaurants found."));
        setOpen(true);
      } catch {
        if (id === reqId.current) setMsg("Couldn't load suggestions.");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text, value, fetchSuggestions]);

  function pick(p: PlaceSuggestion) {
    onChange(p);
    setText(p.name);
    setOpen(false);
    token.current = null;
  }

  return (
    <div className="relative flex-1">
      <input
        value={text}
        role="combobox"
        aria-expanded={open}
        aria-label="Restaurant"
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
          if (e.key === "Enter") { e.preventDefault(); pick(items[active]); }
        }}
        placeholder="Restaurant (e.g. Nobu)"
        className="w-full rounded-xl bg-transparent px-4 py-3 outline-none focus:bg-muted"
      />
      {value && <p className="px-4 pb-1 text-xs text-muted-foreground truncate">✓ {value.address}</p>}
      {open && !value && (items.length > 0 || msg) && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          {items.map((p, i) => (
            <li
              key={p.placeId}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-3 ${i === active ? "bg-muted" : ""}`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.address}</div>
            </li>
          ))}
          {!items.length && msg && <li className="px-4 py-3 text-sm text-muted-foreground">{msg}</li>}
        </ul>
      )}
    </div>
  );
}
