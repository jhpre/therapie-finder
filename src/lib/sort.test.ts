import data from "../data/sample-practices.json";
import centroids from "../data/plz-centroids.json";
import type { PracticeData, Practice } from "../data/types";
import { formatDate, formatKm, sortByDistance, summarize } from "./sort";

const practices = (data as PracticeData).practices;
const origin = centroids.centroids["04318"];

describe("sortByDistance", () => {
  it("sorts the sample data ascending and keeps every practice", () => {
    const sorted = sortByDistance(practices, origin);
    expect(sorted).toHaveLength(practices.length);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].distanceKm).toBeGreaterThanOrEqual(sorted[i - 1].distanceKm);
    }
  });

  it("sorts equal distances by name", () => {
    const base = practices[0];
    const mk = (id: string, name: string): Practice => ({ ...base, id, name });
    const sorted = sortByDistance([mk("b", "Zeta"), mk("a", "Alpha")], origin);
    expect(sorted.map((s) => s.practice.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("does not mutate the input", () => {
    const copy = [...practices];
    sortByDistance(practices, origin);
    expect(practices).toEqual(copy);
  });
});

describe("summarize", () => {
  it("counts cumulatively for 04318 in the sample data", () => {
    expect(summarize(sortByDistance(practices, origin))).toEqual({
      total: 12,
      within2: 2,
      within3: 4,
      within5: 11,
    });
  });

  it("includes a practice at exactly the boundary", () => {
    const at = (km: number) => ({ practice: practices[0], distanceKm: km });
    expect(summarize([at(2), at(3), at(5), at(5.01)])).toEqual({
      total: 4,
      within2: 1,
      within3: 2,
      within5: 3,
    });
  });
});

describe("formatting", () => {
  it("formats km with a decimal comma", () => {
    expect(formatKm(0.64)).toBe("0,6 km");
    expect(formatKm(12)).toBe("12,0 km");
  });
  it("formats ISO dates", () => {
    expect(formatDate("2026-10-05")).toBe("05.10.2026");
  });
});
