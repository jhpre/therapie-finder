// @vitest-environment node
/// <reference types="node" />
import { createRequire } from "node:module";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFTextField,
  decodePDFRawStream,
} from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import rawData from "../data/sample-practices.json";
import centroids from "../data/plz-centroids.json";
import type { PracticeData } from "../data/types";
import { DEFAULT_FILTERS } from "../lib/filter";
import { sortByDistance } from "../lib/sort";
import { generatePdf, pdfTitle } from "./generate";

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

const data = rawData as unknown as PracticeData;
const centroid = (centroids.centroids as Record<string, { lat: number; lon: number }>)["04318"];
const practices = sortByDistance(data.practices, centroid);

let bytes: Uint8Array;

beforeAll(async () => {
  const blob = await generatePdf({ data, plz: "04318", practices, filters: DEFAULT_FILTERS });
  bytes = new Uint8Array(await blob.arrayBuffer());
}, 30_000);

describe("PDF metadata", () => {
  it("has the title with the PLZ, no author and a neutral creator/producer", async () => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getTitle()).toBe("Psychotherapie-Praxen Leipzig – PLZ 04318");
    expect(doc.getTitle()).toBe(pdfTitle("04318"));
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getSubject()).toBeUndefined();
    expect(doc.getKeywords()).toBeUndefined();
    expect(doc.getCreator()).toBe("Therapie-Finder");
    expect(doc.getProducer()).toBe("Therapie-Finder");
  });

  it("limits the creation and modification date to the day", async () => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    for (const d of [doc.getCreationDate(), doc.getModificationDate()]) {
      expect(d).toBeDefined();
      expect(d!.getUTCHours()).toBe(0);
      expect(d!.getUTCMinutes()).toBe(0);
      expect(d!.getUTCSeconds()).toBe(0);
      expect(Math.abs(Date.now() - d!.getTime())).toBeLessThan(2 * 24 * 3600 * 1000);
    }
  });

  it("has no XMP metadata stream", async () => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.catalog.has(PDFName.of("Metadata"))).toBe(false);
  });
});

describe("PDF contents", () => {
  it("has no JavaScript, embedded files, actions on open or launch/URI actions", async () => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const forbidden = ["JS", "JavaScript", "EmbeddedFiles", "EmbeddedFile", "OpenAction", "AA"];
    for (const key of ["OpenAction", "AA"]) {
      expect(doc.catalog.has(PDFName.of(key)), `catalog /${key}`).toBe(false);
    }
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      const dict =
        obj instanceof PDFRawStream ? obj.dict : obj instanceof PDFDict ? obj : undefined;
      if (!dict) continue;
      for (const key of forbidden) expect(dict.has(PDFName.of(key)), `/${key}`).toBe(false);
      expect(dict.get(PDFName.of("Type"))).not.toBe(PDFName.of("EmbeddedFile"));
      expect(dict.get(PDFName.of("Type"))).not.toBe(PDFName.of("Filespec"));
      const s = dict.get(PDFName.of("S"));
      for (const action of ["JavaScript", "Launch", "URI", "SubmitForm", "ImportData"]) {
        expect(s, `action ${action}`).not.toBe(PDFName.of(action));
      }
    }
  });

  it("has no invisible text (render mode 3) in any page content", async () => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    let streams = 0;
    for (const page of doc.getPages()) {
      const contents = page.node.Contents();
      const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
      for (const ref of refs) {
        const stream = ref && doc.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) continue;
        streams++;
        const text = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
        expect(text).not.toMatch(/\b3\s+Tr\b/);
      }
    }
    expect(streams).toBeGreaterThan(0);
  });

  it("contains no @-address other than practice emails from the data", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      parts.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    const allowed = new Set(
      data.practices.map((p) => p.email).filter((e): e is string => Boolean(e)),
    );
    const found = parts.join(" ").match(/[^\s@]+@[^\s@]+/g) ?? [];
    expect(found.length).toBeGreaterThan(0);
    for (const addr of found) expect(allowed.has(addr), addr).toBe(true);
  });

  it("leaves the Versichertennummer field and all other text fields empty", async () => {
    const form = (await PDFDocument.load(bytes, { updateMetadata: false })).getForm();
    expect(form.getTextField("kontakt-kopf.versichertennummer").getText() ?? "").toBe("");
    for (const f of form.getFields()) {
      if (f instanceof PDFTextField) expect(f.getText() ?? "", f.getName()).toBe("");
    }
  });
});
