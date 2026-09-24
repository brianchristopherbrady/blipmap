import type { Patch } from "../types/patch";
import { getMeta } from "./db";
import { getDataset, withinBounds } from "../config/regions";

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 8000;
const LABEL_TYPES = ["NoCurbRamp", "Obstacle", "SurfaceProblem", "NoSidewalk"];

export interface SidewalkReports {
  reports: { labelId: number; reportURL: string; imageDate: string | null }[];
  total: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

async function boundedJSON(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error("Source unavailable");
  const reader = response.body.getReader();
  try {
    if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Source too large");
    const decoder = new TextDecoder();
    let size = 0;
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BYTES) throw new Error("Source too large");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function resolveSidewalkReports(patch: Patch, signal: AbortSignal): Promise<SidewalkReports | null> {
  const source = patch.properties.source;
  const dataset = getDataset(source?.provider ?? "");
  if (signal.aborted || !source || dataset?.adapter !== "project-sidewalk" || !dataset.endpoint || !dataset.validationBounds
    || !/^\d+$/.test(source.sourceId) || !Number.isSafeInteger(Number(source.sourceId))
    || !LABEL_TYPES.includes(source.labelType)) return null;
  const origin = new URL(dataset.endpoint).origin;
  const controller = new AbortController();
  let stop: () => void = () => undefined;
  const aborted = new Promise<null>(resolve => {
    stop = () => { controller.abort(); resolve(null); };
  });
  signal.addEventListener("abort", stop, { once: true });
  const timeout = setTimeout(stop, TIMEOUT_MS);
  const load = async (): Promise<SidewalkReports | null> => {
    const snapshot = await getMeta(`${dataset.storageKey}:sourceSnapshot`);
    const original = Array.isArray(snapshot) ? snapshot.find(value => {
      const entry = record(value);
      const entrySource = record(record(entry?.properties)?.source);
      return entry?.id === patch.id && entrySource?.provider === source.provider
        && entrySource.sourceId === source.sourceId;
    }) : undefined;
    const coordinates = original ? record(record(original)?.geometry)?.coordinates : patch.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2
      || !coordinates.every(value => typeof value === "number" && Number.isFinite(value))) return null;
    const [longitude, latitude] = coordinates as number[];
    if (!withinBounds([longitude, latitude], dataset.validationBounds!)
      || controller.signal.aborted) return null;
    const url = new URL(dataset.endpoint!);
    url.searchParams.set("filetype", "geojson");
    url.searchParams.set("bbox", [longitude - 0.0001, latitude - 0.0001, longitude + 0.0001, latitude + 0.0001].join(","));
    url.searchParams.set("labelType", source.labelType);
    url.searchParams.set("includeRawLabels", "true");
    const collection = record(await boundedJSON(await fetch(url.toString(), {
      signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
    })));
    if (controller.signal.aborted || collection?.type !== "FeatureCollection"
      || !Array.isArray(collection.features) || collection.features.length > 100) return null;
    const matches = collection.features.map(value => record(record(value)?.properties)).filter(properties =>
      properties?.label_cluster_id === Number(source.sourceId) && properties?.label_type === source.labelType);
    if (matches.length !== 1) return null;
    const properties = matches[0]!;
    const labels = Array.isArray(properties.labels) ? properties.labels.map(record) : [];
    const candidates = Array.isArray(properties.label_ids) ? properties.label_ids : labels.map(label => label?.label_id);
    const ids = [...new Set(candidates.filter(positiveId))];
    if (!ids.length) return null;
    return {
      total: ids.length,
      reports: ids.slice(0, 3).map(labelId => {
        const date = labels.find(label => label?.label_id === labelId)?.image_capture_date;
        return {
          labelId, reportURL: `${origin}/label/${labelId}`,
          imageDate: typeof date === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(date) ? date : null,
        };
      }),
    };
  };
  try {
    return await Promise.race([load().catch(() => null), aborted]);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", stop);
  }
}