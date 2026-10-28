import data from "../data/plz-centroids.json";
import sample from "../data/plz-centroids.sample.json";
import { distanceKm } from "./distance";
import { validatePlz } from "./plz";

describe("plz-centroids.json", () => {
  const entries = Object.entries(data.centroids);

  it("has Leipzig-sized content and names its source", () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
    expect(entries.length).toBeLessThanOrEqual(40);
    expect(data.source).toBe("© OpenStreetMap contributors, ODbL");
  });

  it("only has 5-digit PLZ starting with 04", () => {
    for (const [plz] of entries) expect(plz).toMatch(/^04\d{3}$/);
  });

  it("keeps every centroid inside the Leipzig bounding box", () => {
    for (const [, c] of entries) {
      expect(c.lat).toBeGreaterThan(51.23);
      expect(c.lat).toBeLessThan(51.45);
      expect(c.lon).toBeGreaterThan(12.23);
      expect(c.lon).toBeLessThan(12.55);
    }
  });

  it("puts 04318 within 500 m of the sample centroid", () => {
    const real = data.centroids["04318"];
    expect(distanceKm(real, sample.centroids["04318"])).toBeLessThan(0.5);
  });
});

describe("validatePlz", () => {
  it("accepts a PLZ that is not in the sample file", () => {
    expect(validatePlz("04229")).toMatchObject({ ok: true, plz: "04229" });
  });

  it("accepts a Leipzig PLZ and returns its centroid", () => {
    const r = validatePlz(" 04318 ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plz).toBe("04318");
  });

  it("rejects empty input", () => {
    expect(validatePlz("  ")).toMatchObject({ ok: false, error: /eingeben/ });
  });

  it("rejects malformed input", () => {
    for (const s of ["0431", "043189", "abcde", "0431a"]) {
      expect(validatePlz(s)).toMatchObject({ ok: false, error: /5 Ziffern/ });
    }
  });

  it("rejects non-Leipzig and prototype keys", () => {
    expect(validatePlz("01067")).toMatchObject({ ok: false, error: /nicht zu Leipzig/ });
    expect(validatePlz("constructor")).toMatchObject({ ok: false });
  });
});
