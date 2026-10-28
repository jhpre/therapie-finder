// Test-only helper: never import this from app code.
import type { Method, Practice, PhoneHour, Weekday } from "../data/types";

/** Small deterministic PRNG (mulberry32), so the generated list is identical on every run. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Erika", "Max", "Anna-Katharina", "Jan", "Sabine", "Tobias", "Mehmet", "Olga"];
const LAST = [
  "Beispiel",
  "Mustermann",
  "Musterfrau",
  "Testmann-Beispielhausen",
  "Fiktivus",
  "Platzhalter-Nachname-Doppelbarrel",
];
const TITLES = ["Dipl.-Psych.", "Dr. med.", "Dr. rer. nat. Dipl.-Psych.", "M.Sc. Psych."];
const ROLES = [
  "Psychologische Psychotherapeutin",
  "Psychologischer Psychotherapeut",
  "Ärztliche Psychotherapeutin",
  "Kinder- und Jugendlichenpsychotherapeut",
];
const DISTRICTS = ["Mitte", "Connewitz", "Gohlis", "Plagwitz", "Anger-Crottendorf", "Lindenau"];
const DAYS: Weekday[] = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const METHODS: Method[] = ["VT", "TP", "AP", "ST"];

/**
 * Generates `count` fictional practices around Leipzig (51.34 N, 12.37 E), deterministic for a
 * given seed. Names are unique ("... (001)") and mixed in length; some entries have 3 phone
 * numbers, 6 phone-hour lines, no email, an absence or an inactive location.
 */
export function generatePractices(count = 350, seed = 20): Practice[] {
  const rnd = mulberry32(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    const long = i % 7 === 0;
    const phones = Array.from(
      { length: i % 5 === 0 ? 3 : 1 },
      (_, k) => `0341 ${String(1000000 + i * 3 + k)}`,
    );
    const hourCount = i % 6 === 0 ? 6 : i % 11 === 0 ? 0 : 1 + (i % 3);
    const phoneHours: PhoneHour[] = Array.from({ length: hourCount }, (_, k) => ({
      day: DAYS[k % DAYS.length],
      from: `${String(8 + k).padStart(2, "0")}:00`,
      to: `${String(8 + k).padStart(2, "0")}:50`,
    }));
    const methods = METHODS.filter((_, k) => k === i % 4 || rnd() < 0.2);
    const p: Practice = {
      id: `gen-${n}`,
      name: `${pick(TITLES)} ${pick(FIRST)} ${long ? "Platzhalter-Nachname-Doppelbarrel" : pick(LAST)} (${n})`,
      role: pick(ROLES),
      street: `Beispielstraße ${1 + (i % 120)}`,
      zip: `041${String(i % 100).padStart(2, "0")}`,
      district: pick(DISTRICTS),
      phones,
      methods,
      group: rnd() < 0.3,
      video: rnd() < 0.4,
      accessible: rnd() < 0.5,
      languages: rnd() < 0.2 ? ["Englisch", "Russisch"] : [],
      childrenToo: rnd() < 0.3,
      phoneHours,
      inactiveHere: i % 13 === 0,
      partners: i % 9 === 0 ? ["Fiktiver Partner", "Zweite Fiktive Partnerin"] : [],
      location: { lat: 51.34 + (rnd() - 0.5) * 0.12, lon: 12.37 + (rnd() - 0.5) * 0.2 },
    };
    if (i % 4 !== 0) p.email = `praxis-${n}@example.invalid`;
    if (i % 4 === 1) p.emailSource = "beispiel-website.invalid";
    if (i % 17 === 0)
      p.phoneNote = "Nur nach Vereinbarung erreichbar, bitte Nachricht hinterlassen.";
    if (i % 10 === 3) p.absent = { from: "2026-11-02", to: "2026-11-27" };
    return p;
  });
}
