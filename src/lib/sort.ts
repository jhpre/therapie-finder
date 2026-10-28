import type { Practice } from "../data/types";
import { distanceKm, type LatLon } from "./distance";

export interface PracticeWithDistance {
  practice: Practice;
  distanceKm: number;
}

/** Attaches the distance to `origin` and sorts ascending; equal distances are sorted by name. */
export function sortByDistance(practices: Practice[], origin: LatLon): PracticeWithDistance[] {
  return practices
    .map((practice) => ({ practice, distanceKm: distanceKm(origin, practice.location) }))
    .sort(
      (a, b) => a.distanceKm - b.distanceKm || a.practice.name.localeCompare(b.practice.name, "de"),
    );
}

export interface DistanceSummary {
  total: number;
  within2: number;
  within3: number;
  within5: number;
}

/** Counts practices (cumulatively) within 2, 3 and 5 km. */
export function summarize(sorted: PracticeWithDistance[]): DistanceSummary {
  const within = (km: number) => sorted.filter((p) => p.distanceKm <= km).length;
  return { total: sorted.length, within2: within(2), within3: within(3), within5: within(5) };
}

/** `0,6 km` (German decimal comma, one decimal). */
export function formatKm(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/** ISO date `2026-10-25` -> `25.10.2026`. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
