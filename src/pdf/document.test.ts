// @vitest-environment node
/// <reference types="node" />
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import rawData from "../data/sample-practices.json";
import centroids from "../data/plz-centroids.json";
import type { PracticeData } from "../data/types";
import { DEFAULT_FILTERS, filterPractices } from "../lib/filter";
import { formatDate, formatKm, sortByDistance } from "../lib/sort";
import { generatePdf, pdfFileName } from "./generate";

const require = createRequire(import.meta.url);
const ttf = (name: string) => require.resolve(`dejavu-fonts-ttf/ttf/${name}.ttf`);

// Vite's ?url import yields a browser URL; the node renderer needs file paths.
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
const all = sortByDistance(data.practices, centroid);

async function pdfText(input: Parameters<typeof generatePdf>[0]): Promise<string[]> {
  const blob = await generatePdf(input);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages;
}

const norm = (s: string) => s.replace(/\s+/g, " ");

// Practice table pages: everything between the two intro pages and the contact log.
const tablePages = (pages: string[]) => pages.slice(2, -1);
const rowText = (pages: string[]) => norm(tablePages(pages).join(" "));

describe("PDF practice table", () => {
  it("lists every practice name in list order with its number and distance", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const text = rowText(pages);
    let last = -1;
    for (const { practice } of all) {
      const at = text.indexOf(practice.name, last + 1);
      expect(at, practice.name).toBeGreaterThan(last);
      last = at;
    }
    expect(text).toContain(formatKm(all[0].distanceKm));
  });

  it("repeats the header on every table page and renders the symbols", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    for (const page of tablePages(pages)) {
      expect(norm(page)).toContain("Telefonzeiten (laut KV)");
    }
    const text = rowText(pages);
    for (const sym of ["☐", "☎", "✉"]) expect(text).toContain(sym);
  });

  it("marks missing phone hours as not on file", async () => {
    const bare = { ...all[0], practice: { ...all[0].practice, phoneHours: [] } };
    const pages = await pdfText({
      data,
      plz: "04318",
      practices: [bare],
      filters: DEFAULT_FILTERS,
    });
    expect(rowText(pages)).toContain("nicht hinterlegt");
  });

  it("shows absence and inactive-location notes", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const text = rowText(pages);
    const absent = all.find((p) => p.practice.absent)!.practice.absent!;
    expect(text).toContain(
      `Laut KV abwesend von ${formatDate(absent.from)} bis ${formatDate(absent.to)}`,
    );
    expect(text).toContain("Laut KV derzeit nicht an diesem Standort tätig");
  });

  it("shows the email source, or a blank line without email", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const text = rowText(pages);
    expect(text).toContain("(Quelle: beispiel-website.invalid)");
    expect(text).toContain("✉ ______");
    const noMail = all.find((p) => !p.practice.email);
    expect(noMail).toBeDefined();
    const one = await pdfText({
      data,
      plz: "04318",
      practices: [noMail!],
      filters: DEFAULT_FILTERS,
    });
    expect(rowText(one)).toContain("✉ ______");
    const withMail = all.find((p) => p.practice.email)!;
    const other = await pdfText({
      data,
      plz: "04318",
      practices: [withMail],
      filters: DEFAULT_FILTERS,
    });
    expect(rowText(other)).not.toContain("✉ ______");
  });

  it("writes the result options out in full", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const text = rowText(pages);
    for (const w of [
      "Absage",
      "Warteliste",
      "Erstgespräch",
      "keine Antwort",
      "Wartezeit / Termin:",
    ])
      expect(text).toContain(w);
  });

  it("prints only the filtered practices", async () => {
    const filters = { ...DEFAULT_FILTERS, methods: ["VT" as const] };
    const list = filterPractices(all, filters);
    const pages = await pdfText({ data, plz: "04318", practices: list, filters });
    const text = rowText(pages);
    for (const { practice } of all) {
      if (practice.methods.includes("VT")) expect(text).toContain(practice.name);
      else expect(text).not.toContain(practice.name);
    }
  });
});

describe("PDF page 2", () => {
  it("keeps the note box on page 2 and the practice table on page 3", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    expect(norm(pages[1])).toContain("keine Rechtsberatung");
    expect(norm(pages[1])).not.toContain("Ergebnis / Wartezeit");
    expect(norm(pages[2])).toContain("Ergebnis / Wartezeit");
  });

  it("is the reimbursement page, before the practice table", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const p2 = norm(pages[1]);
    for (const t of [
      "Kostenerstattung vorbereiten",
      "§ 13 Abs. 3 SGB V",
      "keine Rechtsberatung",
      "Grundsätzlich wichtig",
      "Unterlagen, die häufig verlangt werden",
      "Vorgaben meiner Krankenkasse",
      "Meine Eckdaten",
      `Seite 2 / ${pages.length}`,
    ])
      expect(p2).toContain(t);
    expect(p2).not.toContain("Praxis · Adresse · Kontakt");
    expect(norm(pages[2])).toContain("Praxis · Adresse · Kontakt");
  });

  it("is included even without practices", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: [], filters: DEFAULT_FILTERS });
    expect(pages).toHaveLength(3);
    expect(norm(pages[1])).toContain("Kostenerstattung vorbereiten");
  });
});

describe("PDF contact log page", () => {
  it("is the last page with title, fields, headings, numbers 1-12 and signature lines", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const last = norm(pages[pages.length - 1]);
    for (const t of [
      "Kontaktprotokoll Therapieplatzsuche",
      "Blatt",
      "– bei Bedarf mehrfach ausdrucken",
      "Name, Vorname",
      "Geburtsdatum",
      "Krankenkasse",
      "Versichertennummer",
      "Nr.",
      "Datum, Uhrzeit",
      "Praxis / Therapeut:in (Name, Adresse, Telefon)",
      "Kontaktweg",
      "Ergebnis",
      "Wartezeit / angebotener Termin",
      "Gesprächsperson / Bemerkung",
      "☐ Telefon",
      "☐ AB",
      "☐ Mail",
      "☐ persönlich",
      "☐ Absage",
      "☐ Warteliste",
      "☐ keine Antwort",
      "☐ Termin",
      "Ort, Datum",
      "Unterschrift – ich versichere die Richtigkeit der Angaben",
      `Seite ${pages.length} / ${pages.length}`,
    ])
      expect(last, t).toContain(t);
    for (let n = 1; n <= 12; n++) expect(last).toMatch(new RegExp(`(^| )${n}( |$)`));
    expect(last).not.toContain("Praxis · Adresse · Kontakt");
  });

  it("does not prefill rows from the practice list", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const last = norm(pages[pages.length - 1]);
    for (const { practice } of all) expect(last).not.toContain(practice.name);
  });
});

describe("PDF page 1", () => {
  it("hints that the PDF can be filled in on screen", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    expect(norm(pages[0])).toContain(
      "Tipp: Dieses PDF lässt sich auch am Computer oder Tablet ausfüllen und speichern.",
    );
  });

  it("contains title, counts, method headings, mail subject and crisis numbers", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const text = norm(pages.join(" "));
    expect(text).toContain("Psychotherapie-Praxen für gesetzlich Versicherte in Leipzig");
    expect(text).toContain(`${all.length} Psychotherapeut:innen mit Kassenzulassung`);
    expect(text).toContain("Empfohlenes Vorgehen");
    expect(text).toContain("Fragen fürs Telefonat");
    const headings = [
      ["VT", "Verhaltenstherapie"],
      ["TP", "Tiefenpsychologisch fundiert"],
      ["AP", "Analytische Psychotherapie"],
      ["ST", "Systemische Therapie"],
    ] as const;
    for (const [method, heading] of headings) {
      const n = all.filter((p) => p.practice.methods.includes(method)).length;
      expect(text).toContain(`${heading} (${n}):`);
    }
    expect(text).toContain("Betreff: Anfrage Erstgespräch / Therapieplatz");
    for (const n of ["112", "116117", "0800 111 0 111", "0800 111 0 222"]) {
      expect(text).toContain(n);
    }
    expect(text).not.toContain("Filter:");
  });

  it("has the footer with source, date, PLZ and page numbers", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    const text = norm(pages[0]);
    expect(text).toContain(`Quelle: ${data.source}`);
    expect(text).toContain(`Stand ${formatDate(data.asOf)}`);
    expect(text).toContain("Entfernung = Luftlinie ab Mittelpunkt PLZ 04318");
    expect(text).toContain(`Seite 1 / ${pages.length}`);
  });

  it("keeps page 1 free of practice rows", async () => {
    const pages = await pdfText({ data, plz: "04318", practices: all, filters: DEFAULT_FILTERS });
    expect(pages.length).toBeGreaterThan(2);
    expect(pages[0]).not.toContain("Praxis · Adresse · Kontakt");
  });

  it("uses the filtered list and names the active filters", async () => {
    const filters = { ...DEFAULT_FILTERS, methods: ["VT" as const], maxDistanceKm: 5, video: true };
    const list = filterPractices(all, filters);
    const pages = await pdfText({ data, plz: "04318", practices: list, filters });
    const text = norm(pages[0]);
    expect(text).toContain("Filter: VT, bis 5 km, Video");
    expect(text).toContain(`${list.length} Psychotherapeut:innen mit Kassenzulassung`);
  });

  it("names the file after the PLZ", () => {
    expect(pdfFileName("04318")).toBe("psychotherapie-leipzig-04318.pdf");
  });
});
