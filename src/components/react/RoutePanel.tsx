import { ContextPanel, PanelIcon } from "./ContextPanel";
import { RotateCcw, X } from "lucide";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Patch } from "../../types/patch";
import type { UserProfile } from "../../data/profile";
import type { FavoriteLocation } from "../../data/account";
import type { RouteResult } from "../../gis/routing";
import { fetchRoute, formatDuration } from "../../gis/routing";
import { AddressSearch } from "./AddressSearch";
import type { SearchArea } from "../../data/geocoding";
import { DEFAULT_REGION_ID, getDataset, REGIONS, UNASSIGNED_REGION_ID, type RegionConfig } from "../../config/regions";
import { formatRouteStep } from "../../gis/routeDirections";
import { runPathCheck } from "../../gis/pathCheck";
import { formatDistance } from "../../gis/measure";
import { ORS_API_KEY } from "../../config/routing";

interface RoutePanelProps {
  region: RegionConfig;
  patches: Patch[];
  profile: UserProfile;
  favorites?: FavoriteLocation[];
  onSaveFavorite?: (place: Omit<FavoriteLocation, "id">) => Promise<void>;
  onRouteReady: (coords: [number, number][], from: [number, number], to: [number, number], bbox: [number, number, number, number]) => void;
  onClear: () => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onSelectPatch: (id: string) => void;
}

interface Suggestion { label: string; lng: number; lat: number; }

const imageryNotice = "Project Sidewalk reports are based on external imagery. Source images are not imported or attached.";

export function RoutePanel({ region, patches, profile, favorites = [], onSaveFavorite, onRouteReady, onClear, onClose, onOpenProfile, onSelectPatch }: RoutePanelProps) {
  const [fromText, setFromText] = useState("");
  const [toText, setToText]   = useState("");
  const [searchArea, setSearchArea] = useState<SearchArea>(region.id === UNASSIGNED_REGION_ID ? DEFAULT_REGION_ID : region.id);
  const [fromPlace, setFromPlace] = useState<Suggestion | null>(null);
  const [toPlace, setToPlace]     = useState<Suggestion | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState("");

  const routeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    setRoute(null);
    setLoading(false);
    setError(null);
    setShowSteps(false);
    onClear();
    return () => {
      routeRequest.current?.abort();
      routeRequest.current = null;
      onClear();
    };
  }, [fromPlace, toPlace, profile, onClear]);

  const buildRoute = useCallback(async () => {
    if (!fromPlace || !toPlace) return;
    routeRequest.current?.abort();
    const request = new AbortController();
    routeRequest.current = request;
    setLoading(true);
    setError(null);
    setRoute(null);
    onClear();
    try {
      if (!region.routingModes.includes(profile.routingProfile)) throw new Error("This travel mode is not configured for the selected region.");
      const result = await fetchRoute(
        [fromPlace.lng, fromPlace.lat],
        [toPlace.lng, toPlace.lat],
        profile.routingProfile,
        request.signal,
        profile
      );
      if (request.signal.aborted || routeRequest.current !== request) return;
      setRoute(result);
      onRouteReady(result.coordinates, [fromPlace.lng, fromPlace.lat], [toPlace.lng, toPlace.lat], result.bbox);
    } catch (e) {
      if (!request.signal.aborted && routeRequest.current === request) {
        setError(e instanceof Error ? e.message : "Routing failed.");
      }
    } finally {
      if (routeRequest.current === request) setLoading(false);
    }
  }, [fromPlace, toPlace, profile, onRouteReady, onClear, region]);

  const handleClear = useCallback(() => {
    setFromText(""); setToText("");
    setFromPlace(null); setToPlace(null);
    setRoute(null); setError(null); setShowSteps(false);
    onClear();
  }, [onClear]);

  const handlePrint = useCallback(() => {
    if (!route || !fromPlace || !toPlace) return;
    const lines = [
      `blipmap Route — ${new Date().toLocaleDateString()}`,
      `From: ${fromPlace.label}`,
      `To:   ${toPlace.label}`,
      `Travel profile: ${profile.routingProfile}`,
      `Requirements: ${JSON.stringify({ noStairs: profile.avoidStairs, maximumInclinePercent: profile.avoidSteepSlopes ? Math.min(profile.maximumInclinePercent ?? 3, 3) : profile.maximumInclinePercent, minimumWidthM: profile.minimumWidthM, smoothSurfacesOnly: profile.avoidRoughSurfaces })}`,
      "Based on mapped data, not a guarantee of accessibility. Unknown or outdated barriers may remain.",
      `Distance: ${formatDistance(route.distanceM)}  ·  Time: ${formatDuration(route.durationS)}`,
      "",
      "Turn-by-turn directions",
      "──────────────────────",
      ...route.steps.map((step, index) => `${index + 1}. ${formatRouteStep(step)}`),
      "",
      "Accessibility notes (blipmap patches near this route)",
      "─────────────────────────────────────────────────────",
      ...(patchWarning?.nearby.length
        ? patchWarning.nearby.map((p) => `• ${p.properties.title} [${p.properties.severity}] — ${p.properties.notes || p.properties.category}`)
        : ["None recorded near this route."]),
      ...(hasImageryReports ? [imageryNotice] : []),
    ];
    const win = window.open("", "_blank");
    if (!win) return;
    win.opener = null;
    win.document.title = "blipmap directions";
    const content = win.document.createElement("pre");
    content.style.cssText = "font:14px/1.6 monospace;padding:2rem;white-space:pre-wrap;overflow-wrap:anywhere";
    content.textContent = lines.join("\n");
    win.document.body.replaceChildren(content);
    win.print();
  }, [route, fromPlace, toPlace, profile, patches]);

  const patchWarning = route
    ? runPathCheck(route.coordinates, patches)
    : null;
  const hasImageryReports = patchWarning?.nearby.some(patch => getDataset(patch.properties.source?.provider ?? "")?.adapter === "project-sidewalk");

  const noKey = !ORS_API_KEY;

  return (
    <ContextPanel title="Route planner" expanded={!!route || !!error} actions={<>
      <button className="btn" onClick={handleClear}><PanelIcon icon={RotateCcw} />Clear route</button>
      <button className="btn" onClick={onClose} aria-label="Close route planner"><PanelIcon icon={X} />Exit planner</button>
    </>}><div className="route-panel">
      <div className="route-panel__header">
        <h2 className="route-panel__title">Route</h2>
        <div className="route-panel__header-actions">
          <button className="btn" onClick={onOpenProfile} title="Mobility settings">⚙</button>
        </div>
      </div>

      {noKey && (
        <p className="route-panel__warning">
          Add <code>VITE_ORS_API_KEY=your_key</code> to a <code>.env</code> file and restart the server to enable routing.
        </p>
      )}

      <div className="route-panel__profile-badge">
        {`Profile: ${profile.routingProfile}${profile.avoidStairs ? " · No stairs" : ""}`}
      </div>

      {favorites.length > 0 && <div className="route-panel__field">
        <label htmlFor="favorite-destination">Saved destination</label>
        <select id="favorite-destination" value="" onChange={event => {
          const favorite = favorites.find(place => place.id === event.target.value);
          if (favorite) { setToPlace(favorite); setToText(favorite.label); }
        }}>
          <option value="">Choose a favorite</option>
          {favorites.map(favorite => <option key={favorite.id} value={favorite.id}>{favorite.label}</option>)}
        </select>
      </div>}

      <div className="route-panel__field">
        <label htmlFor="route-search-area">Search area</label>
        <select id="route-search-area" value={searchArea} onChange={event => setSearchArea(event.target.value as SearchArea)}>
          {REGIONS.filter(candidate => candidate.id !== UNASSIGNED_REGION_ID).map(candidate =>
            <option key={candidate.id} value={candidate.id}>{candidate.name} area</option>)}
        </select>
      </div>
      <AddressSearch id="route-from" label="From" value={fromText} area={searchArea}
        onChange={text => { setFromText(text); setFromPlace(null); }}
        onSelect={place => { setFromText(place.label); setFromPlace(place); }} />
      {fromPlace && <p className="route-panel__coords">{fromPlace.lat.toFixed(4)}, {fromPlace.lng.toFixed(4)}</p>}
      <AddressSearch id="route-to" label="To" value={toText} area={searchArea}
        onChange={text => { setToText(text); setToPlace(null); }}
        onSelect={place => { setToText(place.label); setToPlace(place); }} />
      {toPlace && <p className="route-panel__coords">{toPlace.lat.toFixed(4)}, {toPlace.lng.toFixed(4)}</p>}
      <p className="address-search__status">Address data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>

      <div className="route-panel__actions">
        <button className="btn btn--primary" onClick={buildRoute}
          disabled={!fromPlace || !toPlace || loading || noKey}>
          {loading ? "Routing…" : "Get route"}
        </button>
      </div>
      {onSaveFavorite && toPlace && <button className="btn" disabled={savingFavorite} onClick={async () => {
        setSavingFavorite(true); setFavoriteMessage("");
        try { await onSaveFavorite(toPlace); setFavoriteMessage("Destination saved."); }
        catch { setFavoriteMessage("Could not save this destination. It may already be a favorite; please check your account."); }
        finally { setSavingFavorite(false); }
      }}>{savingFavorite ? "Saving..." : "Save destination"}</button>}
      {favoriteMessage && <p role="status">{favoriteMessage}</p>}

      {error && <p className="route-panel__error" role="alert">{error}</p>}

      {route && (
        <div className="route-panel__result">
          <p className="route-panel__warning">Route filters use mapped data. Unknown barriers and temporary changes may remain; accessibility is not guaranteed.</p>
          <div className="route-panel__summary">
            <span className="route-panel__stat">{formatDistance(route.distanceM)}</span>
            <span className="route-panel__stat">{formatDuration(route.durationS)}</span>
          </div>

          {patchWarning && patchWarning.nearby.length > 0 && (
            <div className={`route-panel__accessibility route-panel__accessibility--${patchWarning.rating}`}>
              <strong>{patchWarning.rating === "difficult" ? "⚠ Barriers ahead" : "! Caution"}</strong>
              <p>{patchWarning.summary}</p>
              <ul>
                {patchWarning.nearby.map((p) => (
                  <li key={p.id}>
                    <span className={`route-panel__dot ${p.properties.severity}`} aria-hidden="true" />
                    <span className="route-panel__barrier-text">
                      <button type="button" className="btn route-panel__barrier-title" aria-haspopup="dialog" onClick={() => onSelectPatch(p.id)}>
                        {p.properties.title}
                      </button>
                      {p.properties.notes && <> <span className="route-panel__note">{p.properties.notes}</span></>}
                    </span>
                  </li>
                ))}
              </ul>
              {hasImageryReports && <p className="route-panel__imagery-note">{imageryNotice}</p>}
            </div>
          )}

          {patchWarning && patchWarning.nearby.length === 0 && (
            <div className="route-panel__accessibility route-panel__accessibility--clear">
              <strong>No recorded barriers nearby</strong>
              <p>Missing reports do not establish accessibility. Unknown or outdated barriers may remain.</p>
            </div>
          )}

          <div className="route-panel__directions">
            <button className="btn route-panel__toggle" onClick={() => setShowSteps((v) => !v)}>
              {showSteps ? "Hide directions" : `Show ${route.steps.length} steps`}
            </button>
            {showSteps && (
              <ol className="route-panel__steps">
                {route.steps.map((step, index) => (
                  <li key={index}>{formatRouteStep(step)}</li>
                ))}
              </ol>
            )}
          </div>

          <button className="btn route-panel__print" onClick={handlePrint}>🖨 Print directions</button>
        </div>
      )}
    </div></ContextPanel>
  );
}
