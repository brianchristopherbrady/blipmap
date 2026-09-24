import { useEffect, useId, useRef, useState } from "react";
import type { Patch } from "../../types/patch";
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../../types/patch";
import { getDataset } from "../../config/regions";
import { resolveSidewalkReports, type SidewalkReports } from "../../data/sidewalkImagery";

interface PatchDetailsProps {
  patch: Patch;
  onClose: () => void;
  onEdit: (patch: Patch) => void;
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function OriginalReports({ patch }: { patch: Patch }) {
  const [lookup, setLookup] = useState<{ patch: Patch; result: SidewalkReports | null } | null>(null);
  const loading = lookup?.patch !== patch;
  const result = loading ? null : lookup.result;

  useEffect(() => {
    const controller = new AbortController();
    void resolveSidewalkReports(patch, controller.signal).then(result => {
      if (!controller.signal.aborted) setLookup({ patch, result });
    });
    return () => controller.abort();
  }, [patch]);

  return (
    <section className="patch-details__notes patch-details__reports" aria-label="Original imagery" aria-busy={loading}>
      <h3>{loading ? "Original reports" : result ? "Original reports" : "Original imagery unavailable"}</h3>
      <div role="status">
        {loading ? <p>Looking up original reports...</p> : result ? (
          <p>{result.total > 1 ? `Showing ${result.reports.length} of ${result.total} original reports in this source cluster.` : "One original report in this source cluster."}</p>
        ) : <p>This report has no verified link to an original image or panorama. The source information link describes the dataset, not this individual report.</p>}
      </div>
      {result && (
        <>
          <ul>
            {result.reports.map(report => (
              <li key={report.labelId}>
                <a href={report.reportURL} target="_blank" rel="noopener noreferrer">View original report {report.labelId}</a>
                {report.imageDate && <span>Imagery date: {report.imageDate}</span>}
              </li>
            ))}
          </ul>
          <p>Inline imagery is not licensed for display here. Imagery may be available on the original report page.</p>
        </>
      )}
    </section>
  );
}

export function PatchDetails({ patch, onClose, onEdit }: PatchDetailsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { properties, geometry } = patch;
  const dataset = getDataset(properties.source?.provider ?? "");

  useEffect(() => {
    const dialog = dialogRef.current!;
    let opener = document.activeElement;
    while (opener?.shadowRoot?.activeElement) opener = opener.shadowRoot.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="patch-details"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="patch-details__header">
        <h2 id={titleId} tabIndex={-1} autoFocus>{properties.title}</h2>
        <button className="btn" onClick={onClose} aria-label="Close patch details">Close</button>
      </header>
      <dl className="patch-details__metadata">
        <div><dt>Category</dt><dd>{CATEGORY_LABELS[properties.category]}</dd></div>
        <div><dt>Severity</dt><dd className={`patch-details__severity ${properties.severity}`}>{SEVERITY_LABELS[properties.severity]}</dd></div>
        <div><dt>Status</dt><dd>{STATUS_LABELS[properties.status]}</dd></div>
      </dl>
      <section className="patch-details__notes" aria-label="Notes">
        <h3>Notes</h3>
        <p>{properties.notes.trim() || "No notes recorded."}</p>
      </section>
      {properties.source && (
        <section className="patch-details__notes" aria-label="External source">
          <h3>External source</h3>
          {dataset?.informationUrl && <p><a href={dataset.informationUrl} target="_blank" rel="noopener noreferrer">{dataset.name} source information</a></p>}
          <p>{dataset?.license ? `Observation data: ${dataset.license.id}. ${dataset.license.scope}.` : "Source license not configured."}</p>
          {dataset?.license?.url && <p><a href={dataset.license.url} target="_blank" rel="noopener noreferrer">Source use terms</a></p>}
          {dataset?.adapter === "portland-curb-ramps" ? <>
            <p>Municipal inventory, not a live inspection. Observation date unknown; current conditions may differ.</p>
            <dl className="patch-details__metadata">
              <div><dt>Municipal record ID</dt><dd>{properties.source.sourceId}</dd></div>
              <div><dt>Detectable warning</dt><dd>Recorded absent (ADAWarnings=N)</dd></div>
              <div><dt>Observation date</dt><dd>Unknown</dd></div>
            </dl>
          </> : <>
          <p>Imagery-based report. Conditions may have changed; source validation is not local verification.</p>
          <dl className="patch-details__metadata">
            <div><dt>Source cluster</dt><dd>{properties.source.sourceId}</dd></div>
            <div><dt>Source type</dt><dd>{properties.source.labelType}</dd></div>
            <div><dt>Average imagery date</dt><dd>{properties.source.averageImageDate ? displayDate(properties.source.averageImageDate) : "Unknown"}</dd></div>
            <div><dt>Average label date</dt><dd>{properties.source.averageLabelDate ? displayDate(properties.source.averageLabelDate) : "Unknown"}</dd></div>
            <div><dt>Source severity (1-3)</dt><dd>{properties.source.medianSeverity ?? "Unknown"}</dd></div>
            <div><dt>Labels in cluster</dt><dd>{properties.source.clusterSize ?? "Unknown"}</dd></div>
            <div><dt>Agree votes</dt><dd>{properties.source.agreeCount ?? "Unknown"}</dd></div>
            <div><dt>Disagree votes</dt><dd>{properties.source.disagreeCount ?? "Unknown"}</dd></div>
            <div><dt>Unsure votes</dt><dd>{properties.source.unsureCount ?? "Unknown"}</dd></div>
          </dl>
          <p>Validation totals may include human and AI judgments.</p>
          </>}
        </section>
      )}
      {properties.source && dataset?.adapter === "project-sidewalk" && <OriginalReports patch={patch} />}
      {properties.photo && (
        <section className="patch-details__notes" aria-label="Local photo">
          <h3>Local photo</h3>
          <img className="patch-details__photo" src={properties.photo} alt={`Observation: ${properties.title}`} />
        </section>
      )}
      <dl className="patch-details__metadata">
        <div><dt>Longitude</dt><dd>{geometry.coordinates[0].toFixed(5)}</dd></div>
        <div><dt>Latitude</dt><dd>{geometry.coordinates[1].toFixed(5)}</dd></div>
        <div><dt>{properties.source ? "Imported" : "Created"}</dt><dd>{displayDate(properties.source?.importedAt ?? properties.createdAt)}</dd></div>
        <div><dt>Updated</dt><dd>{displayDate(properties.updatedAt)}</dd></div>
      </dl>
      <footer className="patch-details__actions">
        <button className="btn btn--primary" onClick={() => onEdit(patch)}>Edit Patch</button>
      </footer>
    </dialog>
  );
}