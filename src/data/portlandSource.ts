import type { DatasetConfig } from "../config/regions";
import { convertPortlandRecord, portlandRecord } from "../gis/portlandBaseline";
import type { SourceBatch } from "./sourceAdapters";
import { canonical } from "./spatialHistory";

const MAX_RECORDS = 20000;
const PAGE_SIZE = 200;
const MAX_BYTES = 2 * 1024 * 1024;

async function request(url: URL, signal: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url.toString(), { signal, credentials: "omit", cache: "no-cache", redirect: "error", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`Portland inventory request failed (${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Portland inventory response is empty.");
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Portland inventory response exceeds the download limit.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel(); }
  const raw = JSON.parse(text) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || raw.error) throw new Error("Portland inventory service returned an error.");
  return raw;
}

export async function fetchPortland(config: DatasetConfig, signal: AbortSignal): Promise<{ raw: unknown; sourceVersion: null }> {
  if (!config.endpoint || !config.validationBounds) throw new Error("Portland source endpoint and bounds required.");
  const query = new URL(config.endpoint);
  query.search = new URLSearchParams({ f: "json", where: "ADAWarnings='N'",
    geometry: config.validationBounds.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", returnIdsOnly: "true" }).toString();
  const response = await request(query, signal);
  const ids = response.objectIds;
  if (response.objectIdFieldName !== "OBJECTID" || !Array.isArray(ids) || ids.length > MAX_RECORDS
    || ids.some(id => !Number.isSafeInteger(id) || id < 0) || new Set(ids).size !== ids.length || response.exceededTransferLimit === true) {
    throw new Error("Invalid or incomplete Portland inventory ID list.");
  }
  ids.sort((first: number, second: number) => first - second);
  const features: unknown[] = [];
  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
    const pageIds = ids.slice(offset, offset + PAGE_SIZE) as number[];
    const pageQuery = new URL(config.endpoint);
    pageQuery.search = new URLSearchParams({ f: "json", where: "ADAWarnings='N'", objectIds: pageIds.join(","),
      outFields: "OBJECTID,NonAssetID,ADAWarnings", outSR: "4326", returnGeometry: "true" }).toString();
    const page = await request(pageQuery, signal);
    const spatialReference = page.spatialReference as { wkid?: number } | undefined;
    if (page.exceededTransferLimit === true || spatialReference?.wkid !== 4326 || !Array.isArray(page.features)
      || page.features.length !== pageIds.length) throw new Error("Incomplete Portland inventory page; cached data is unchanged.");
    const remaining = new Set(pageIds);
    for (const value of page.features) {
      const record = portlandRecord(value, config.validationBounds);
      if (!remaining.delete(record.attributes.OBJECTID)) throw new Error("Unexpected or duplicate Portland inventory ID.");
      features.push(value);
    }
  }
  return { raw: { spatialReference: { wkid: 4326 }, features }, sourceVersion: null };
}

export function normalizePortland(raw: unknown, importedAt: string, config: DatasetConfig): SourceBatch {
  const collection = raw as { spatialReference?: { wkid?: number }; features?: unknown[]; exceededTransferLimit?: boolean; error?: unknown } | null;
  if (collection?.error || collection?.spatialReference?.wkid !== 4326 || !Array.isArray(collection.features)
    || collection.exceededTransferLimit || collection.features.length > MAX_RECORDS) throw new Error("Invalid Portland inventory snapshot.");
  const rawRecords = new Map<string, unknown>();
  const patches: SourceBatch["patches"] = [];
  let duplicates = 0;
  for (const value of collection.features) {
    const patch = convertPortlandRecord(value, importedAt, config);
    const id = patch.properties.source!.sourceId;
    if (rawRecords.has(id)) {
      if (canonical(rawRecords.get(id)) !== canonical(value)) throw new Error(`Conflicting duplicate Portland source ID: ${id}`);
      duplicates++;
    } else {
      rawRecords.set(id, value);
      patches.push(patch);
    }
  }
  if (!patches.length) throw new Error("No usable Portland observations returned. Empty snapshots require review.");
  return { patches, rawRecords, importedAt, sourceVersion: null, duplicates, complete: true };
}