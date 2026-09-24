# Portland Accessibility Data

Research and implementation: 2026-09-22.

## Selected Source

- Publisher: City of Portland, Bureau of Transportation (PBOT).
- [Official metadata and use constraints](https://www.portlandmaps.com/metadata/index.cfm?action=DisplayLayer&LayerID=52778).
- [Official open-data catalog item](https://www.arcgis.com/home/item.html?id=dd2aeefd138741f9bc7a0a37e8901092), published by `cgis.maps`.
- [ArcGIS layer and coded field domains](https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/61).
- [City open-data portal](https://gis-pdx.opendata.arcgis.com/).

The catalog describes points for curb ramps on corners, median islands and mid-block crossings. It publishes ownership, maintenance responsibility and detectable-warning presence. Metadata describes `NonAssetID` as the unique identifier and `ADAWarnings` as the presence of a detectable warning, such as a truncated-dome mat. The service defines `N=No`, `Y=Yes`, `U=Unknown`.

The metadata permits public use under the **City of Portland Data Distribution Policy**, with an as-is disclaimer and no warranties for errors, omissions or positional accuracy. This is a custom municipal policy, not CC0 or an invented Creative Commons license. The app links the source's actual use-constraint metadata and attributes PBOT. No source photos are fetched or displayed.

Search also found university copies, campus surveys and third-party accessibility scoring applications. Those were not selected: copying a public map alone does not establish licensing, current coverage, or the meaning of its derived accessibility score. The municipal transportation map service also publishes the same inventory, but the importer uses the dedicated endpoint linked by the City's open-data catalog.

## What Appears on the Map

Only records explicitly marked `ADAWarnings='N'` inside the configured Portland operational envelope are imported. The live ID query returned **3,026 records** during research; this is a point-in-time count, not a fixed application constant.

They appear as **Detectable warning absent in city inventory (PBOT)**, category Curb / Ramp, severity Caution, status Observed. The City's recorded absence may matter to people using tactile cues. It does **not** mean the curb ramp itself is absent, that it is legally noncompliant, or that a route is impassable. Caution is the app's conservative presentation choice, not a municipal severity rating.

Unknown, null, undocumented and Yes values are not turned into issues. These records are not a comprehensive barrier survey: they do not establish sidewalk slope, ramp width, temporary blockage, surface quality, or current accessibility. An empty area is not evidence of accessible passage.

No observation/inspection timestamp is supplied for this subset, so observation age remains unknown. Installation dates and catalog update times are not substituted for an inspection date. The source's published update frequency is weekly; the app checks weekly and retries failures after an hour. A recent fetch does not make the underlying observation recent.

## Import Behavior

1. Query the selected subset's full `OBJECTID` list within the operational envelope, using `inSR=4326`.
2. Retrieve batches of at most 200 IDs with `outSR=4326`, requesting only `OBJECTID,NonAssetID,ADAWarnings` and point geometry. The open-data service's live transfer limit is 200, not the related transportation service's 4,000. No image paths, credentials or personal data are requested.
3. Require exact ID membership/count and WGS84 coordinates. Reject transfer-limit flags, invalid codes, invalid/out-of-bounds geometry, duplicate query IDs, conflicting stable IDs, service errors, empty snapshots and oversized payloads. Each response is limited to 2 MiB and a run to 20,000 records; the shared coordinator supplies cancellation and a 60-second timeout.
4. Normalize by stable `NonAssetID`, not the service's potentially reassigned `OBJECTID`. Persist the selected raw fields and geometry as source evidence, linked to the normalized observation and import report. API/catalog versions are not invented as dataset versions.
5. Commit only after the entire fetch and normalization succeeds. Failed refreshes retain cached Patches/history and show a retry message. Unchanged imports do not duplicate observation/source revisions. Source withdrawals remain apparent removals, not automatic resolution or deletion.

ArcGIS does not provide a transactionally frozen snapshot through this integration. Records changing during retrieval can cause a batch to be rejected and retried; an undetectable same-ID edit remains possible. The operational envelope is not a municipal boundary polygon. The source extends slightly beyond it; records outside it are not silently assigned to Portland. No claim of full citywide or metro coverage is made.

The implementation reuses IndexedDB v3; no schema migration, hosted SQL change, account requirement, new package, or secret is needed. Existing local corrections, hidden records, region isolation and backups retain their behavior.

## Verification

- Pure converter tests cover a real public source sample, field meanings, stable IDs, bounds, malformed inputs and provenance-preserving GeoJSON round-trips.
- Adapter tests cover 501 records across three batches, the 200-record page limit, exact ID membership, WGS84, partial/error/oversized responses, cancellation, duplicates and empty snapshots.
- Browser tests cover mobile/desktop markers, keyboard details/focus, source use terms, no incorrect imagery/voting claims, reload without duplicate downloads, raw evidence and failed-refresh cache retention.
- Cross-region tests deliberately simulate a Portland outage to ensure local workflows and late Seattle response isolation remain usable.

Verified results: TypeScript and production build passed; 175 unit tests and 26 affected browser tests passed. The opt-in unmocked Chromium check imported all 3,026 records, verified rendered markers and loaded basemap tiles at 1280px and 390px, and verified persistence after reload. The initial live check caught the service's 200-record transfer limit; the importer was corrected and the live check passed afterward. The existing large-bundle warning remains.

Run the real-service smoke check explicitly in PowerShell (ordinary suites skip this external dependency):

```powershell
$env:BLIPMAP_LIVE_DATA = '1'
npx playwright test tests/browser/portland-live.spec.ts --workers=1
Remove-Item Env:BLIPMAP_LIVE_DATA
```

External service availability and the record count may change. Mocked regression tests do not depend on these being constant.

Implementation files: `src/config/regions.ts`, `src/gis/portlandBaseline.ts`, `src/data/portlandSource.ts`, `src/data/sourceAdapters.ts`, `src/gis/seattleBaseline.ts` (shared source parser), and `src/components/react/PatchDetails.tsx`.