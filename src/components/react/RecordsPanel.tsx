import { useCallback } from "react";
import { CurbRecordCard } from "./CurbRecordCard";
import { SEATTLE_SOURCE_URL } from "../../gis/seattleBaseline";
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
  patches: Patch[];
  allPatchCount: number;
  selectedId: string | null;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  onSelect: (id: string) => void;
  onEdit: (patch: Patch) => void;
  onDelete: (id: string) => void;
  onClearSeed: () => void;
  baselineLoading: boolean;
  baselineMessage: string;
}

export function RecordsPanel({
  patches, allPatchCount, selectedId, filters, onFiltersChange, onSelect, onEdit, onDelete, onClearSeed,
  baselineLoading, baselineMessage,
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

      <div className="records-panel__list" role="list">
        {patches.length === 0 ? (
          <p className="records-panel__empty">
            {allPatchCount === 0
              ? (baselineLoading ? "Loading Seattle observations..." : "No observations available on this device.")
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
          <p>Downtown Seattle · <a href={SEATTLE_SOURCE_URL} target="_blank" rel="noopener noreferrer">Project Sidewalk</a> (CC0)</p>
          <p role="status" aria-live="polite" aria-atomic="true">{baselineMessage}</p>
        </div>
        <button className="records-panel__clear" onClick={onClearSeed} disabled={baselineLoading}>
          Clear all patches
        </button>
      </div>
    </aside>
  );
}
