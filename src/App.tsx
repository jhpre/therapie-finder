import { useState, type ReactNode } from "react";
import data from "./data/sample-practices.json";
import type { Method, PracticeData } from "./data/types";
import {
  DEFAULT_FILTERS,
  MAX_DISTANCES,
  availableLanguages,
  filterPractices,
  countActiveFilters,
  isFilterActive,
  type Filters,
} from "./lib/filter";
import { downloadBlob, generatePdf, pdfFileName } from "./pdf/generate";
import { validatePlz, type PlzResult } from "./lib/plz";
import { formatDate, formatKm, sortByDistance, summarize } from "./lib/sort";

const practices = data as PracticeData;
const languages = availableLanguages(practices.practices);
const METHODS: { value: Method; label: string }[] = [
  { value: "VT", label: "Verhaltenstherapie (VT)" },
  { value: "TP", label: "Tiefenpsychologisch (TP)" },
  { value: "AP", label: "Analytisch (AP)" },
  { value: "ST", label: "Systemisch (ST)" },
];

function Warning({ children }: { children: ReactNode }) {
  return <p className="warning">{children}</p>;
}

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<PlzResult | null>(null);

  // Filter state is lifted here (React state only) so the PDF code can read it later.
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "busy" | "error">("idle");

  const sorted = result?.ok ? sortByDistance(practices.practices, result.centroid) : null;
  const summary = sorted ? summarize(sorted) : null;
  const filtered = sorted ? filterPractices(sorted, filters) : null;
  const filtersActive = isFilterActive(filters);
  const activeCount = countActiveFilters(filters);
  const toggleMethod = (m: Method) =>
    setFilters((f) => ({
      ...f,
      methods: f.methods.includes(m) ? f.methods.filter((x) => x !== m) : [...f.methods, m],
    }));

  const downloadPdf = async () => {
    if (!result?.ok || !filtered) return;
    setPdfState("busy");
    try {
      const blob = await generatePdf({
        data: practices,
        plz: result.plz,
        practices: filtered,
        filters,
      });
      downloadBlob(blob, pdfFileName(result.plz));
      setPdfState("idle");
    } catch {
      setPdfState("error");
    }
  };

  return (
    <div className={sorted ? "page has-download" : "page"}>
      <header className="site-header">
        <h1>Psychotherapie-Praxen für gesetzlich Versicherte in Leipzig</h1>
        <p className="lead">
          Finden Sie Praxen in Ihrer Nähe, sortiert nach Entfernung, und nehmen Sie die Liste als
          PDF mit.
        </p>
      </header>
      <main>
        <aside role="note" aria-label="Hilfe in einer akuten Krise" className="crisis">
          <p>
            <strong>In einer akuten Krise:</strong>
          </p>
          <p>
            <a href="tel:112">112</a> Notruf · <a href="tel:116117">116117</a> ärztlicher
            Bereitschaftsdienst
          </p>
          <p>
            TelefonSeelsorge (kostenlos, anonym, rund um die Uhr):{" "}
            <a href="tel:08001110111">0800 111 0 111</a> ·{" "}
            <a href="tel:08001110222">0800 111 0 222</a>
          </p>
        </aside>
        <section className="intro" aria-labelledby="intro-heading">
          <h2 id="intro-heading">So geht es in drei Schritten</h2>
          <ol className="steps">
            <li>Postleitzahl eingeben</li>
            <li>Liste prüfen und filtern</li>
            <li>PDF herunterladen</li>
          </ol>
        </section>
        <form
          noValidate
          className="card-panel"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(validatePlz(input));
          }}
        >
          <label htmlFor="plz" className="field-label">
            Ihre Leipziger Postleitzahl
          </label>
          <div className="plz-row">
            <input
              id="plz"
              name="plz"
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-invalid={result?.ok === false}
              aria-describedby="plz-feedback"
            />
            <button type="submit" className="btn btn-primary">
              Weiter
            </button>
          </div>
          <p
            id="plz-feedback"
            className={result?.ok === false ? "feedback error" : "feedback"}
            role={result?.ok === false ? "alert" : undefined}
            aria-live={result?.ok === false ? undefined : "polite"}
          >
            {result?.ok === false && result.error}
            {result?.ok === true && `Postleitzahl ${result.plz} ist gültig.`}
          </p>
        </form>
        {sorted && filtered && summary && (
          <section aria-labelledby="results-heading">
            <div className="results-head">
              <h2 id="results-heading">Praxen nach Entfernung</h2>
              <p>
                {summary.total} Psychotherapeut:innen, sortiert nach Entfernung (Luftlinie). Davon{" "}
                {summary.within2} im Umkreis von 2 km, {summary.within3} bis 3 km und{" "}
                {summary.within5} bis 5 km.
              </p>
            </div>
            <div className="download-bar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={pdfState === "busy"}
                onClick={downloadPdf}
              >
                {pdfState === "busy" ? "PDF wird erstellt …" : "PDF herunterladen"}
              </button>
              <span role="status">
                {pdfState === "error" &&
                  "Das PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut."}
              </span>
            </div>
            <button
              type="button"
              className="btn filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="filter-panel"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              {activeCount > 0 ? `Filter (${activeCount} aktiv)` : "Filter"}
            </button>
            <form
              id="filter-panel"
              aria-label="Filter"
              className={filtersOpen ? "card-panel filters open" : "card-panel filters"}
              onSubmit={(e) => e.preventDefault()}
            >
              <fieldset>
                <legend>Therapieverfahren (mindestens eines)</legend>
                {METHODS.map((m) => (
                  <label key={m.value} className="check">
                    <input
                      type="checkbox"
                      checked={filters.methods.includes(m.value)}
                      onChange={() => toggleMethod(m.value)}
                    />
                    {m.label}
                  </label>
                ))}
              </fieldset>
              <div className="filter-grid">
                <div>
                  <label htmlFor="filter-distance" className="field-label">
                    Höchstentfernung
                  </label>
                  <select
                    id="filter-distance"
                    className="select"
                    value={filters.maxDistanceKm ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        maxDistanceKm: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">egal</option>
                    {MAX_DISTANCES.map((km) => (
                      <option key={km} value={km}>
                        bis {km} km
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-language" className="field-label">
                    Sprache
                  </label>
                  <select
                    id="filter-language"
                    className="select"
                    value={filters.language}
                    onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
                  >
                    <option value="">egal</option>
                    {languages.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={filters.video}
                    onChange={(e) => setFilters((f) => ({ ...f, video: e.target.checked }))}
                  />
                  Videosprechstunde
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={filters.accessible}
                    onChange={(e) => setFilters((f) => ({ ...f, accessible: e.target.checked }))}
                  />
                  stufenlos/Aufzug
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={filters.group}
                    onChange={(e) => setFilters((f) => ({ ...f, group: e.target.checked }))}
                  />
                  Gruppentherapie
                </label>
              </div>
              <div className="filter-status">
                <span role="status">
                  {filtersActive && `${filtered.length} von ${summary.total} Praxen`}
                </span>
                {filtersActive && (
                  <button type="button" className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            </form>
            <p role="status">
              {filtered.length === 0 &&
                "Keine Praxis passt zu Ihren Filtern. Bitte weiten Sie die Filter aus, zum Beispiel mit einer größeren Entfernung oder weniger Anforderungen."}
            </p>
            {filtered.length > 0 && (
              <ol className="practice-list" aria-label="Praxen">
                {filtered.map(({ practice: p, distanceKm: km }, i) => {
                  const extras = [
                    p.group && "Gruppe",
                    p.childrenToo && "auch Kinder/Jugendl.",
                    p.video && "Video",
                    p.accessible && "stufenlos/Aufzug",
                    ...p.languages,
                  ].filter(Boolean);
                  return (
                    <li key={p.id} className="practice">
                      <div className="practice-head">
                        <span className="distance">
                          {i + 1}. {formatKm(km)}
                        </span>
                        <h3>{p.name}</h3>
                      </div>
                      <p className="practice-role">{p.role}</p>
                      <p className="practice-address">
                        {p.street}, {p.zip} Leipzig · {p.district}
                      </p>
                      <div className="contact">
                        {p.phones.map((phone) => (
                          <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                            <span aria-hidden="true">☎</span> {phone}
                          </a>
                        ))}
                        {p.email && (
                          <a href={`mailto:${p.email}`}>
                            <span aria-hidden="true">✉</span> {p.email}
                          </a>
                        )}
                      </div>
                      <div className="tags">
                        {p.methods.map((m) => (
                          <span key={m} className={`badge badge-${m}`}>
                            {m}
                          </span>
                        ))}
                        {extras.length > 0 && <span className="extras">{extras.join(" · ")}</span>}
                      </div>
                      {p.absent && (
                        <Warning>
                          Laut KV abwesend von {formatDate(p.absent.from)} bis{" "}
                          {formatDate(p.absent.to)}
                        </Warning>
                      )}
                      {p.inactiveHere && (
                        <Warning>Laut KV derzeit nicht an diesem Standort tätig</Warning>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <p>
          Quelle: {practices.source} · Stand {formatDate(practices.asOf)}
        </p>
        <p>
          Postleitzahl-Gebiete: © OpenStreetMap contributors,{" "}
          <a href="https://www.openstreetmap.org/copyright">ODbL</a>
        </p>
        <h2 id="datenschutz">Datenschutz</h2>
        <p>Ihre Eingaben bleiben im Browser. Es erfolgt keine Speicherung und kein Tracking.</p>
      </footer>
    </div>
  );
}
