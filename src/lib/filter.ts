import type { Method, Practice } from "../data/types";
import type { PracticeWithDistance } from "./sort";

export const MAX_DISTANCES = [2, 3, 5, 10] as const;

export interface Filters {
  methods: Method[]; // empty = off; otherwise a practice needs at least one of them
  maxDistanceKm: number | null; // null = off
  video: boolean;
  accessible: boolean;
  group: boolean;
  language: string; // "" = off
}

export const DEFAULT_FILTERS: Filters = {
  methods: [],
  maxDistanceKm: null,
  video: false,
  accessible: false,
  group: false,
  language: "",
};

export function isFilterActive(f: Filters): boolean {
  return (
    f.methods.length > 0 ||
    f.maxDistanceKm !== null ||
    f.video ||
    f.accessible ||
    f.group ||
    f.language !== ""
  );
}

/** The list shows distances with one decimal; filter on what the user sees. */
const roundKm = (km: number) => Math.round(km * 10) / 10;

/** Keeps the entries matching all active filters; order is preserved. */
export function filterPractices(items: PracticeWithDistance[], f: Filters): PracticeWithDistance[] {
  return items.filter(({ practice: p, distanceKm }) => {
    if (f.methods.length > 0 && !p.methods.some((m) => f.methods.includes(m))) return false;
    if (f.maxDistanceKm !== null && roundKm(distanceKm) > f.maxDistanceKm) return false;
    if (f.video && !p.video) return false;
    if (f.accessible && !p.accessible) return false;
    if (f.group && !p.group) return false;
    if (f.language !== "" && !p.languages.includes(f.language)) return false;
    return true;
  });
}

/** Distinct languages present in the data, sorted for German locale. */
export function availableLanguages(practices: Practice[]): string[] {
  return [...new Set(practices.flatMap((p) => p.languages))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
}

/** Short German list of the active filters, e.g. `VT, bis 5 km, Video`; empty when none is active. */
export function describeFilters(f: Filters): string {
  return [
    f.methods.length > 0 && f.methods.join("/"),
    f.maxDistanceKm !== null && `bis ${f.maxDistanceKm} km`,
    f.language !== "" && f.language,
    f.video && "Video",
    f.accessible && "stufenlos/Aufzug",
    f.group && "Gruppe",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Number of active filter groups (the method checkboxes count as one). */
export function countActiveFilters(f: Filters): number {
  return [
    f.methods.length > 0,
    f.maxDistanceKm !== null,
    f.video,
    f.accessible,
    f.group,
    f.language !== "",
  ].filter(Boolean).length;
}
