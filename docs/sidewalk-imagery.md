# Project Sidewalk Original Reports

## Deployment and Permission Check

Verified on 2026-09-17 against the Seattle deployment:

- [Bounded cluster request](https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?filetype=geojson&bbox=-122.336,47.605,-122.335,47.606&labelType=NoCurbRamp,Obstacle,SurfaceProblem,NoSidewalk&includeRawLabels=true): HTTP 200. Cluster `12590026` (`NoSidewalk`, coordinates `[-122.3358485407, 47.6058172328]`) returned `label_ids: [126583]` and `labels[]` with `label_id: 126583`, `pano_source: "gsv"`, and `image_capture_date: "2019-06"`.
- [Original report 126583](https://sidewalk-sea.cs.washington.edu/label/126583): HTTP 200, HTML.
- [Image endpoint 126583](https://sidewalk-sea.cs.washington.edu/label/126583/image): HTTP 200, JPEG, 223864 bytes. Availability does not grant a reproduction or remote-display license.
- [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms): HTTP 200. Section 3.2.3 restricts resharing outside the services and displaying Street View imagery and non-Google maps on the same screen. No explicit permission for this app's inline remote previews was established. The observation dataset's CC0 license is not an imagery license.

The delivered behavior is exact original-report links, not inline source imagery. No remote image URL is exposed or requested by the app. Local user photos remain separate.

## Lookup Contract

Opening source-backed Patch details triggers one ephemeral request to `/v3/api/labelClusters` with `filetype=geojson`, `includeRawLabels=true`, the source `labelType`, and a bounding box extending 0.0001 degrees on either side of the original point. Original coordinates come from the existing `seattle:sourceSnapshot` metadata when the Patch and source IDs match. Without that snapshot, current coordinates are only a search window: an exact cluster-ID and label-type match is still required. There is no nearest-feature association.

The lookup has an eight-second deadline including metadata access, a 256 KiB streamed response limit, a 100-feature limit, no retries, and no pagination. Missing, ambiguous, oversized, malformed, offline, timed-out, or aborted results are unavailable. Source responses cannot supply navigable URLs: only positive safe-integer label IDs form links at the fixed Seattle origin and verified `/label/:labelId` route. Duplicate IDs are removed. At most three links are shown, with an explicit displayed/total count for multi-label clusters. Optional raw-label imagery dates are displayed as YYYY-MM, not as fresh observations.

Closing or changing the Patch aborts the request and prevents stale UI updates. No schema changes, metadata writes, saved photo/source fields, persistent image caches, dependencies, credentials, or backend services are added.