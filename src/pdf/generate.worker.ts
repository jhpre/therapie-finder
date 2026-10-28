import { renderPdf } from "./render";
import type { WorkerRequest, WorkerResponse } from "./generate";

/** Renders the PDF off the main thread; the page sends the input and the absolute font URLs. */
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  let response: WorkerResponse;
  let transfer: ArrayBuffer[] = [];
  try {
    const blob = await renderPdf(e.data.input, e.data.fonts);
    const bytes = await blob.arrayBuffer();
    response = { ok: true, bytes };
    transfer = [bytes];
  } catch (err) {
    response = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(response, { transfer });
};
