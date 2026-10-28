# Specification

Goal: someone enters their Leipzig postcode and downloads a ready-to-use PDF (a reference version had 63 pages and 346 practices). The PDF holds every psychotherapist with a statutory-insurance licence for adults, sorted by straight-line distance from the PLZ centroid, with space to log each contact, plus the guidance pages.

This was the original plan; the data pipeline was not built (no data source with a legal basis).

## Decisions / research first

- **Data source.** KV Sachsen Arztsuche. Check its terms of use and whether there is an export or API; scraping only if allowed. Publicly visible does not mean free to republish: the database as a whole is protected (database right, §§ 87a ff. UrhG). KV Sachsen declined to provide the data (2026-10); linking to the Arztsuche is allowed.
- **GDPR basis** for publishing therapist contact data: legitimate interest (Art. 6 (1) f), information duty (Art. 14), handling objections and corrections.
- **Refresh interval** (weekly?) and showing the data date ("Stand") in the PDF.
- **Geocoding** of practice addresses (e.g. OSM Nominatim, cached, with attribution) and PLZ centroids for Leipzig.
- **Tech stack**, e.g. static frontend + small backend, or a server that renders HTML to PDF.
- **Hosting**: any static host.
- **Legal check before going public**: imprint (Impressum), privacy policy, disclaimer "no medical or legal advice", liability for outdated data.

## Data pipeline

- **Importer** for practice data: name, title, address, phone numbers, email, methods (VT/TP/AP/ST), group/video/accessibility/languages, phone hours and notes, absences, "not currently active at this location", practice partners.
- **Duplicate detection**: the same person at several locations ("also listed under no. X").
- **Optional email enrichment** from practice websites, always marked with its source.
- **Scheduled refresh** plus a check that flags large changes before publishing.

## Website

- **Input**: Leipzig PLZ, validated against the list of Leipzig postcodes.
- **Filters**: methods, max distance, video, accessibility, language, group therapy.
- **Preview** of the list in the browser, then PDF download.
- **Mobile-friendly and accessible** (readable font sizes, keyboard use).

## PDF

- **Page 1**: recommended steps, legend, phone questions, email template, crisis numbers (112, 116117, TelefonSeelsorge 0800 111 0 111 / 0800 111 0 222).
- **Page 2**: preparing cost reimbursement (§ 13 Abs. 3 SGB V) with blank fields for the insurer's own requirements; insurer-specific notes only where verified.
- **Practice table** sorted by distance, with fields for phone/email contact, result and notes; absences highlighted.
- **Contact log page** (Kontaktprotokoll) for the reimbursement application.
- **Stable layout** across 300+ entries: page breaks, header/footer with source and data date.

## Privacy and safety (health context)

- Do not store the entered PLZ or filters; no tracking, no third-party scripts, no logs that link IP and query.
- Generate the PDF without personal data; name/insurance fields stay blank for printing.
- Crisis numbers always visible on the website, not only in the PDF.

## Quality

- Tests: distance sorting, duplicate detection, PDF snapshot test against a reference list.
- Compare the generated PDF for PLZ 04318 with the reference version.
