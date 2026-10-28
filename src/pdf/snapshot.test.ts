// @vitest-environment node
/// <reference types="node" />
import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";
import centroids from "../data/plz-centroids.sample.json";
import rawData from "../data/sample-practices.json";
import type { PracticeData } from "../data/types";
import { DEFAULT_FILTERS } from "../lib/filter";
import { sortByDistance } from "../lib/sort";
import { generatePdf } from "./generate";

// Regression snapshot of the PDF text for the sample data and PLZ 04318 (page by page, with the
// page count). The output is deterministic: the date shown in the PDF is `data.asOf` (fixed in the
// sample data), and the text contains no random ids or "today" date.
//
// To change the snapshot on purpose, run `npx vitest run -u src/pdf/snapshot.test.ts` and commit
// the updated `__snapshots__/04318.txt`. The PR description must say why the PDF changed.

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

const data = rawData as PracticeData;
const centroid = (centroids.centroids as Record<string, { lat: number; lon: number }>)["04318"];

it("PDF text for PLZ 04318 matches the committed snapshot", async () => {
  const blob = await generatePdf({
    data,
    plz: "04318",
    practices: sortByDistance(data.practices, centroid),
    filters: DEFAULT_FILTERS,
  });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const out = [`Seiten: ${doc.numPages}`];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    out.push(`=== Seite ${i} / ${doc.numPages} ===`, text.replace(/[ \t]+\n/g, "\n").trim());
  }
  await expect(out.join("\n") + "\n").toMatchFileSnapshot("__snapshots__/04318.txt");
});
