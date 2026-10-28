// Builds src/data/plz-centroids.json from OpenStreetMap postal-code boundaries.
// Usage: node scripts/plz-centroids/build.mjs [output-path]
// Not part of `make check` or the build; run by hand, then commit the result.
import { writeFile } from "node:fs/promises";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const OUT = process.argv[2] ?? new URL("../../src/data/plz-centroids.json", import.meta.url);

const QUERY = `[out:json][timeout:180];
area["name"="Leipzig"]["boundary"="administrative"]["admin_level"="6"]->.city;
(
  rel["boundary"="administrative"]["admin_level"="6"]["name"="Leipzig"](area.city);
  rel(area.city)["boundary"="postal_code"];
);
out geom;`;

/** Joins the way segments of a relation's outer members into closed rings of [lon, lat]. */
export function buildRings(members) {
  const segs = members
    .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry?.length > 1)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const rings = [];
  while (segs.length > 0) {
    const ring = segs.pop();
    let grew = true;
    while (grew && !same(ring[0], ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const end = ring[ring.length - 1];
        if (same(s[0], end)) ring.push(...s.slice(1));
        else if (same(s[s.length - 1], end)) ring.push(...[...s].reverse().slice(1));
        else if (same(s[s.length - 1], ring[0])) ring.unshift(...s.slice(0, -1));
        else if (same(s[0], ring[0])) ring.unshift(...[...s].reverse().slice(0, -1));
        else continue;
        segs.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/** Area-weighted centroid of rings (planar, longitude scaled by cos(lat)); returns {lat, lon}. */
export function centroid(rings) {
  const lat0 = (rings[0][0][1] * Math.PI) / 180;
  const k = Math.cos(lat0);
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = [ring[i][0] * k, ring[i][1]];
      const [x2, y2] = [ring[i + 1][0] * k, ring[i + 1][1]];
      const f = x1 * y2 - x2 * y1;
      a += f;
      cx += (x1 + x2) * f;
      cy += (y1 + y2) * f;
    }
  }
  if (a === 0) throw new Error("degenerate polygon");
  return { lat: cy / (3 * a), lon: cx / (3 * a) / k };
}

export function inside([x, y], rings) {
  let c = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

async function main() {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "therapie-finder plz-centroids script",
    },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`Overpass answered ${res.status}`);
  const { elements } = await res.json();

  const cityRel = elements.find((e) => e.tags?.boundary === "administrative");
  if (!cityRel) throw new Error("city boundary of Leipzig not found");
  const cityRings = buildRings(cityRel.members);

  const entries = [];
  for (const e of elements) {
    const plz = e.tags?.postal_code;
    if (e.tags?.boundary !== "postal_code" || !/^04\d{3}$/.test(plz ?? "")) continue;
    const rings = buildRings(e.members);
    if (rings.length === 0) continue;
    const c = centroid(rings);
    // Keep only areas lying mainly in the city: the centroid has to be inside the city boundary.
    if (!inside([c.lon, c.lat], cityRings)) {
      console.warn(`skipping ${plz}: centroid outside Leipzig`);
      continue;
    }
    entries.push([plz, { lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5) }]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));

  const out = {
    source: "© OpenStreetMap contributors, ODbL",
    license: "https://www.openstreetmap.org/copyright",
    generatedBy: "scripts/plz-centroids/build.mjs",
    generatedAt: new Date().toISOString().slice(0, 10),
    centroids: Object.fromEntries(entries),
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${entries.length} PLZ centroids`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
