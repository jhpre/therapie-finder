import { distanceKm } from "./distance";

describe("distanceKm", () => {
  it("matches an independently computed great-circle distance", () => {
    // Leipzig Hbf -> Völkerschlachtdenkmal; reference computed with Python (haversine, R=6371.0088)
    expect(distanceKm({ lat: 51.3455, lon: 12.3828 }, { lat: 51.3123, lon: 12.4132 })).toBeCloseTo(
      4.253,
      2,
    );
  });

  it("is zero for the same point and symmetric", () => {
    const a = { lat: 51.3393, lon: 12.4256 };
    const b = { lat: 51.329, lon: 12.372 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
    expect(distanceKm(a, b)).toBeCloseTo(3.896, 2);
  });
});
