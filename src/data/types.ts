import type { LatLon } from "../lib/distance";

/** Therapy methods as listed by the KV: Verhaltenstherapie, tiefenpsychologisch, analytisch, systemisch. */
export type Method = "VT" | "TP" | "AP" | "ST";
export type Weekday = "Mo" | "Di" | "Mi" | "Do" | "Fr" | "Sa";

export interface PhoneHour {
  day: Weekday;
  from: string; // "09:00"
  to: string; // "09:50"
}

/** One psychotherapist at one location (the same person at two locations = two entries). */
export interface Practice {
  id: string;
  name: string; // incl. academic title, e.g. "Dipl.-Psych. Erika Beispiel"
  role: string; // e.g. "Psychologische Psychotherapeutin"
  street: string;
  zip: string;
  district: string;
  phones: string[];
  email?: string;
  emailSource?: string; // set when the email is not from the KV data
  methods: Method[];
  group: boolean;
  video: boolean;
  accessible: boolean;
  languages: string[];
  childrenToo: boolean;
  phoneHours: PhoneHour[];
  phoneNote?: string;
  absent?: { from: string; to: string }; // ISO dates
  inactiveHere: boolean;
  partners: string[];
  location: LatLon;
}

export interface PracticeData {
  source: string;
  asOf: string; // ISO date of the data ("Stand")
  practices: Practice[];
}
