import {
  Checkbox,
  Document,
  Page,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import type { Method, Practice, PracticeData } from "../data/types";
import { describeFilters, type Filters } from "../lib/filter";
import { formatDate, formatKm, summarize, type PracticeWithDistance } from "../lib/sort";
import { PDF_FONT } from "./fonts";
import { PDF_CREATOR, pdfTitle } from "./meta";

export interface PdfInput {
  data: PracticeData;
  plz: string;
  /** The current (filtered) list, sorted by distance. */
  practices: PracticeWithDistance[];
  filters: Filters;
}

const COLORS: Record<Method, string> = {
  VT: "#2e7d32",
  TP: "#1565c0",
  AP: "#6a1b9a",
  ST: "#e65100",
};

const LEGEND: { method: Method; name: string; text: string }[] = [
  {
    method: "VT",
    name: "Verhaltenstherapie",
    text: "arbeitet v. a. an den aktuellen Beschwerden, oft mit Übungen zwischen den Sitzungen; meist 1×/Woche, ½–1 Jahr.",
  },
  {
    method: "TP",
    name: "Tiefenpsychologisch fundiert",
    text: "bespricht v. a. prägende, belastende Erfahrungen aus der Vergangenheit; meist 1×/Woche, ½–2 Jahre.",
  },
  {
    method: "AP",
    name: "Analytische Psychotherapie",
    text: "geht davon aus, dass heutige Beziehungen v. a. durch frühe Beziehungen zu Eltern/Geschwistern geprägt sind; oft 2–3×/Woche, häufig 2 Jahre und länger.",
  },
  {
    method: "ST",
    name: "Systemische Therapie",
    text: "arbeitet an aktuellen Beziehungen (Partnerschaft, Familie), bezieht Angehörige oft ein; Abstände zwischen Sitzungen teils länger.",
  },
];

const MAIL_TEMPLATE = [
  "Betreff: Anfrage Erstgespräch / Therapieplatz",
  "",
  "Sehr geehrte/r Frau/Herr …,",
  "",
  "ich bin gesetzlich versichert und suche einen Termin für ein Erstgespräch (psychotherapeutische Sprechstunde) und anschließend einen Therapieplatz [bevorzugt: …].",
  "[Falls zutreffend: Eine Sprechstunde hatte ich bereits am …; empfohlen wurde …]",
  "Haben Sie in absehbarer Zeit einen Termin frei oder kann ich mich auf Ihre Warteliste setzen lassen? Wie lange wäre die voraussichtliche Wartezeit?",
  "Über eine kurze Rückmeldung würde ich mich freuen – auch wenn Sie aktuell keinen Platz haben.",
  "Telefonisch erreichbar bin ich unter … (am besten …).",
  "",
  "Mit freundlichen Grüßen",
  "…",
];

const QUESTIONS = [
  "Haben Sie einen Termin für ein Erstgespräch (psychotherapeutische Sprechstunde)?",
  "Gibt es danach bei Ihnen die Möglichkeit für einen Therapieplatz? Wie lange wäre die Wartezeit?",
  "Führen Sie eine Warteliste? Muss ich mich regelmäßig melden?",
  "Nach erfolgter Sprechstunde: „Ich habe eine Empfehlung für [VT/TP] – können wir mit Probesitzungen beginnen?“",
  "Bei Absage: Datum, Uhrzeit und Name der Gesprächsperson notieren.",
];

const CRISIS_RED = "#b00020";

// Set per text style: a lineHeight on the page would make react-pdf drop the footer's page numbers.
const LH = 1.3;
/** Smallest text size on paper, in pt. */
const MIN_PT = 8;
const BODY = MIN_PT;
// Hand-writing height of a fill-in line on page 2 (about 9 mm).
const WRITE_H = 26;

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: BODY,
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: 30,
    color: "#111",
  },
  title: { fontSize: 15, fontWeight: "bold", marginBottom: 3 },
  intro: { fontSize: 8, lineHeight: LH, marginBottom: 2 },
  filterLine: { fontSize: 8, lineHeight: LH, marginBottom: 2 },
  columns: { flexDirection: "row", marginTop: 4 },
  col: { flex: 1, paddingRight: 10 },
  colWide: { flex: 1.25, paddingRight: 10 },
  colLast: { flex: 1 },
  h2: { fontSize: 9.5, fontWeight: "bold", marginBottom: 3 },
  item: { flexDirection: "row", marginBottom: 2 },
  marker: { width: 11 },
  // fontSize is explicit: react-pdf resolves a unitless lineHeight against the element's own size.
  itemText: { flex: 1, fontSize: BODY, lineHeight: LH },
  badgeBox: { width: 22, marginRight: 4, paddingVertical: 1, alignItems: "center" },
  small: { fontSize: MIN_PT, lineHeight: LH, color: "#444", marginTop: 2 },
  badge: { color: "#fff", fontWeight: "bold", fontSize: BODY },
  mailBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#eeeeee",
    border: "0.5pt solid #bbb",
  },
  mailLine: { fontSize: MIN_PT, lineHeight: LH },
  crisis: { marginTop: 6, padding: 5, border: `1.5pt solid ${CRISIS_RED}` },
  crisisTitle: { color: CRISIS_RED, fontWeight: "bold", fontSize: 9, marginBottom: 1 },
  thead: { flexDirection: "row", backgroundColor: "#1a237e", color: "#fff", fontWeight: "bold" },
  th: { padding: 3, fontSize: MIN_PT },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #999", minHeight: 84 },
  td: { padding: 3, fontSize: BODY, lineHeight: LH },
  line: { fontSize: BODY, lineHeight: LH },
  fill: { flexDirection: "row", alignItems: "flex-end", height: 11 },
  fillLabel: { fontSize: BODY, lineHeight: LH, marginRight: 2 },
  fillRule: { flex: 1, height: 9, borderBottom: "0.5pt solid #777" },
  fillTall: { flexDirection: "row", alignItems: "flex-end", height: WRITE_H },
  noteRuleTall: { height: WRITE_H, borderBottom: "0.5pt solid #777" },
  noteRule: { height: 15, borderBottom: "0.5pt solid #bbb" },
  noteBox: { height: 45 },
  optRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  opt: { flexDirection: "row", marginRight: 6 },
  tip: { fontSize: BODY, lineHeight: LH, marginTop: 4, fontStyle: "italic" },
  muted: { fontSize: BODY, lineHeight: LH, color: "#777", fontStyle: "italic" },
  red: { fontSize: BODY, lineHeight: LH, color: CRISIS_RED },
  extras: { fontSize: MIN_PT, lineHeight: LH, color: "#444", marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap" },
  miniBadge: { paddingHorizontal: 3, paddingVertical: 1, marginRight: 2, marginBottom: 2 },
  footerLeft: { position: "absolute", left: 28, bottom: 16, fontSize: MIN_PT, color: "#555" },
  footerRight: {
    position: "absolute",
    left: 842 - 28 - 80,
    width: 80,
    textAlign: "right",
    bottom: 16,
    fontSize: MIN_PT,
    color: "#555",
  },
});

/** Size of the form field fonts; fields stay empty, the user types into them. */
const FIELD_FONT = MIN_PT;

/** An empty one-line text field that fills its parent box (the printed writing line). */
function TextField({ name, height = 9 }: { name: string; height?: number }) {
  return <TextInput name={name} fontSize={FIELD_FONT} style={{ width: "100%", height }} />;
}

/** An empty wrapping text field that fills its parent box. */
function AreaField({ name, height }: { name: string; height: number }) {
  return (
    <TextInput name={name} multiline fontSize={FIELD_FONT} style={{ width: "100%", height }} />
  );
}

/**
 * The printed ☐ with an unchecked checkbox field laid over it, so printing looks the same and
 * the box can be ticked on screen.
 */
function Box({ name, width = 11, size = 6.5 }: { name: string; width?: number; size?: number }) {
  return (
    <View style={{ width }}>
      <Text>☐</Text>
      <Checkbox
        name={name}
        xMark
        style={{ position: "absolute", left: 0.3, top: 1, width: size, height: size }}
      />
    </View>
  );
}

/** A checkbox followed by its label. */
function Opt({ name, label, width = 9 }: { name: string; label: string; width?: number }) {
  return (
    <View style={s.opt}>
      <Box name={name} width={width} />
      <Text style={s.line}>{label}</Text>
    </View>
  );
}

function Footer({ data, plz }: { data: PracticeData; plz: string }) {
  return (
    <>
      <Text style={s.footerLeft} fixed>
        Quelle: {data.source} · Stand {formatDate(data.asOf)} · Entfernung = Luftlinie ab
        Mittelpunkt PLZ {plz}
      </Text>
      <Text
        style={s.footerRight}
        fixed
        render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`}
      />
    </>
  );
}

const B = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontWeight: "bold" }}>{children}</Text>
);

function Item({
  marker,
  checkName,
  children,
}: {
  marker: string;
  /** If set, the ☐ marker is also a checkbox field of this name. */
  checkName?: string;
  children: ReactNode;
}) {
  return (
    <View style={s.item} wrap={false}>
      {checkName ? <Box name={checkName} /> : <Text style={s.marker}>{marker}</Text>}
      <Text style={s.itemText}>{children}</Text>
    </View>
  );
}

/** Page 1: title, intro, guidance, legend, phone questions, mail template, crisis box. */
function OverviewPage({ input }: { input: PdfInput }) {
  const { data, plz, practices, filters } = input;
  const sum = summarize(practices);
  const count = (m: Method) => practices.filter((p) => p.practice.methods.includes(m)).length;
  const filterText = describeFilters(filters);

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.title}>Psychotherapie-Praxen für gesetzlich Versicherte in Leipzig</Text>
      <Text style={s.intro}>
        {sum.total} Psychotherapeut:innen mit Kassenzulassung für Erwachsene, sortiert nach
        Entfernung (Luftlinie) zum Mittelpunkt der PLZ {plz}. Davon {sum.within2} im Umkreis von 2
        km, {sum.within3} bis 3 km und {sum.within5} bis 5 km.
      </Text>
      {filterText !== "" && <Text style={s.filterLine}>Filter: {filterText}</Text>}

      <View style={s.columns}>
        <View style={s.colWide}>
          <Text style={s.h2}>Empfohlenes Vorgehen</Text>
          <Item marker="1.">
            <B>Erstgespräch sichern – zwei Wege parallel:</B> über die <B>116117</B> (Telefon oder
            eterminservice.de) <B>und</B> direkt bei den Praxen dieser Liste.
          </Item>
          <Item marker="2.">
            <B>Praxen kontaktieren</B>, die nächsten zuerst, in den Telefonzeiten oder per Mail.
            Immer nach <B>Erstgespräch und Therapieplatz/Warteliste</B> fragen. Mehrere Praxen
            parallel anfragen ist üblich.
          </Item>
          <Item marker="3.">
            <B>Nach dem Erstgespräch</B> das Formular <B>PTV 11</B> mitnehmen. Mit Empfehlung für
            eine Therapie weitersuchen und bei jeder Anfrage gleich erwähnen – dann sind oft direkt
            Probesitzungen möglich.
          </Item>
          <Item marker="4.">
            Steht auf dem PTV 11 „Akutbehandlung“ oder „zeitnah erforderlich“, gibt es einen{" "}
            <B>Vermittlungscode</B>: bei der 116117 ausdrücklich nach Vermittlung von Akutbehandlung
            bzw. Probesitzungen fragen.
          </Item>
          <Item marker="5.">
            <B>Jeden Kontakt in der Liste dokumentieren</B> (Datum, Ergebnis; beim Telefonat auch
            Uhrzeit und Gesprächsperson). Erst für einen Kostenerstattungs-Antrag die relevanten
            Kontakte ins Kontaktprotokoll im Anhang übertragen. Nach 1–2 Wochen ohne Antwort erneut
            melden.
          </Item>
          <Item marker="6.">
            Kein Platz in zumutbarer Zeit? → <B>Kostenerstattung</B> vorbereiten (Seite 2).
          </Item>
          <Text style={s.small}>
            Ohne Erstgespräch geht es nur, wer in den letzten 12 Monaten wegen einer psychischen
            Erkrankung im Krankenhaus oder in der Reha behandelt wurde. Das Erstgespräch muss nicht
            in der Praxis stattfinden, in der später die Therapie läuft.
          </Text>
          <Text style={s.tip}>
            Tipp: Dieses PDF lässt sich auch am Computer oder Tablet ausfüllen und speichern.
          </Text>
        </View>

        <View style={s.col}>
          <Text style={s.h2}>Legende</Text>
          {LEGEND.map((l) => (
            <View key={l.method} style={s.item} wrap={false}>
              <View style={{ ...s.badgeBox, backgroundColor: COLORS[l.method] }}>
                <Text style={s.badge}>{l.method}</Text>
              </View>
              <Text style={s.itemText}>
                <B>
                  {l.name} ({count(l.method)}):
                </B>{" "}
                {l.text}
              </Text>
            </View>
          ))}
          <Text style={s.small}>
            Einzeltherapie bieten alle an. <B>Gruppe</B> = zusätzlich Gruppentherapie möglich ·{" "}
            <B>Video</B> = Videosprechstunde wird in der Praxis zusätzlich angeboten (nicht
            unbedingt von jeder Therapeut:in; Erstgespräch immer vor Ort) · <B>stufenlos/Aufzug</B>{" "}
            = laut KV barrierearmer Zugang · Sprachen = Behandlung auch in diesen Fremdsprachen.
          </Text>
          <Text style={s.small}>
            Verfahren und Telefonzeiten stammen aus den Angaben der Praxen bei der KV Sachsen.
            E-Mail-Adressen mit dem Zusatz „(Quelle: …)“ sind nicht bei der KV hinterlegt, sondern
            wurden im Internet recherchiert (Praxis-Website oder Verzeichnis).
          </Text>
          <Text style={s.small}>
            Spalte <B>Tel. kontaktiert</B>: Kreuz, Datum, Uhrzeit und Name der Gesprächsperson
            („mit“) – diese Angaben braucht man später für den Nachweis bei der Krankenkasse. „2.“ =
            zweiter Versuch.
          </Text>
        </View>

        <View style={s.colLast}>
          <Text style={s.h2}>Fragen fürs Telefonat</Text>
          {QUESTIONS.map((q) => (
            <Item key={q} marker="•">
              {q}
            </Item>
          ))}
          <View style={s.mailBox} wrap={false}>
            {MAIL_TEMPLATE.map((line, i) => (
              <Text key={i} style={s.mailLine}>
                {line === "" ? " " : line}
              </Text>
            ))}
          </View>
          <Text style={s.small}>
            Antworten (auch Absagen) speichern – sie sind schriftliche Nachweise. E-Mails sind meist
            unverschlüsselt: keine ausführlichen Gesundheitsdetails hineinschreiben.
          </Text>

          <View style={s.crisis} wrap={false}>
            <Text style={s.crisisTitle}>In einer akuten Krise</Text>
            <Text style={s.mailLine}>
              <B>112</B> Notruf · <B>116117</B> ärztlicher Bereitschaftsdienst
            </Text>
            <Text style={s.mailLine}>
              <B>TelefonSeelsorge</B> (kostenlos, anonym, rund um die Uhr): <B>0800 111 0 111</B> ·{" "}
              <B>0800 111 0 222</B>
            </Text>
          </View>
        </View>
      </View>

      <Footer data={data} plz={plz} />
    </Page>
  );
}

const IMPORTANT = [
  <>
    Antrag <B>vor</B> Beginn der Privatbehandlung stellen und die Entscheidung der Kasse abwarten –
    sonst droht, dass die Kosten nicht erstattet werden.
  </>,
  <>
    Nur Behandlung bei <B>approbierten</B> Psychotherapeut:innen (ärztlich oder psychologisch);
    Heilpraktiker:innen werden nicht erstattet.
  </>,
  <>
    Suche lückenlos dokumentieren: Datum, Praxis, Kontaktweg, Ergebnis, Wartezeit (Kontaktprotokoll
    im Anhang).
  </>,
  <>
    Kontakt zur <B>116117</B> festhalten (Datum, Uhrzeit, Ergebnis bzw. Terminbestätigung).
  </>,
  <>Kopien von allem behalten, was an die Kasse geht.</>,
  <>
    Bei Ablehnung: schriftlicher <B>Widerspruch</B> innerhalb eines Monats nach Erhalt des Bescheids
    möglich.
  </>,
];

const DOCUMENTS = [
  "PTV 11 aus der Sprechstunde (Behandlungsempfehlung, ggf. Dringlichkeit)",
  "Nachweis der erfolglosen Suche: Kontaktprotokoll, Absage-Mails",
  "Nachweis über Kontakt zur Terminservicestelle 116117",
  "Bestätigung der Privatpraxis: Approbation, freier Behandlungsplatz ab …, ggf. Kostenvoranschlag",
  "Antrag der Krankenkasse bzw. formloses Schreiben",
];

/** Page 2: preparing a Kostenerstattung request (print-and-write, no insurer-specific content). */
function ReimbursementPage({ input }: { input: PdfInput }) {
  const { data, plz } = input;
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.title}>Kostenerstattung vorbereiten</Text>
      <Text style={s.intro}>
        Findet sich trotz nachweisbarer Suche kein Kassenplatz in zumutbarer Zeit, kann die
        Krankenkasse die Kosten einer Behandlung bei einer approbierten Psychotherapeut:in in
        Privatpraxis übernehmen (Kostenerstattung, § 13 Abs. 3 SGB V).{" "}
        <B>
          Ablauf und geforderte Nachweise unterscheiden sich je nach Krankenkasse – deshalb zuerst
          dort nachfragen
        </B>{" "}
        und die Antworten unten eintragen.
      </Text>

      <View style={s.columns}>
        <View style={s.col}>
          <Text style={s.h2}>Grundsätzlich wichtig</Text>
          {IMPORTANT.map((t, i) => (
            <Item key={i} marker="☐" checkName={`seite2.wichtig.${i + 1}`}>
              {t}
            </Item>
          ))}
          <Text style={{ ...s.h2, marginTop: 6 }}>Unterlagen, die häufig verlangt werden</Text>
          {DOCUMENTS.map((t, i) => (
            <Item key={t} marker="☐" checkName={`seite2.unterlagen.${i + 1}`}>
              {t}
            </Item>
          ))}
          <View style={s.fill}>
            <Box name="seite2.unterlagen.weitere" />
            <Text style={s.fillLabel}>Weitere Nachweise laut Kasse:</Text>
            <View style={s.fillRule}>
              <TextField name="seite2.unterlagen.weitere-text" />
            </View>
          </View>
        </View>

        <View style={s.colLast}>
          <Text style={s.h2}>Vorgaben meiner Krankenkasse</Text>
          <Fill tall name="seite2.kasse.name" label="Krankenkasse:" />
          <Fill tall name="seite2.kasse.ansprechpartner" label="Ansprechpartner:in / Telefon:" />
          <Fill tall name="seite2.kasse.gefragt-am" label="Gefragt am:" />
          <Fill tall name="seite2.kasse.absagen" label="Anzahl / Art der geforderten Absagen:" />
          <Fill
            tall
            name="seite2.kasse.wartezeit"
            label="Ab welcher Wartezeit gilt sie als unzumutbar?"
          />
          <View style={s.fillTall}>
            <Text style={s.fillLabel}>Eigenes Antragsformular?</Text>
            <Opt name="seite2.kasse.antragsformular.ja" label="ja" />
            <Opt name="seite2.kasse.antragsformular.nein" label="nein" />
            <Text style={s.fillLabel}>Bezugsweg:</Text>
            <View style={s.fillRule}>
              <TextField name="seite2.kasse.antragsformular.bezugsweg" />
            </View>
          </View>
          <View style={{ ...s.optRow, marginTop: 4 }}>
            <Text style={{ ...s.line, marginRight: 3 }}>Kontakt zur 116117 erforderlich?</Text>
            <Opt name="seite2.kasse.kontakt-116117.ja" label="ja" />
            <Opt name="seite2.kasse.kontakt-116117.nein" label="nein" />
          </View>
          <View style={s.optRow}>
            <Text style={{ ...s.line, marginRight: 3 }}>Einreichen per:</Text>
            <Opt name="seite2.kasse.einreichen.post" label="Post" />
            <Opt name="seite2.kasse.einreichen.mail" label="Mail" />
            <Opt name="seite2.kasse.einreichen.online" label="App/Online" />
          </View>
          <Text style={{ ...s.line, marginTop: 4 }}>Notizen:</Text>
          <View style={{ height: WRITE_H * 3 }}>
            <AreaField name="seite2.kasse.notizen" height={WRITE_H * 3} />
            <View style={{ ...s.noteRuleTall, position: "absolute", top: 0, width: "100%" }} />
            <View
              style={{ ...s.noteRuleTall, position: "absolute", top: WRITE_H, width: "100%" }}
            />
            <View
              style={{ ...s.noteRuleTall, position: "absolute", top: WRITE_H * 2, width: "100%" }}
            />
          </View>

          <Text style={{ ...s.h2, marginTop: 6 }}>Meine Eckdaten</Text>
          <Fill tall name="seite2.eckdaten.erstgespraech" label="Erstgespräch am / bei:" />
          <View style={s.optRow}>
            <Text style={{ ...s.line, marginRight: 3 }}>Empfehlung (PTV 11):</Text>
            <Opt name="seite2.eckdaten.empfehlung.akutbehandlung" label="Akutbehandlung" />
            <Opt name="seite2.eckdaten.empfehlung.therapie" label="Therapie" />
            <Opt name="seite2.eckdaten.empfehlung.zeitnah" label="zeitnah erforderlich" />
          </View>
          <Fill tall name="seite2.eckdaten.suche-begonnen" label="Suche begonnen am:" />
          <Fill
            tall
            name="seite2.eckdaten.privatpraxis"
            label="Privatpraxis (Name, Approbation, Termin ab):"
          />
          <Fill tall name="seite2.eckdaten.antrag-gestellt" label="Antrag gestellt am:" />
          <Fill tall name="seite2.eckdaten.bescheid" label="Bescheid vom / Ergebnis:" />
        </View>
      </View>

      <View style={s.mailBox} wrap={false}>
        <Text style={s.mailLine}>
          <B>Allgemeine Hinweise, keine Rechtsberatung.</B> Beratung u. a. bei der eigenen
          Krankenkasse oder der Unabhängigen Patientenberatung.
        </Text>
      </View>

      <Footer data={data} plz={plz} />
    </Page>
  );
}

const COLUMNS = [
  { title: "Nr.", width: 34 },
  { title: "Praxis · Adresse · Kontakt", width: 165 },
  { title: "Verfahren", width: 80 },
  { title: "Telefonzeiten (laut KV)", width: 96 },
  { title: "Tel. kontaktiert", width: 118 },
  { title: "Mail kontaktiert", width: 80 },
  { title: "Ergebnis / Wartezeit", width: 103 },
  { title: "Notizen", width: 110 },
] as const;

const [W_NR, W_PRAXIS, W_METHODS, W_HOURS, W_TEL, W_MAIL, W_RESULT, W_NOTES] = COLUMNS.map(
  (c) => c.width,
);

/** A label followed by a writing line that fills the rest of the column width. */
function Fill({
  label,
  tall,
  name,
  checkName,
}: {
  label?: string;
  tall?: boolean;
  /** Name of the text field on the line. */
  name: string;
  /** If set, a checkbox field of this name precedes the label. */
  checkName?: string;
}) {
  return (
    <View style={tall ? s.fillTall : s.fill}>
      {checkName && <Box name={checkName} />}
      {label && <Text style={s.fillLabel}>{label}</Text>}
      <View style={s.fillRule}>
        <TextField name={name} />
      </View>
    </View>
  );
}

function extrasOf(p: Practice): string {
  return [
    p.group && "Gruppe",
    p.childrenToo && "auch Kinder/Jugendl.",
    p.video && "Video",
    p.accessible && "stufenlos/Aufzug",
    ...p.languages,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PracticeRow({ item, index }: { item: PracticeWithDistance; index: number }) {
  const { practice: p, distanceKm } = item;
  const extras = extrasOf(p);
  const id = `praxis-${String(index + 1).padStart(2, "0")}`;
  return (
    <View style={s.tr} wrap={false}>
      <View style={{ ...s.td, width: W_NR }}>
        <Text style={{ fontWeight: "bold" }}>{index + 1}</Text>
        <Text style={s.extras}>{formatKm(distanceKm)}</Text>
      </View>
      <View style={{ ...s.td, width: W_PRAXIS }}>
        <Text style={s.line}>
          <B>{p.name}</B>
        </Text>
        <Text style={s.extras}>{p.role}</Text>
        <Text style={s.line}>
          {p.street}, {p.zip} Leipzig · {p.district}
        </Text>
        {p.phones.map((ph, i) => (
          <Text key={ph} style={s.line}>
            ☎ {ph}
            {i > 0 ? " (weitere Nr. lt. KV)" : ""}
          </Text>
        ))}
        <Text style={s.line}>
          ✉ {p.email ? p.email : "______"}
          {p.email && p.emailSource ? ` (Quelle: ${p.emailSource})` : ""}
        </Text>
        {p.partners.length > 0 && (
          <Text style={s.line}>In Praxis mit: {p.partners.join(", ")}</Text>
        )}
        {p.absent && (
          <Text style={s.red}>
            Laut KV abwesend von {formatDate(p.absent.from)} bis {formatDate(p.absent.to)}
          </Text>
        )}
        {p.inactiveHere && (
          <Text style={s.red}>Laut KV derzeit nicht an diesem Standort tätig</Text>
        )}
      </View>
      <View style={{ ...s.td, width: W_METHODS }}>
        <View style={s.badgeRow}>
          {p.methods.map((m) => (
            <View key={m} style={{ ...s.miniBadge, backgroundColor: COLORS[m] }}>
              <Text style={s.badge}>{m}</Text>
            </View>
          ))}
        </View>
        {extras !== "" && <Text style={s.extras}>{extras}</Text>}
      </View>
      <View style={{ ...s.td, width: W_HOURS }}>
        {p.phoneHours.length === 0 ? (
          <Text style={s.muted}>nicht hinterlegt</Text>
        ) : (
          p.phoneHours.map((h) => (
            <Text key={`${h.day}${h.from}`} style={s.line}>
              {h.day} {h.from}-{h.to}
            </Text>
          ))
        )}
        {p.phoneNote && <Text style={s.extras}>KV-Hinweis: {p.phoneNote}</Text>}
      </View>
      <View style={{ ...s.td, width: W_TEL }}>
        <Fill checkName={`${id}.tel1.kontaktiert`} name={`${id}.tel1.datum`} label="am" />
        <Fill name={`${id}.tel1.zeit`} label="um" />
        <Fill name={`${id}.tel1.mit`} label="mit:" />
        <Fill name={`${id}.tel2.datum`} label="2.: am" />
        <Fill name={`${id}.tel2.zeit`} label="um" />
        <Fill name={`${id}.tel2.mit`} label="mit:" />
      </View>
      <View style={{ ...s.td, width: W_MAIL }}>
        <Fill checkName={`${id}.mail.kontaktiert`} name={`${id}.mail.datum`} label="am" />
        <Fill name={`${id}.mail.datum2`} label="2.: am" />
      </View>
      <View style={{ ...s.td, width: W_RESULT }}>
        <Opt name={`${id}.ergebnis.absage`} label="Absage" />
        <Opt name={`${id}.ergebnis.warteliste`} label="Warteliste" />
        <Opt name={`${id}.ergebnis.erstgespraech`} label="Erstgespräch" />
        <Opt name={`${id}.ergebnis.keine-antwort`} label="keine Antwort" />
        <Text style={s.line}>Wartezeit / Termin:</Text>
        <Fill name={`${id}.wartezeit`} />
      </View>
      <View style={{ ...s.td, width: W_NOTES }}>
        <View style={s.noteBox}>
          <AreaField name={`${id}.notizen`} height={45} />
          <View style={{ ...s.noteRule, position: "absolute", top: 0, width: "100%" }} />
          <View style={{ ...s.noteRule, position: "absolute", top: 15, width: "100%" }} />
          <View style={{ ...s.noteRule, position: "absolute", top: 30, width: "100%" }} />
        </View>
      </View>
    </View>
  );
}

/** Rows per `<Page>`: react-pdf re-lays out all remaining rows at each page break (quadratic). */
const ROWS_PER_PAGE = 5;

/** Practice pages: one table row per practice, header repeated on every page. */
function PracticePages({ input }: { input: PdfInput }) {
  const { data, plz, practices } = input;
  const chunks: PracticeWithDistance[][] = [];
  for (let i = 0; i < practices.length; i += ROWS_PER_PAGE) {
    chunks.push(practices.slice(i, i + ROWS_PER_PAGE));
  }
  return (
    <>
      {chunks.map((chunk, c) => (
        <Page key={c} size="A4" orientation="landscape" style={s.page} wrap>
          <View style={s.thead} fixed>
            {COLUMNS.map((col) => (
              <Text key={col.title} style={{ ...s.th, width: col.width }}>
                {col.title}
              </Text>
            ))}
          </View>
          {chunk.map((item, i) => (
            <PracticeRow key={item.practice.id} item={item} index={c * ROWS_PER_PAGE + i} />
          ))}
          <Footer data={data} plz={plz} />
        </Page>
      ))}
    </>
  );
}

interface LogColumn {
  title: string;
  width: string;
  /** Field name part for text cells. */
  field?: string;
  /** Checkbox options (field name part, label). */
  options?: [string, string][];
}

const LOG_COLUMNS: LogColumn[] = [
  { title: "Nr.", width: "4%" },
  { title: "Datum, Uhrzeit", width: "11%", field: "datum" },
  { title: "Praxis / Therapeut:in (Name, Adresse, Telefon)", width: "24%", field: "praxis" },
  {
    title: "Kontaktweg",
    width: "13%",
    field: "weg",
    options: [
      ["telefon", "Telefon"],
      ["ab", "AB"],
      ["mail", "Mail"],
      ["persoenlich", "persönlich"],
    ],
  },
  {
    title: "Ergebnis",
    width: "15%",
    field: "ergebnis",
    options: [
      ["absage", "Absage"],
      ["warteliste", "Warteliste"],
      ["keine-antwort", "keine Antwort"],
      ["termin", "Termin"],
    ],
  },
  { title: "Wartezeit / angebotener Termin", width: "15%", field: "wartezeit" },
  { title: "Gesprächsperson / Bemerkung", width: "18%", field: "bemerkung" },
];

const LOG_FIELDS: [string, string][] = [
  ["name", "Name, Vorname"],
  ["geburtsdatum", "Geburtsdatum"],
  ["krankenkasse", "Krankenkasse"],
  ["versichertennummer", "Versichertennummer"],
];
const LOG_ROWS = 12;

/** Splits `items` into rows of `size`, so each option stays on one line with its box. */
const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

const log = StyleSheet.create({
  fields: { flexDirection: "row", marginTop: 4, marginBottom: 6 },
  field: { flex: 1, paddingRight: 10 },
  fieldLabel: { fontSize: MIN_PT, lineHeight: LH, color: "#444" },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #999", height: 29 },
  cell: { padding: 3, fontSize: MIN_PT, lineHeight: LH },
  sign: { flexDirection: "row", marginTop: 14 },
});

/** Last page: blank contact log the user fills in by hand; nothing on it is prefilled. */
function ContactLogPage({ input }: { input: PdfInput }) {
  const { data, plz } = input;
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.title}>Kontaktprotokoll Therapieplatzsuche</Text>
        <View style={s.fill}>
          <Text style={s.fillLabel}>Blatt</Text>
          <View style={{ ...s.fillRule, flexGrow: 0, flexBasis: 24, width: 24, marginRight: 3 }}>
            <TextField name="kontakt-kopf.blatt" />
          </View>
          <Text style={s.fillLabel}>– bei Bedarf mehrfach ausdrucken</Text>
        </View>
      </View>
      <View style={log.fields}>
        {LOG_FIELDS.map(([key, label]) => (
          <View key={key} style={log.field}>
            <View style={s.noteRuleTall}>
              <TextField name={`kontakt-kopf.${key}`} height={WRITE_H} />
            </View>
            <Text style={log.fieldLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={s.thead}>
        {LOG_COLUMNS.map((c) => (
          <Text key={c.title} style={{ ...s.th, width: c.width }}>
            {c.title}
          </Text>
        ))}
      </View>
      {Array.from({ length: LOG_ROWS }, (_, i) => (
        <View key={i} style={log.row} wrap={false}>
          {LOG_COLUMNS.map((c) => {
            const name = `kontakt-${String(i + 1).padStart(2, "0")}.${c.field}`;
            return (
              <View key={c.title} style={{ ...log.cell, width: c.width }}>
                {!c.field ? (
                  <Text>{String(i + 1)}</Text>
                ) : c.options ? (
                  <View>
                    {chunk(c.options, 2).map((pair) => (
                      <View key={pair[0][0]} style={{ flexDirection: "row" }}>
                        {pair.map(([key, label]) => (
                          <View key={key} style={{ ...s.opt, marginRight: 4 }} wrap={false}>
                            <Box name={`${name}.${key}`} width={9} size={5.5} />
                            <Text>{label}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : c.field === "praxis" || c.field === "wartezeit" || c.field === "bemerkung" ? (
                  <AreaField name={name} height={log.row.height - 6} />
                ) : (
                  <TextField name={name} height={log.row.height - 6} />
                )}
              </View>
            );
          })}
        </View>
      ))}
      <View style={log.sign}>
        <View style={{ flex: 1, paddingRight: 20 }}>
          <View style={s.noteRuleTall}>
            <TextField name="kontakt-fuss.ort-datum" height={WRITE_H} />
          </View>
          <Text style={log.fieldLabel}>Ort, Datum</Text>
        </View>
        <View style={{ flex: 2 }}>
          <View style={s.noteRuleTall} />
          <Text style={log.fieldLabel}>
            Unterschrift – ich versichere die Richtigkeit der Angaben
          </Text>
        </View>
      </View>
      <Footer data={data} plz={plz} />
    </Page>
  );
}

/** Builds the PDF document; separate from the UI so tests can render it. */
export function buildPdfDocument(input: PdfInput): ReactElement<DocumentProps> {
  return (
    <Document
      title={pdfTitle(input.plz)}
      creator={PDF_CREATOR}
      producer={PDF_CREATOR}
      language="de"
    >
      <OverviewPage input={input} />
      <ReimbursementPage input={input} />
      <PracticePages input={input} />
      <ContactLogPage input={input} />
    </Document>
  );
}
