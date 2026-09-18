import { validateGeoJSON, type ImportResult } from "../gis/importValidate";
import { savePatch } from "./db";

export async function importFromFile(file: File): Promise<ImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("File does not contain valid JSON.");
  }
  const result = validateGeoJSON(raw);
  for (const patch of result.patches) {
    await savePatch(patch);
  }
  return result;
}
