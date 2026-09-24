import React, { useState, useCallback } from "react";
import { inferRegion } from "../../config/regions";
import type { Patch, PatchCategory, PatchSeverity, PatchStatus } from "../../types/patch";
import {
  CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS,
  VALID_CATEGORIES, VALID_SEVERITIES, VALID_STATUSES,
} from "../../types/patch";

interface PatchFormProps {
  lngLat?: { lng: number; lat: number };
  patch?: Patch;
  onSave: (patch: Patch) => Promise<void>;
  onCancel: () => void;
}

async function resizeImage(file: File, maxPx = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = ev.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PatchForm({ lngLat, patch, onSave, onCancel }: PatchFormProps) {
  const isEdit = !!patch;
  const coords = patch
    ? { lng: patch.geometry.coordinates[0], lat: patch.geometry.coordinates[1] }
    : lngLat ?? { lng: 0, lat: 0 };

  const [title, setTitle] = useState(patch?.properties.title ?? "");
  const [category, setCategory] = useState<PatchCategory>(patch?.properties.category ?? "other");
  const [severity, setSeverity] = useState<PatchSeverity>(patch?.properties.severity ?? "caution");
  const [status, setStatus] = useState<PatchStatus>(patch?.properties.status ?? "observed");
  const [notes, setNotes] = useState(patch?.properties.notes ?? "");
  const [photo, setPhoto] = useState(patch?.properties.photo ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const result: Patch = {
      id: patch?.id ?? crypto.randomUUID(),
      type: "Feature",
      geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
      properties: {
        regionId: inferRegion([coords.lng, coords.lat]),
        title: title.trim(),
        category,
        severity,
        status,
        notes,
        photo: photo || undefined,
        source: patch?.properties.source ?? null,
        createdAt: patch?.properties.createdAt ?? now,
        updatedAt: now,
      },
    };
    try {
      await onSave(result);
    } finally {
      setSaving(false);
    }
  }, [title, category, severity, status, notes, photo, patch, coords, onSave]);

  return (
    <div className="patch-form-panel" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="patch-form-panel__header">
        <h2 className="patch-form-panel__title" id="form-title">
          {isEdit ? "Edit Patch" : "Drop a Patch"}
        </h2>
        <button
          type="button"
          className="patch-form-panel__close"
          aria-label="Cancel"
          onClick={onCancel}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="patch-title">Title</label>
          <input
            id="patch-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short description"
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="patch-category">Category</label>
          <select
            id="patch-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as PatchCategory)}
          >
            {VALID_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="patch-severity">Severity</label>
          <select
            id="patch-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as PatchSeverity)}
          >
            {VALID_SEVERITIES.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="patch-status">Status</label>
          <select
            id="patch-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as PatchStatus)}
          >
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="patch-notes">Notes</label>
          <textarea
            id="patch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional observations…"
            rows={3}
          />
        </div>

        <div className="form-photo">
          {photo && <img className="form-photo__preview" src={photo} alt="Patch photo" />}
          <div className="form-photo__row">
            <label className="form-photo__label">
              📷 {photo ? "Change" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(await resizeImage(f));
                  e.target.value = "";
                }}
              />
            </label>
            {photo && (
              <button type="button" className="form-photo__remove" onClick={() => setPhoto("")}>Remove</button>
            )}
          </div>
        </div>

        <p className="form-coords" aria-label="Coordinates">
          {coords.lng.toFixed(5)}, {coords.lat.toFixed(5)}
        </p>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
