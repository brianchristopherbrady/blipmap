import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getPatches, savePatch, updatePatch, deletePatch, clearPatches } from "./data/db";
import { exportGeoJSON } from "./data/export";
import { importFromFile } from "./data/import";
import { refreshSeattleBaseline } from "./data/seattleBaseline";
import { measurePath } from "./gis/measure";
import { runPathCheck, type PathCheckResult } from "./gis/pathCheck";
import type { Patch, MapMode } from "./types/patch";
import type { Position } from "geojson";
import { CurbMap, type CurbMapElement } from "./components/react/CurbMap";
import { Toolbar } from "./components/react/Toolbar";
import { RecordsPanel, type Filters } from "./components/react/RecordsPanel";
import { PatchForm } from "./components/react/PatchForm";
import { MeasurePanel } from "./components/react/MeasurePanel";
import { PathCheckPanel } from "./components/react/PathCheckPanel";
import { ShortcutsModal } from "./components/react/ShortcutsModal";
import { PatchDetails } from "./components/react/PatchDetails";
import { RoutePanel } from "./components/react/RoutePanel";
import { ProfileDrawer } from "./components/react/ProfileDrawer";
import { useAccountProfile } from "./components/react/useAccountProfile";
import { AccountDialog } from "./components/react/AccountDialog";
import "./styles/tokens.css";
import "./styles/global.css";

const SEVERITY_RANK: Record<string, number> = { difficult: 0, caution: 1, easy: 2 };

export default function App() {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [mode, setMode] = useState<MapMode>("browse");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pendingLngLat, setPendingLngLat] = useState<{ lng: number; lat: number } | null>(null);
  const [editingPatch, setEditingPatch] = useState<Patch | null>(null);
  const [filters, setFilters] = useState<Filters>({ query: "", category: "", severity: "", status: "", sort: "date-desc" });
  const [measureCoords, setMeasureCoords] = useState<Position[]>([]);
  const [pathCheckResult, setPathCheckResult] = useState<PathCheckResult | null>(null);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; fn: () => void } } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const account = useAccountProfile();
  const { profile } = account;
  const [showAccount, setShowAccount] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineMessage, setBaselineMessage] = useState("Checking Seattle data...");

  const mapRef = useRef<CurbMapElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoPatchRef = useRef<Patch | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, action?: { label: string; fn: () => void }) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, action });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, action ? 30000 : 4000);
  }, []);

  useEffect(() => {
    let disposed = false;
    let checking = false;
    const refresh = async () => {
      if (disposed || checking) return;
      checking = true;
      setBaselineLoading(true);
      try {
        const result = await refreshSeattleBaseline();
        const cached = await getPatches();
        if (disposed) return;
        setPatches(cached);
        const checked = result.lastSuccess ? `Last checked ${new Date(result.lastSuccess).toLocaleString()}.` : "No baseline cached yet.";
        setBaselineMessage(result.retryPending ? `${checked} Update pending; retrying automatically.` : checked);
      } catch (err) {
        if (!disposed) setBaselineMessage(`Seattle update unavailable. Keeping cached reports; retrying automatically. ${err instanceof Error ? err.message : ""}`);
      } finally {
        checking = false;
        if (!disposed) setBaselineLoading(false);
      }
    };
    const initialize = async () => {
      try {
        const cached = await getPatches();
        if (disposed) return;
        setPatches(cached);
        await refresh();
      } catch (err) {
        if (!disposed) showToast(`Storage unavailable: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    };
    void initialize();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onReturn = () => { void refresh(); };
    const timer = setInterval(onVisible, 5 * 60 * 1000);
    window.addEventListener("online", onReturn);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("online", onReturn);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [showToast]);

  const resetMode = useCallback(() => {
    mapRef.current?.dismissTooltip();
    setDetailsId(null);
    setMode("browse");
    setPendingLngLat(null);
    setEditingPatch(null);
    setPathCheckResult(null);
    setMeasureCoords([]);
    // mode prop change triggers clearDraw/clearTempMarker inside curb-map's updated()
  }, []);

  // ESC → browse; Enter → finish drawing; ? → shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (e.key === "Escape") { resetMode(); setShowShortcuts(false); }
      if (e.key === "Enter" && (mode === "measure" || mode === "path-check")) mapRef.current?.finishDrawing();
      if (e.key === "?") setShowShortcuts((v) => !v);
      if (e.key === "l" || e.key === "L") mapRef.current?.locateMe();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, resetMode]);

  // Derived filtered + sorted patches
  const filteredPatches = useMemo(() => {
    const list = patches.filter((p) => {
      if (filters.category && p.properties.category !== filters.category) return false;
      if (filters.severity && p.properties.severity !== filters.severity) return false;
      if (filters.status && p.properties.status !== filters.status) return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!p.properties.title.toLowerCase().includes(q) && !p.properties.notes.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      switch (filters.sort) {
        case "date-asc":  return a.properties.createdAt.localeCompare(b.properties.createdAt);
        case "title":     return a.properties.title.localeCompare(b.properties.title);
        case "severity":  return SEVERITY_RANK[a.properties.severity] - SEVERITY_RANK[b.properties.severity];
        case "distance":  {
          if (!mapCenter) return 0;
          const dist = (p: Patch) => {
            const dx = p.geometry.coordinates[0] - mapCenter[0];
            const dy = p.geometry.coordinates[1] - mapCenter[1];
            return dx * dx + dy * dy;
          };
          return dist(a) - dist(b);
        }
        default:          return b.properties.createdAt.localeCompare(a.properties.createdAt);
      }
    });
  }, [patches, filters, mapCenter]);

  const measureResult = useMemo(() => measurePath(measureCoords), [measureCoords]);
  const detailsPatch = useMemo(() => patches.find((patch) => patch.id === detailsId), [patches, detailsId]);

  // ── Map event handlers ──────────────────────────────────────────────────────

  const handleMapClick = useCallback((e: Event) => {
    const { lng, lat } = (e as CustomEvent<{ lng: number; lat: number }>).detail;
    if (mode !== "add") return;
    setPendingLngLat({ lng, lat });
  }, [mode]);

  const handleRecordSelect = useCallback((e: Event) => {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    setSelectedId(id);
    setDetailsId(id);
    const patch = patches.find((p) => p.id === id);
    if (patch) mapRef.current?.flyTo(patch.geometry.coordinates as [number, number]);
  }, [patches]);

  const handleMeasureChange = useCallback((e: Event) => {
    setMeasureCoords((e as CustomEvent<{ coords: Position[] }>).detail.coords);
  }, []);

  const handleLocate = useCallback(() => { mapRef.current?.locateMe(); }, []);

  const handleMapCenter = useCallback((e: Event) => {
    const { lng, lat } = (e as CustomEvent<{ lng: number; lat: number }>).detail;
    setMapCenter([lng, lat]);
  }, []);

  const handleLocateError = useCallback(() => {
    showToast("Location unavailable. Check browser permissions.");
  }, [showToast]);

  const handleRouteReady = useCallback((
    coords: [number, number][],
    from: [number, number],
    to: [number, number],
    bbox: [number, number, number, number]
  ) => {
    mapRef.current?.showRoute(coords, from, to, bbox);
  }, []);

  const handleClearRoute = useCallback(() => {
    mapRef.current?.clearRoute();
  }, []);

  const handlePathComplete = useCallback((e: Event) => {
    if (mode !== "path-check") return;
    const coords = (e as CustomEvent<{ coords: Position[] }>).detail.coords;
    setPathCheckResult(runPathCheck(coords, patches));
  }, [mode, patches]);

  // ── Patch CRUD ──────────────────────────────────────────────────────────────

  const handleSavePatch = useCallback(async (patch: Patch) => {
    await savePatch(patch);
    setPatches((prev) => [...prev, patch]);
    setSelectedId(patch.id);
    setPendingLngLat(null);
    mapRef.current?.clearTempMarker();
    setMode("browse");
  }, []);

  const handleUpdatePatch = useCallback(async (patch: Patch) => {
    await updatePatch(patch);
    setPatches((prev) => prev.map((p) => (p.id === patch.id ? patch : p)));
    setEditingPatch(null);
  }, []);

  const handleDeletePatch = useCallback(async (id: string) => {
    const toDelete = patches.find((p) => p.id === id);
    await deletePatch(id);
    setPatches((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (detailsId === id) setDetailsId(null);
    if (toDelete) {
      undoPatchRef.current = toDelete;
      showToast("Patch deleted.", {
        label: "Undo",
        fn: async () => {
          if (!undoPatchRef.current) return;
          const p = undoPatchRef.current;
          undoPatchRef.current = null;
          await savePatch(p);
          setPatches((prev) => [...prev, p]);
        },
      });
    }
  }, [selectedId, patches, showToast]);

  const handleCancelForm = useCallback(() => {
    setPendingLngLat(null);
    setEditingPatch(null);
    mapRef.current?.clearTempMarker();
    if (mode === "add") setMode("browse");
  }, [mode]);

  // ── Mode ────────────────────────────────────────────────────────────────────

  const handleModeChange = useCallback((newMode: MapMode) => {
    setDetailsId(null);
    if (newMode !== mode) {
      setPathCheckResult(null);
      setMeasureCoords([]);
      setPendingLngLat(null);
    }
    setMode(newMode);
  }, [mode]);

  // A/M/P mode shortcuts — declared after handleModeChange to avoid TDZ
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (e.key === "a" || e.key === "A") handleModeChange("add");
      if (e.key === "m" || e.key === "M") handleModeChange("measure");
      if (e.key === "p" || e.key === "P") handleModeChange("path-check");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleModeChange]);

  // ── Panel actions ───────────────────────────────────────────────────────────

  const handlePanelSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDetailsId(id);
    const patch = patches.find((p) => p.id === id);
    if (patch) mapRef.current?.flyTo(patch.geometry.coordinates as [number, number]);
  }, [patches]);

  const handleFitToPatches = useCallback(() => {
    mapRef.current?.fitToPatches(patches);
  }, [patches]);

  const handleExport = useCallback(() => exportGeoJSON(patches), [patches]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await importFromFile(file);
      setPatches(await getPatches());
      showToast(
        result.skipped > 0
          ? `Imported ${result.patches.length} Patches. Skipped ${result.skipped} invalid records.`
          : `Imported ${result.patches.length} Patches.`
      );
    } catch (err) {
      showToast(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [showToast]);

  const handleClearSeed = useCallback(async () => {
    if (!confirm("Remove all patches?")) return;
    await clearPatches();
    setPatches([]);
    setSelectedId(null);
  }, []);

  const showForm = pendingLngLat !== null || editingPatch !== null;
  const showMeasurePanel = (mode === "measure" || mode === "path-check") && measureCoords.length > 0 && !pathCheckResult;

  return (
    <div className="app">
      <CurbMap
        ref={mapRef}
        mode={mode}
        patches={filteredPatches}
        selectedId={selectedId}
        onMapClick={handleMapClick}
        onRecordSelect={handleRecordSelect}
        onMeasureChange={handleMeasureChange}
        onPathComplete={handlePathComplete}
        onMapCenter={handleMapCenter}
        onLocateError={handleLocateError}
        style={{ width: "100%", height: "100%" }}
      />

      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">⬡</span>
          <span className="brand__name">blipmap</span>
        </div>
        <nav className="account-navigation" aria-label="Account and settings">
          <button className="btn" aria-haspopup="dialog" onClick={() => { setShowProfile(false); setShowAccount(true); }}>Account</button>
          <button className="btn" aria-haspopup="dialog" disabled={!account.ready}
            title={account.ready ? "Access preferences" : "Waiting for account preferences"}
            onClick={() => { setShowAccount(false); setShowProfile(true); }}>Settings</button>
        </nav>
      </header>

      <Toolbar
        mode={mode}
        patchCount={patches.length}
        onModeChange={handleModeChange}
        onFitToPatches={handleFitToPatches}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onLocate={handleLocate}
      />

      <RecordsPanel
        patches={filteredPatches}
        allPatchCount={patches.length}
        selectedId={selectedId}
        filters={filters}
        onFiltersChange={setFilters}
        onSelect={handlePanelSelect}
        onEdit={setEditingPatch}
        onDelete={handleDeletePatch}
        onClearSeed={handleClearSeed}
        baselineLoading={baselineLoading}
        baselineMessage={baselineMessage}
      />

      {showForm && (
        <PatchForm
          lngLat={pendingLngLat ?? undefined}
          patch={editingPatch ?? undefined}
          onSave={editingPatch ? handleUpdatePatch : handleSavePatch}
          onCancel={handleCancelForm}
        />
      )}

      {detailsPatch && !showForm && (
        <PatchDetails
          patch={detailsPatch}
          onClose={() => setDetailsId(null)}
          onEdit={(patch) => { setDetailsId(null); setEditingPatch(patch); }}
        />
      )}

      {showMeasurePanel && (
        <MeasurePanel
          result={measureResult}
          coordCount={measureCoords.length}
          mode={mode}
          onFinish={() => mapRef.current?.finishDrawing()}
          onClear={resetMode}
        />
      )}

      {pathCheckResult && (
        <PathCheckPanel
          result={pathCheckResult}
          onSelectPatch={handlePanelSelect}
          onClose={resetMode}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast.message}
          {toast.action && (
            <button
              className="toast__action"
              onClick={() => { toast.action!.fn(); setToast(null); }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {mode === "route" && account.ready && (
        <RoutePanel
          key={`route-${account.session?.user.id ?? "guest"}`}
          patches={patches}
          profile={profile}
          favorites={account.favorites}
          onSaveFavorite={account.session ? account.saveFavorite : undefined}
          onRouteReady={handleRouteReady}
          onClear={handleClearRoute}
          onClose={() => handleModeChange("browse")}
          onOpenProfile={() => setShowProfile(true)}
          onSelectPatch={handlePanelSelect}
        />
      )}

      {mode === "route" && !account.ready && <div className="route-panel" role="status">
        <p>{account.error || "Loading private preferences before routing..."}</p>
        <button className="btn" onClick={() => setShowAccount(true)}>Account</button>
      </div>}

      {showProfile && account.ready && !(showAccount || account.recovery) && (
        <ProfileDrawer
          key={`profile-${account.session?.user.id ?? "guest"}`}
          profile={profile}
          signedIn={!!account.session}
          onSave={account.save}
          onClose={() => setShowProfile(false)}
        />
      )}

      {(showAccount || account.recovery) && <AccountDialog
        session={account.session}
        recovery={account.recovery}
        ready={account.ready}
        loadError={account.error}
        favorites={account.favorites}
        onRemoveFavorite={account.deleteFavorite}
        onProfile={() => { setShowAccount(false); account.setRecovery(false); setShowProfile(true); }}
        onClose={() => { setShowAccount(false); account.setRecovery(false); }}
      />}

      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json"
        style={{ display: "none" }}
        onChange={handleImport}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
