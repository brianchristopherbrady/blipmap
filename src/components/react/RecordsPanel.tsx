import { useCallback } from "react";
import { CurbRecordCard } from "./CurbRecordCard";
import { REGIONS, type RegionConfig } from "../../config/regions";
import type { Patch, PatchCategory, PatchSeverity, PatchStatus } from "../../types/patch";
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS, VALID_CATEGORIES, VALID_SEVERITIES, VALID_STATUSES } from "../../types/patch";

export type SortOrder = "date-desc" | "date-asc" | "severity" | "title" | "distance";

export interface Filters {
  query: string;
  category: PatchCategory | "";
  severity: PatchSeverity | "";
  status: PatchStatus | "";
  sort: SortOrder;
}

interface RecordsPanelProps {
  region: RegionConfig;
  onRegionChange: (id: string) => void;
  patches: Patch[];
  allPatchCount: number;
  selectedId: string | null;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  onSelect: (id: string) => void;
  onEdit: (patch: Patch) => void;
  onDelete: (id: string) => void;
  onClearSeed: () => void;
  onRestore: () => void;
  storageBusy: boolean;
  baselineLoading: boolean;
  baselineMessage: string;
  onPlanRoute: () => void;
}

export function RecordsPanel({
  region, onRegionChange,
  patches, allPatchCount, selectedId, filters, onFiltersChange, onSelect, onEdit, onDelete, onClearSeed,
  baselineLoading, baselineMessage, onRestore, storageBusy, onPlanRoute,
}: RecordsPanelProps) {
  const update = useCallback((key: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  return (
    <aside className="records-panel" aria-label="Patches">
      <div className="records-panel__header">
        <div className="records-panel__title">
          Patches
          <span className="records-panel__count">{allPatchCount}</span>
        </div>
        <input
          className="records-panel__search"
          type="search"
          placeholder="Search patches…"
          value={filters.query}
          onChange={(e) => update("query", e.target.value)}
          aria-label="Search patches"
        />
        <div className="records-panel__filters">
          <select className="records-panel__sort" aria-label="Region" value={region.id} disabled={storageBusy}
            onChange={event => onRegionChange(event.target.value)}>
            {REGIONS.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          <select
            className="records-panel__sort"
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value)}
            aria-label="Sort patches"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="severity">Severity</option>
            <option value="title">Title A–Z</option>
            <option value="distance">Nearest first</option>
          </select>
        </div>
        <div className="records-panel__filters">
          <select
            className="records-panel__filter"
            value={filters.category}
            onChange={(e) => update("category", e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">Category</option>
            {VALID_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select
            className="records-panel__filter"
            value={filters.severity}
            onChange={(e) => update("severity", e.target.value)}
            aria-label="Filter by severity"
          >
            <option value="">Severity</option>
            {VALID_SEVERITIES.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
          <select
            className="records-panel__filter"
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">Status</option>
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="records-panel__route-nudge">
        Checking a specific trip? <button type="button" className="records-panel__route-link" onClick={onPlanRoute}>Plan a route</button> to see barriers along the way.
      </p>

      <div className="records-panel__list" role="list">
        {patches.length === 0 ? (
          <p className="records-panel__empty">
            {allPatchCount === 0
              ? (baselineLoading ? `Loading ${region.name} observations...` : "No observations available on this device.")
              : "No patches match your filters."}
          </p>
        ) : (
          patches.map((patch) => (
            <div key={patch.id} role="listitem">
              <CurbRecordCard
                patchId={patch.id}
                title={patch.properties.title}
                category={patch.properties.category}
                severity={patch.properties.severity}
                status={patch.properties.status}
                selected={selectedId === patch.id}
                onRecordSelect={() => onSelect(patch.id)}
              />
              {selectedId === patch.id && (
                <div className="patch-actions">
                  <button className="btn" onClick={() => onEdit(patch)}>Edit</button>
                  <button
                    className="btn btn--danger"
                    onClick={() => { if (confirm("Remove this Patch?")) onDelete(patch.id); }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="records-panel__footer">
        <div className="records-panel__baseline">
          {region.sources.filter(source => source.informationUrl && source.license).map(source => <p key={source.id}>
            {source.coverage} · <a href={source.informationUrl!} target="_blank" rel="noopener noreferrer">{source.attribution}</a> ({source.license!.id})
          </p>)}
          <p role="status" aria-live="polite" aria-atomic="true">{baselineMessage}</p>
        </div>
        <button className="btn" onClick={onRestore} disabled={baselineLoading || storageBusy}>
          Restore patches
        </button>
        <button className="records-panel__clear" onClick={onClearSeed} disabled={baselineLoading || storageBusy || allPatchCount === 0}>
          Clear all patches
        </button>
      </div>
    </aside>
  );
}
