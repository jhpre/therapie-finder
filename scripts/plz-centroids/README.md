# PLZ centroids for Leipzig

`build.mjs` builds `src/data/plz-centroids.json`: one centroid per Leipzig postcode, computed from the
OpenStreetMap `boundary=postal_code` relations inside the city of Leipzig (Overpass API). A PLZ is
kept if the centroid of its area lies inside the Leipzig city boundary.

## Run

```sh
node scripts/plz-centroids/build.mjs            # writes src/data/plz-centroids.json
node scripts/plz-centroids/build.mjs out.json   # or to another path
```

Needs Node 22+ and network access. It is not part of `make check` or the build; the app only loads
the committed JSON. If Overpass answers 5xx, wait a minute and retry.

## Last run

2026-10-25: 34 PLZ.

## Licence

© OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright). The attribution is
stored in the `source` field of the JSON and shown in the page footer.
