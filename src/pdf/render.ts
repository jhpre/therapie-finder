import type { PDFDocument } from "pdf-lib";
import type { PdfInput } from "./document";
import { PDF_CREATOR, FIELD_FONT_SIZE, FIELD_FONT_SIZE_MULTILINE, pdfTitle } from "./meta";

export interface FontSources {
  regular: string;
  bold: string;
  italic: string;
}

/** Renders the PDF with the given font files (paths or URLs). */
export async function renderPdf(input: PdfInput, fontSources: FontSources): Promise<Blob> {
  const [{ pdf, Font }, { buildPdfDocument }, { PDF_FONT }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./document"),
    import("./fonts"),
  ]);
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: fontSources.regular, fontWeight: 400 },
      { src: fontSources.bold, fontWeight: 700 },
      { src: fontSources.italic, fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  const blob = await pdf(buildPdfDocument(input)).toBlob();
  return finalizePdf(blob, input.plz);
}

/**
 * Sets the document metadata: title with the PLZ, no author or other fields, and the creation
 * date cut to the day (UTC midnight).
 */
function applyMetadata(doc: PDFDocument, plz: string): void {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  doc.setTitle(pdfTitle(plz), { showInWindowTitleBar: true });
  doc.setCreator(PDF_CREATOR);
  doc.setProducer(PDF_CREATOR);
  doc.setCreationDate(day);
  doc.setModificationDate(day);
}

/**
 * react-pdf does not write a per-field default appearance, so viewers fall back to auto font size.
 * Sets an explicit size on every text field (and on the form default), and the document metadata.
 */
async function finalizePdf(blob: Blob, plz: string): Promise<Blob> {
  const { PDFDict, PDFDocument, PDFName, PDFString, PDFTextField, StandardFonts } =
    await import("pdf-lib");
  // updateMetadata: false keeps pdf-lib from adding its own producer and a timestamp.
  const doc = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false });
  const form = doc.getForm();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const da = (size: number) => PDFString.of(`/${helvetica.name} ${size} Tf 0 g`);
  form.acroForm.dict.set(PDFName.of("DA"), da(FIELD_FONT_SIZE));
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    field.acroField.dict.set(
      PDFName.of("DA"),
      da(field.isMultiline() ? FIELD_FONT_SIZE_MULTILINE : FIELD_FONT_SIZE),
    );
  }
  // pdf-lib names Helvetica in every field's /DA but does not add it to the AcroForm /DR font
  // resources, which strict viewers (Acrobat) warn about. Update the appearances with it now,
  // register it in /DR, and keep save() from regenerating them.
  form.updateFieldAppearances(helvetica);
  const resources = form.acroForm.dict.lookup(PDFName.of("DR"), PDFDict);
  resources.lookup(PDFName.of("Font"), PDFDict).set(PDFName.of(helvetica.name), helvetica.ref);
  applyMetadata(doc, plz);
  const bytes = await doc.save({ updateFieldAppearances: false });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
