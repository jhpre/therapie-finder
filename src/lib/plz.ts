import centroids from "../data/plz-centroids.json";
import type { LatLon } from "./distance";

const known = centroids.centroids as Record<string, LatLon>;

export type PlzResult = { ok: true; plz: string; centroid: LatLon } | { ok: false; error: string };

/** Validates user input against the list of known Leipzig postcodes. */
export function validatePlz(input: string): PlzResult {
  const plz = input.trim();
  if (plz === "") return { ok: false, error: "Bitte geben Sie eine Postleitzahl ein." };
  if (!/^\d{5}$/.test(plz)) {
    return { ok: false, error: "Eine Postleitzahl besteht aus genau 5 Ziffern." };
  }
  if (!Object.hasOwn(known, plz)) {
    return { ok: false, error: "Diese Postleitzahl gehört nicht zu Leipzig." };
  }
  return { ok: true, plz, centroid: known[plz] };
}
