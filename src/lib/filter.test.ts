import type { Practice } from "../data/types";
import {
  DEFAULT_FILTERS,
  availableLanguages,
  countActiveFilters,
  describeFilters,
  filterPractices,
  isFilterActive,
  type Filters,
} from "./filter";
import type { PracticeWithDistance } from "./sort";

const make = (id: string, over: Partial<Practice>, distanceKm: number): PracticeWithDistance => ({
  practice: {
    id,
    name: id,
    role: "",
    street: "",
    zip: "04109",
    district: "",
    phones: [],
    methods: ["VT"],
    group: false,
    video: false,
    accessible: false,
    languages: [],
    childrenToo: false,
    phoneHours: [],
    inactiveHere: false,
    partners: [],
    location: { lat: 0, lon: 0 },
    ...over,
  },
  distanceKm,
});

const items = [
  make("a", { methods: ["VT"], video: true }, 1),
  make("b", { methods: ["TP", "AP"], accessible: true, languages: ["Englisch"] }, 2.5),
  make("c", { methods: ["ST"], group: true, languages: ["Englisch", "Arabisch"] }, 4),
  make("d", { methods: ["VT", "ST"], video: true, group: true }, 8),
];
const ids = (f: Partial<Filters>) =>
  filterPractices(items, { ...DEFAULT_FILTERS, ...f }).map((i) => i.practice.id);

describe("filterPractices", () => {
  it("returns everything by default", () => {
    expect(ids({})).toEqual(["a", "b", "c", "d"]);
    expect(isFilterActive(DEFAULT_FILTERS)).toBe(false);
  });
  it("matches at least one selected method", () => {
    expect(ids({ methods: ["TP"] })).toEqual(["b"]);
    expect(ids({ methods: ["TP", "ST"] })).toEqual(["b", "c", "d"]);
  });
  it("limits the distance inclusively", () => {
    expect(ids({ maxDistanceKm: 2 })).toEqual(["a"]);
    expect(ids({ maxDistanceKm: 4 })).toEqual(["a", "b", "c"]);
    expect(ids({ maxDistanceKm: 10 })).toEqual(["a", "b", "c", "d"]);
  });
  it("compares the distance as displayed (one decimal)", () => {
    const near = [make("e", {}, 2.04), make("f", {}, 2.06)];
    const got = filterPractices(near, { ...DEFAULT_FILTERS, maxDistanceKm: 2 });
    expect(got.map((i) => i.practice.id)).toEqual(["e"]);
  });
  it("filters video", () => expect(ids({ video: true })).toEqual(["a", "d"]));
  it("filters accessibility", () => expect(ids({ accessible: true })).toEqual(["b"]));
  it("filters group therapy", () => expect(ids({ group: true })).toEqual(["c", "d"]));
  it("filters language", () => {
    expect(ids({ language: "Englisch" })).toEqual(["b", "c"]);
    expect(ids({ language: "Arabisch" })).toEqual(["c"]);
  });
  it("combines filters with AND", () => {
    expect(ids({ group: true, video: true })).toEqual(["d"]);
    expect(ids({ methods: ["ST"], maxDistanceKm: 5 })).toEqual(["c"]);
    expect(ids({ language: "Englisch", video: true })).toEqual([]);
  });
  it("reports active filters", () => {
    expect(isFilterActive({ ...DEFAULT_FILTERS, maxDistanceKm: 3 })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_FILTERS, language: "Englisch" })).toBe(true);
  });
});

describe("availableLanguages", () => {
  it("lists distinct languages sorted", () => {
    expect(availableLanguages(items.map((i) => i.practice))).toEqual(["Arabisch", "Englisch"]);
  });
});

describe("describeFilters", () => {
  it("is empty without filters", () => {
    expect(describeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("lists the active filters in a fixed order", () => {
    expect(
      describeFilters({
        methods: ["VT", "TP"],
        maxDistanceKm: 5,
        video: true,
        accessible: true,
        group: true,
        language: "Englisch",
      }),
    ).toBe("VT/TP, bis 5 km, Englisch, Video, stufenlos/Aufzug, Gruppe");
  });
});

describe("countActiveFilters", () => {
  it("counts each active filter once", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...DEFAULT_FILTERS,
        methods: ["VT", "TP"],
        video: true,
        language: "EN",
      }),
    ).toBe(3);
  });
});
