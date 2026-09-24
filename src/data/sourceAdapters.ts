import type { DatasetConfig } from "../config/regions";
import { convertProjectSidewalk } from "../gis/seattleBaseline";
import type { Patch } from "../types/patch";
import { canonical } from "./spatialHistory";
import { fetchPortland, normalizePortland } from "./portlandSource";

export interface SourceBatch {
  patches: Patch[];
  rawRecords: Map<string, unknown>;
  importedAt: string;
  sourceVersion: string | null;
  duplicates: number;
  complete: boolean;
}

export interface SourceAdapter {
  readonly config: DatasetConfig;
  fetch(signal: AbortSignal): Promise<{ raw: unknown; sourceVersion: string | null }>;
  normalize(raw: unknown, importedAt: string, sourceVersion?: string | null): SourceBatch;
}

function unconfigured(config: DatasetConfig): never {
  throw new Error(`Dataset ${config.id} is not configured. A verified endpoint, adapter and license are required.`);
}

export function sourceAdapter(config: DatasetConfig): SourceAdapter {
  return {
    config,
    async fetch(signal) {
      if (!config.endpoint || !config.license || !config.attribution || config.adapter === "unconfigured") return unconfigured(config);
      if (config.adapter === "portland-curb-ramps") return fetchPortland(config, signal);
      const response = await fetch(config.endpoint, { signal, cache: "no-cache", credentials: "omit" });
      if (!response.ok) throw new Error(`${config.name} request failed (${response.status}).`);
      return { raw: await response.json() as unknown, sourceVersion: response.headers.get("etag") ?? response.headers.get("last-modified") };
    },
    normalize(raw, importedAt, sourceVersion = null) {
      if (config.adapter === "portland-curb-ramps" && config.license && config.attribution) return normalizePortland(raw, importedAt, config);
      if (config.adapter !== "project-sidewalk" || !config.license || !config.attribution) return unconfigured(config);
      const collection = raw as { type?: string; features?: unknown[] } | null;
      if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new Error("Source data is not a GeoJSON FeatureCollection.");
      const rawRecords = new Map<string, unknown>();
      const unique: unknown[] = [];
      let duplicates = 0;
      for (const value of collection.features) {
        const feature = value as { properties?: { label_cluster_id?: unknown } } | null;
        const externalId = feature?.properties?.label_cluster_id;
        if (typeof externalId !== "number" || !Number.isSafeInteger(externalId) || externalId < 0) {
          unique.push(value);
          continue;
        }
        const key = String(externalId);
        if (rawRecords.has(key)) {
          if (canonical(rawRecords.get(key)) !== canonical(value)) throw new Error(`Conflicting duplicate source ID: ${key}`);
          duplicates++;
        } else {
          rawRecords.set(key, value);
          unique.push(value);
        }
      }
      const converted = convertProjectSidewalk({ type: "FeatureCollection", features: unique }, importedAt, config);
      if (converted.skipped) throw new Error("Source data contains invalid records. Cached observations are unchanged.");
      if (!converted.patches.length) throw new Error("No usable source observations returned. Empty snapshots require review.");
      return { patches: converted.patches, rawRecords, importedAt, sourceVersion, duplicates, complete: true };
    },
  };
}