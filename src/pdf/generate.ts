import type { PdfInput } from "./document";
import type { FontSources } from "./render";

export const pdfFileName = (plz: string) => `psychotherapie-leipzig-${plz}.pdf`;

/** Messages between the page and the PDF worker. */
export interface WorkerRequest {
  input: PdfInput;
  fonts: FontSources;
}
export type WorkerResponse = { ok: true; bytes: ArrayBuffer } | { ok: false; error: string };

/** Renders in this thread. The PDF library and fonts are loaded on demand (dynamic import). */
async function generateInThread(input: PdfInput): Promise<Blob> {
  const [{ renderPdf }, { fontSources }] = await Promise.all([
    import("./render"),
    import("./fonts"),
  ]);
  return renderPdf(input, fontSources);
}

/** Renders in a module Web Worker so a 300+ entry list does not freeze the page. */
function generateInWorker(input: PdfInput, fonts: FontSources): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./generate.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (e.data.ok) resolve(new Blob([e.data.bytes], { type: "application/pdf" }));
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "PDF worker failed"));
    };
    const request: WorkerRequest = { input, fonts };
    worker.postMessage(request);
  });
}

/**
 * Creates the PDF. In the browser the work runs in a Web Worker (fonts are passed as absolute URLs
 * of our own files); without Worker support, or if the worker fails to start, it runs in-thread.
 */
export async function generatePdf(input: PdfInput): Promise<Blob> {
  if (typeof Worker === "undefined") return generateInThread(input);
  try {
    const { fontSources } = await import("./fonts");
    const abs = (u: string) => new URL(u, document.baseURI).href;
    const fonts = {
      regular: abs(fontSources.regular),
      bold: abs(fontSources.bold),
      italic: abs(fontSources.italic),
    };
    return await generateInWorker(input, fonts);
  } catch {
    return generateInThread(input);
  }
}

export { pdfTitle } from "./meta";

/** Triggers the browser download of `blob` under `fileName`. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
