import { useEffect, useRef, useState } from "react";
import { Search } from "lucide";
import { geocodePlace, type GeocodedPlace, type SearchArea } from "../../data/geocoding";
import { PanelIcon } from "./ContextPanel";
import { getRegion, UNASSIGNED_REGION_ID } from "../../config/regions";

const TYPING_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

export function AddressSearch({ id, label, value, area, onChange, onSelect }: {
  id: string;
  label: string;
  value: string;
  area: SearchArea;
  onChange: (text: string) => void;
  onSelect: (place: GeocodedPlace) => void;
}) {
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  // Only fire the debounced auto-search while the user is actively typing —
  // a value change from selecting a result or clearing the route should not
  // reopen the suggestion list for the text that was just chosen.
  const userEditedRef = useRef(false);
  const cancel = () => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = null;
    request.current?.abort();
    request.current = null;
    setResults([]);
    setMessage("");
    setLoading(false);
  };

  const search = async (query: string) => {
    if (!query.trim()) return;
    // An explicit search (Enter/button) supersedes any pending debounced
    // auto-search, so typing-triggered and explicit searches never both fire
    // for the same value.
    if (debounce.current) clearTimeout(debounce.current);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setMessage("Searching...");
    try {
      const places = await geocodePlace(query, area, controller.signal);
      if (request.current !== controller || controller.signal.aborted) return;
      setResults(places);
      setMessage(places.length ? `${places.length} matches` : `No matching addresses${area !== "anywhere" && area !== UNASSIGNED_REGION_ID ? ` in the ${getRegion(area).name} area` : ""}.`);
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller) setMessage(error instanceof Error ? error.message : "Address search failed.");
    } finally {
      if (request.current === controller) setLoading(false);
    }
  };

  // Suggest as the user types, debounced so each keystroke doesn't fire a request.
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    if (debounce.current) clearTimeout(debounce.current);
    if (!userEditedRef.current || value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setMessage("");
      return;
    }
    debounce.current = setTimeout(() => void search(value), TYPING_DEBOUNCE_MS);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, area]);

  useEffect(() => () => { request.current?.abort(); if (debounce.current) clearTimeout(debounce.current); }, []);

  return <div className="route-panel__field">
    <label htmlFor={id}>{label}</label>
    <div className="address-search__input">
      <input id={id} type="search" autoComplete="off" value={value} placeholder="Address or place"
        role="combobox" aria-expanded={results.length > 0} aria-controls={`${id}-results`} aria-autocomplete="list"
        onChange={event => { userEditedRef.current = true; onChange(event.target.value); }}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); void search(value); }
          if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            resultsRef.current?.querySelector<HTMLElement>("[role=option]")?.focus();
          }
        }} />
      <button type="button" className="btn" aria-label={`Search ${label.toLowerCase()} address`} title={`Search ${label.toLowerCase()} address`}
        disabled={!value.trim() || loading} onClick={() => void search(value)}><PanelIcon icon={Search} /></button>
    </div>
    {message && <p className="address-search__status" role="status">{message}</p>}
    {results.length > 0 && <div id={`${id}-results`} ref={resultsRef} className="address-search__results" role="listbox" aria-label={`${label} address results`}>
      {results.map((place, index) => <button type="button" key={`${place.lng}:${place.lat}:${index}`} role="option" aria-selected={false}
        onClick={() => { userEditedRef.current = false; cancel(); onSelect(place); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const sibling = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
            (sibling as HTMLElement | null)?.focus();
          }
        }}>{place.label}</button>)}
    </div>}
  </div>;
}