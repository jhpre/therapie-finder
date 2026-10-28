import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS } from "../lib/filter";
import { generatePdf, type WorkerRequest, type WorkerResponse } from "./generate";

vi.mock("./fonts", () => ({
  PDF_FONT: "DejaVu Sans",
  fontSources: { regular: "fonts/r.ttf", bold: "fonts/b.ttf", italic: "fonts/i.ttf" },
}));
const renderPdf = vi.hoisted(() =>
  vi.fn(async () => new Blob(["in-thread"], { type: "application/pdf" })),
);
vi.mock("./render", () => ({ renderPdf }));

const input = {
  data: { source: "s", asOf: "2026-10-25", practices: [] },
  plz: "04109",
  practices: [],
  filters: DEFAULT_FILTERS,
};

afterEach(() => {
  vi.unstubAllGlobals();
  renderPdf.mockClear();
});

describe("generatePdf", () => {
  it("renders in a Web Worker, passing absolute font URLs", async () => {
    const posted: WorkerRequest[] = [];
    class FakeWorker {
      onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage(req: WorkerRequest) {
        posted.push(req);
        const bytes = new TextEncoder().encode("from-worker").buffer as ArrayBuffer;
        queueMicrotask(() => this.onmessage?.({ data: { ok: true, bytes } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", FakeWorker);
    const blob = await generatePdf(input);
    expect(await blob.text()).toBe("from-worker");
    expect(renderPdf).not.toHaveBeenCalled();
    expect(posted[0].input.plz).toBe("04109");
    expect(posted[0].fonts.regular).toMatch(/^https?:\/\/.*fonts\/r\.ttf$/);
  });

  it("falls back to the main thread when the worker fails", async () => {
    class BrokenWorker {
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onerror?.({ message: "boom" } as ErrorEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", BrokenWorker);
    const blob = await generatePdf(input);
    expect(await blob.text()).toBe("in-thread");
  });

  it("renders in-thread without Worker support", async () => {
    vi.stubGlobal("Worker", undefined);
    const blob = await generatePdf(input);
    expect(await blob.text()).toBe("in-thread");
  });
});
