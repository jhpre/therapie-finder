# therapie-finder

A static website for people in Leipzig who are looking for a psychotherapy place with statutory health insurance. You enter your postcode (PLZ) and get a ready-to-use PDF:

- every psychotherapist with a statutory-insurance licence (Kassenzulassung) for adults, sorted by straight-line distance from the PLZ centroid, with a radius filter
- methods (VT, TP, AP, ST), phone hours, email, video/accessibility/languages, absences
- fields to log every contact attempt (date, time, person, result)
- guidance pages: recommended steps, phone questions, email template, crisis numbers
- a page for preparing cost reimbursement (Kostenerstattung, § 13 Abs. 3 SGB V) and a contact log

The user interface and the PDF are in German.

## Status

Feature-complete, but **with fictional sample data only** (`src/data/sample-practices.json`). No real practice data is included. The project is no longer developed and may be taken over freely (MIT licence).

About the data: the KV Sachsen Arztsuche is protected as a database (§§ 87a ff. UrhG). KV Sachsen declined to provide the data; linking to it is allowed. Anyone adding real data needs their own legal basis for it (own collection, consent, a licence) and a GDPR basis for the contact data (Art. 6 (1) f, information duty under Art. 14).

## Tech

React 19 + TypeScript + Vite, runs entirely in the browser, no backend. The PDF is generated in the browser (`@react-pdf/renderer`, in a web worker). The entered PLZ and filters never leave the device.

```sh
npm ci
npm run dev        # development server
make check         # lint, format check, types, tests, build (same as CI)
npm run build      # static files in dist/, relative paths, works from any subfolder
```

Needs Node 22 or newer.

## Where things are

| What                                                        | Where                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Data format (practice, phone hours, absence …)              | [src/data/types.ts](src/data/types.ts)                                                                                |
| Sample data (fictional)                                     | [src/data/sample-practices.json](src/data/sample-practices.json)                                                      |
| Leipzig PLZ centroids (OSM) and the script that builds them | [src/data/plz-centroids.json](src/data/plz-centroids.json), [scripts/plz-centroids/](scripts/plz-centroids/README.md) |
| Radius, filters, sorting                                    | [src/lib/](src/lib/)                                                                                                  |
| Website                                                     | [src/App.tsx](src/App.tsx)                                                                                            |
| PDF (layout, content, generation)                           | [src/pdf/](src/pdf/), text template in [docs/pdf-content.md](docs/pdf-content.md)                                     |
| Original specification                                      | [docs/spec.md](docs/spec.md)                                                                                          |

Using real data: produce a JSON file in the `PracticeData` format (coordinates per practice in `location`) and import it in `src/App.tsx` instead of the sample data. `source` and `asOf` are printed as source and data date ("Stand") on every PDF page. Other cities also need matching PLZ centroids (`scripts/plz-centroids/build.mjs` is set up for Leipzig).

## Principles

- **No personal data from users.** No tracking, no third-party scripts, nothing is stored.
- **Crisis help is always visible**, on the website and in the PDF.
- **No medical or legal advice**; the source and data date are shown on every page.

## Licence

Code: MIT, see [LICENSE](LICENSE). PLZ centroids: © OpenStreetMap contributors, ODbL. Font: DejaVu (free licence, via npm).
