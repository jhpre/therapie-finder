// @vitest-environment node
/// <reference types="node" />
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import centroids from "../data/plz-centroids.json";
import type { PracticeData } from "../data/types";
import { DEFAULT_FILTERS } from "../lib/filter";
import { sortByDistance } from "../lib/sort";
import { generatePdf } from "./generate";
import { generatePractices } from "./large-list.testutil";

const require = createRequire(import.meta.url);
const ttf = (name: string) => require.resolve(`dejavu-fonts-ttf/ttf/${name}.ttf`);

vi.mock("./fonts", () => ({
  PDF_FONT: "DejaVu Sans",
  fontSources: {
    regular: ttf("DejaVuSans"),
    bold: ttf("DejaVuSans-Bold"),
    italic: ttf("DejaVuSans-Oblique"),
  },
}));

const N = 350;
const data: PracticeData = {
  source: "FICTIONAL TEST DATA",
  asOf: "2026-10-25",
  practices: generatePractices(N),
};
const centroid = (centroids.centroids as Record<string, { lat: number; lon: number }>)["04109"];
const sorted = sortByDistance(data.practices, centroid);
const norm = (s: string) => s.replace(/\s+/g, " ");

describe("large list generator", () => {
  it("is deterministic and covers the mixed cases", () => {
    expect(generatePractices(N)).toEqual(generatePractices(N));
    expect(generatePractices(N, 1)).not.toEqual(generatePractices(N));
    const list = data.practices;
    expect(list).toHaveLength(N);
    expect(new Set(list.map((p) => p.name)).size).toBe(N);
    expect(list.some((p) => p.phones.length === 3)).toBe(true);
    expect(list.some((p) => p.phoneHours.length === 6)).toBe(true);
    expect(list.some((p) => !p.email)).toBe(true);
    expect(list.some((p) => p.absent)).toBe(true);
    expect(list.every((p) => Math.abs(p.location.lat - 51.34) < 0.1)).toBe(true);
  });
});

describe("PDF with 350 entries", () => {
  it("stays correct and fast", { timeout: 60_000 }, async () => {
    const start = performance.now();
    const blob = await generatePdf({
      data,
      plz: "04109",
      practices: sorted,
      filters: DEFAULT_FILTERS,
    });
    const seconds = (performance.now() - start) / 1000;

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(norm(content.items.map((it) => ("str" in it ? it.str : "")).join(" ")));
    }
    process.stderr.write(`350-entry PDF: ${seconds.toFixed(1)} s, ${pages.length} pages\n`);
    expect(seconds).toBeLessThan(20);

    // Footer: consecutive page numbers, correct total.
    pages.forEach((text, i) => expect(text).toContain(`Seite ${i + 1} / ${pages.length}`));

    // Page 2 and the contact log are in place.
    expect(pages[1]).toContain("Kostenerstattung vorbereiten");
    expect(pages.at(-1)).toContain("Kontaktprotokoll Therapieplatzsuche");

    // Table pages: header on each, rows never split.
    const table = pages.slice(2, -1);
    expect(table.length).toBeGreaterThan(10);
    for (const text of table) {
      expect(text).toContain("Praxis · Adresse · Kontakt");
      expect(text).toContain("Telefonzeiten (laut KV)");
      // A row starts with its name and ends with the result cell; both must be on the same page.
      const names = sorted.filter(({ practice }) => text.includes(practice.name)).length;
      const ends = text.split("Wartezeit / Termin:").length - 1;
      expect(ends).toBe(names);
    }
    for (const text of [pages[0], pages[1], pages.at(-1)!]) {
      expect(text).not.toContain("Praxis · Adresse · Kontakt");
    }

    // Every name exactly once, in distance order.
    const all = table.join(" ");
    let last = -1;
    for (const { practice } of sorted) {
      const at = all.indexOf(practice.name);
      expect(at, practice.name).toBeGreaterThan(last);
      expect(all.indexOf(practice.name, at + 1), practice.name).toBe(-1);
      last = at;
    }
    expect(pages.at(-1)).not.toContain(sorted[0].practice.name);
  });
});
