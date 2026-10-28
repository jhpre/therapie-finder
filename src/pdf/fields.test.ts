// @vitest-environment node
/// <reference types="node" />
import { createRequire } from "node:module";
import { PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFTextField } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import rawData from "../data/sample-practices.json";
import centroids from "../data/plz-centroids.json";
import type { PracticeData } from "../data/types";
import { DEFAULT_FILTERS } from "../lib/filter";
import { sortByDistance } from "../lib/sort";
import { generatePdf } from "./generate";

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
let seconds: number;

beforeAll(async () => {
  const start = performance.now();
  const blob = await generatePdf({ data, plz: "04318", practices, filters: DEFAULT_FILTERS });
  seconds = (performance.now() - start) / 1000;
  bytes = new Uint8Array(await blob.arrayBuffer());
  if (process.env.DUMP_PDF) (await import("node:fs")).writeFileSync(process.env.DUMP_PDF, bytes);
}, 30_000);

const pad = (n: number) => String(n).padStart(2, "0");

const ROW_TEXT = [
  "tel1.datum",
  "tel1.zeit",
  "tel1.mit",
  "tel2.datum",
  "tel2.zeit",
  "tel2.mit",
  "mail.datum",
  "mail.datum2",
  "wartezeit",
  "notizen",
];
const ROW_CHECK = [
  "tel1.kontaktiert",
  "mail.kontaktiert",
  "ergebnis.absage",
  "ergebnis.warteliste",
  "ergebnis.erstgespraech",
  "ergebnis.keine-antwort",
];
const LOG_TEXT = ["datum", "praxis", "wartezeit", "bemerkung"];
const LOG_CHECK = [
  "weg.telefon",
  "weg.ab",
  "weg.mail",
  "weg.persoenlich",
  "ergebnis.absage",
  "ergebnis.warteliste",
  "ergebnis.keine-antwort",
  "ergebnis.termin",
];

describe("fillable PDF", () => {
  it("generates the sample data in under 5 s", () => {
    expect(seconds).toBeLessThan(5);
  });

  it("has unique, readable field names for every fill-in area", async () => {
    const form = (await PDFDocument.load(bytes)).getForm();
    const names = form.getFields().map((f) => f.getName());
    expect(new Set(names).size).toBe(names.length);

    const expected: string[] = [];
    practices.forEach((_, i) => {
      for (const f of [...ROW_TEXT, ...ROW_CHECK]) expected.push(`praxis-${pad(i + 1)}.${f}`);
    });
    for (let i = 1; i <= 12; i++) {
      for (const f of [...LOG_TEXT, ...LOG_CHECK]) expected.push(`kontakt-${pad(i)}.${f}`);
    }
    for (const f of ["name", "geburtsdatum", "krankenkasse", "versichertennummer", "blatt"]) {
      expected.push(`kontakt-kopf.${f}`);
    }
    expected.push("kontakt-fuss.ort-datum");
    for (let i = 1; i <= 6; i++) expected.push(`seite2.wichtig.${i}`);
    for (let i = 1; i <= 5; i++) expected.push(`seite2.unterlagen.${i}`);
    expected.push("seite2.unterlagen.weitere", "seite2.unterlagen.weitere-text");

    const page2 = names.filter((n) => n.startsWith("seite2."));
    expect(page2).toEqual(
      expect.arrayContaining([
        ...expected.filter((n) => n.startsWith("seite2.")),
        "seite2.kasse.name",
        "seite2.kasse.notizen",
        "seite2.kasse.antragsformular.ja",
        "seite2.kasse.einreichen.online",
        "seite2.eckdaten.privatpraxis",
        "seite2.eckdaten.empfehlung.zeitnah",
      ]),
    );
    expect(names.filter((n) => !n.startsWith("seite2.")).sort()).toEqual(
      expected.filter((n) => !n.startsWith("seite2.")).sort(),
    );
  });

  it("has no signature field and starts every field empty and unchecked", async () => {
    const form = (await PDFDocument.load(bytes)).getForm();
    const fields = form.getFields();
    expect(fields.some((f) => f.getName().includes("unterschrift"))).toBe(false);
    for (const f of fields) {
      if (f instanceof PDFTextField) expect(f.getText() ?? "", f.getName()).toBe("");
      else if (f instanceof PDFCheckBox) expect(f.isChecked(), f.getName()).toBe(false);
      else throw new Error(`unexpected field type: ${f.getName()}`);
    }
  });

  it("keeps text (with umlauts) and checkmarks after saving and reloading", async () => {
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    form.getTextField("seite2.kasse.name").setText("Müller, Jörg");
    form.getTextField("praxis-02.notizen").setText("Straße ä ö ü ß\nzweite Zeile");
    form.getCheckBox("kontakt-03.ergebnis.absage").check();
    const saved = await doc.save();

    const form2 = (await PDFDocument.load(saved)).getForm();
    expect(form2.getTextField("seite2.kasse.name").getText()).toBe("Müller, Jörg");
    expect(form2.getTextField("praxis-02.notizen").getText()).toBe("Straße ä ö ü ß\nzweite Zeile");
    expect(form2.getCheckBox("kontakt-03.ergebnis.absage").isChecked()).toBe(true);
    expect(form2.getCheckBox("kontakt-04.ergebnis.absage").isChecked()).toBe(false);
  });

  it("makes the practice notes field multi-line", async () => {
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getTextField("praxis-01.notizen").isMultiline()).toBe(true);
    expect(form.getTextField("seite2.kasse.name").isMultiline()).toBe(false);
  });

  it("sets an explicit font size on every text field", async () => {
    const form = (await PDFDocument.load(bytes)).getForm();
    const multiline = [
      "praxis-01.notizen",
      "seite2.kasse.notizen",
      "kontakt-01.praxis",
      "kontakt-01.wartezeit",
      "kontakt-01.bemerkung",
    ];
    for (const f of form.getFields()) {
      if (!(f instanceof PDFTextField)) continue;
      const da = String(f.acroField.getDefaultAppearance());
      const size = Number(/(\S+) Tf/.exec(da)?.[1]);
      expect(size, f.getName()).toBe(8);
    }
    for (const n of multiline) expect(form.getTextField(n).isMultiline(), n).toBe(true);
  });

  it("has every font named in a field's /DA in the AcroForm /DR", async () => {
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    const dr = form.acroForm.dict.lookup(PDFName.of("DR"), PDFDict);
    const fonts = dr.lookup(PDFName.of("Font"), PDFDict);
    const das = [String(form.acroForm.dict.get(PDFName.of("DA")))];
    for (const f of form.getFields()) {
      if (f instanceof PDFTextField) das.push(String(f.acroField.getDefaultAppearance()));
    }
    for (const da of das) {
      const name = /\/(\S+) \d/.exec(da)?.[1];
      expect(name, da).toBeDefined();
      expect(fonts.has(PDFName.of(name!)), da).toBe(true);
    }
  });

  it("gives every field a visible size", async () => {
    const form = (await PDFDocument.load(bytes)).getForm();
    for (const f of form.getFields()) {
      const r = f.acroField.getWidgets()[0].getRectangle();
      expect(r.width, f.getName()).toBeGreaterThan(4);
      expect(r.height, f.getName()).toBeGreaterThan(4);
    }
  });
});
