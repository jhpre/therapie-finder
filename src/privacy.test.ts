/// <reference types="vite/client" />
const raw = (g: Record<string, string>) =>
  Object.entries(g).map(([file, text]) => ({ file, text }));

const html = Object.values(
  import.meta.glob<string>("/index.html", { query: "?raw", import: "default", eager: true }),
)[0];
const viteConfig = Object.values(
  import.meta.glob<string>("/vite.config.ts", { query: "?raw", import: "default", eager: true }),
)[0];
const sources = raw(
  import.meta.glob<string>(
    ["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}", "!/src/test-setup.ts"],
    { query: "?raw", import: "default", eager: true },
  ),
);
sources.push({ file: "index.html", text: html });

const forbidden: [string, RegExp][] = [
  ["localStorage", /localStorage/],
  ["sessionStorage", /sessionStorage/],
  ["indexedDB", /indexedDB/],
  ["document.cookie", /document\.cookie/],
  ["sendBeacon", /sendBeacon/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["fetch to non-relative URL", /\bfetch\s*\(\s*(?![`'"]\.{1,2}\/|import\.meta\.env\.BASE_URL)/],
  ["bracket access to fetch", /\[\s*[`'"]fetch[`'"]\s*\]/],
  ["external URL in script/link tag", /<(script|link)\b[^>]*(?:https?:\/\/|=\s*["']?\/\/)[^>]*>/i],
];

describe("privacy guard", () => {
  it("scans some files", () => {
    expect(sources.length).toBeGreaterThan(2);
  });

  for (const [name, re] of forbidden) {
    it(`has no ${name}`, () => {
      const hits = sources.filter((s) => re.test(s.text)).map((s) => s.file);
      expect(hits).toEqual([]);
    });
  }

  it("fetch rule allows relative paths only", () => {
    const re = forbidden.find(([n]) => n === "fetch to non-relative URL")![1];
    expect(re.test('fetch("./data.json")')).toBe(false);
    expect(re.test("fetch(`../data.json`)")).toBe(false);
    expect(re.test("fetch(import.meta.env.BASE_URL + 'data.json')")).toBe(false);
    expect(re.test("fetch('/data.json')")).toBe(true);
    expect(re.test('fetch ("https://x.example/a")')).toBe(true);
    expect(re.test('fetch("https://x.example/a")')).toBe(true);
    expect(re.test('fetch("//x.example/a")')).toBe(true);
    expect(re.test("fetch(url)")).toBe(true);
  });

  it("sets the CSP and no-referrer meta tags", () => {
    expect(html).toContain(
      "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'",
    );
    expect(html).not.toMatch(/'unsafe-eval'/);
    expect(html).toContain('<meta name="referrer" content="no-referrer" />');
  });

  it("uses a relative base in vite.config.ts", () => {
    expect(viteConfig).toMatch(/base:\s*["']\.\/?["']/);
  });
});
