import type { CountryCrisisResources, Helpline } from "./crisis.js";

/**
 * The one entry every seeker gets, wherever they are.
 *
 * Throughline's directory covers 130+ countries, is translated, and is
 * maintained by an organisation whose entire purpose is keeping it current —
 * which is more than this file can honestly claim. It is the fallback for
 * countries we do not list and a companion to the ones we do.
 */
export const INTERNATIONAL_DIRECTORY: Helpline = {
  name: "Find A Helpline",
  contact: "findahelpline.com",
  url: "https://findahelpline.com",
  note: "Free, confidential support in 130+ countries",
};

/**
 * Verified per-country crisis resources, keyed by ISO 3166-1 alpha-2.
 *
 * ## Before you edit this file
 *
 * Every number here is something a frightened person will dial. Treat a
 * change like a change to production credentials:
 *
 *   - Verify against the operator's own site, not a search result summary.
 *   - Prefer a national line over a regional one. Prefer free over charged.
 *   - Set `verifiedOn` to the date *you* checked, not the date you copied.
 *   - Adding a country is better than guessing one. Leaving a country out is
 *     better than adding it wrong — every seeker gets the international
 *     directory regardless, so an omission degrades gracefully and an error
 *     does not.
 *
 * ## What is deliberately absent
 *
 * Countries where discussing conversion carries legal or physical risk are
 * not listed, and that is a decision rather than a gap. Directing someone in
 * that position to a state-operated line, moments after a conversation about
 * faith, could put them in front of exactly the authority they are hiding
 * from. The international directory lets them choose for themselves.
 *
 * If your ministry has verified partners in those regions, add them — a
 * trusted local number from someone who knows the ground beats anything a
 * general directory can offer.
 */
export const CRISIS_DIRECTORY: Readonly<Record<string, CountryCrisisResources>> = {
  AR: {
    country: "AR",
    emergency: "911",
    helplines: [
      { name: "Línea 135", contact: "135", note: "Buenos Aires and surrounds" },
      { name: "Salud Mental Responde", contact: "0800 345 1435" },
    ],
    verifiedOn: "2026-08-28",
  },
  AU: {
    country: "AU",
    emergency: "000",
    helplines: [
      { name: "Lifeline", contact: "13 11 14", url: "https://www.lifeline.org.au", note: "24/7" },
      { name: "Beyond Blue", contact: "1300 22 4636", url: "https://www.beyondblue.org.au" },
    ],
    verifiedOn: "2026-08-28",
  },
  BE: {
    country: "BE",
    emergency: "112",
    helplines: [
      { name: "Zelfmoordlijn 1813", contact: "1813", url: "https://www.zelfmoord1813.be" },
      { name: "Centre de Prévention du Suicide", contact: "0800 32 123" },
    ],
    verifiedOn: "2026-08-28",
  },
  BR: {
    country: "BR",
    emergency: "192",
    helplines: [
      { name: "CVV — Centro de Valorização da Vida", contact: "188", url: "https://www.cvv.org.br", note: "24 horas" },
    ],
    verifiedOn: "2026-08-28",
  },
  CA: {
    country: "CA",
    emergency: "911",
    helplines: [
      { name: "9-8-8 Suicide Crisis Helpline", contact: "988", url: "https://988.ca", note: "Call or text, 24/7, English and French" },
    ],
    verifiedOn: "2026-08-28",
  },
  DE: {
    country: "DE",
    emergency: "112",
    helplines: [
      { name: "Telefonseelsorge", contact: "0800 111 0 111", url: "https://www.telefonseelsorge.de", note: "Kostenlos, rund um die Uhr" },
      { name: "Telefonseelsorge", contact: "0800 111 0 222" },
    ],
    verifiedOn: "2026-08-28",
  },
  DK: {
    country: "DK",
    emergency: "112",
    helplines: [
      { name: "Livslinien", contact: "70 201 201", url: "https://www.livslinien.dk" },
    ],
    verifiedOn: "2026-08-28",
  },
  ES: {
    country: "ES",
    emergency: "112",
    helplines: [
      { name: "Línea 024", contact: "024", note: "Atención a la conducta suicida, 24 horas" },
      { name: "Teléfono de la Esperanza", contact: "717 003 717" },
    ],
    verifiedOn: "2026-08-28",
  },
  FI: {
    country: "FI",
    emergency: "112",
    helplines: [
      { name: "MIELI Kriisipuhelin", contact: "09 2525 0111", url: "https://mieli.fi" },
    ],
    verifiedOn: "2026-08-28",
  },
  FR: {
    country: "FR",
    emergency: "112",
    helplines: [
      { name: "3114 — Numéro national de prévention du suicide", contact: "3114", url: "https://3114.fr", note: "Gratuit, 24h/24" },
    ],
    verifiedOn: "2026-08-28",
  },
  GB: {
    country: "GB",
    emergency: "999",
    helplines: [
      { name: "Samaritans", contact: "116 123", url: "https://www.samaritans.org", note: "Free, 24/7" },
      { name: "Shout", contact: "Text SHOUT to 85258", url: "https://giveusashout.org" },
    ],
    verifiedOn: "2026-08-28",
  },
  HK: {
    country: "HK",
    emergency: "999",
    helplines: [
      { name: "The Samaritan Befrienders Hong Kong", contact: "2389 2222", url: "https://sbhk.org.hk" },
    ],
    verifiedOn: "2026-08-28",
  },
  IE: {
    country: "IE",
    emergency: "112",
    helplines: [
      { name: "Samaritans", contact: "116 123", url: "https://www.samaritans.org", note: "Free, 24/7" },
      { name: "Text About It", contact: "Text HELLO to 50808" },
    ],
    verifiedOn: "2026-08-28",
  },
  IN: {
    country: "IN",
    emergency: "112",
    helplines: [
      { name: "Tele-MANAS", contact: "14416", note: "Government mental health helpline, many languages" },
      { name: "Tele-MANAS", contact: "1800 891 4416" },
    ],
    verifiedOn: "2026-08-28",
  },
  IT: {
    country: "IT",
    emergency: "112",
    helplines: [
      { name: "Telefono Amico Italia", contact: "02 2327 2327", url: "https://www.telefonoamico.it" },
    ],
    verifiedOn: "2026-08-28",
  },
  JP: {
    country: "JP",
    emergency: "119",
    helplines: [
      { name: "よりそいホットライン", contact: "0120-279-338", note: "24時間、通話無料" },
      { name: "TELL Lifeline", contact: "03-5774-0992", url: "https://telljp.com", note: "English" },
    ],
    verifiedOn: "2026-08-28",
  },
  MX: {
    country: "MX",
    emergency: "911",
    helplines: [
      { name: "Línea de la Vida", contact: "800 911 2000", note: "24 horas" },
    ],
    verifiedOn: "2026-08-28",
  },
  MY: {
    country: "MY",
    emergency: "999",
    helplines: [
      { name: "Befrienders Kuala Lumpur", contact: "03-7627 2929", url: "https://www.befrienders.org.my" },
    ],
    verifiedOn: "2026-08-28",
  },
  NL: {
    country: "NL",
    emergency: "112",
    helplines: [
      { name: "113 Zelfmoordpreventie", contact: "113", url: "https://www.113.nl" },
      { name: "113 Zelfmoordpreventie", contact: "0800 0113", note: "Gratis" },
    ],
    verifiedOn: "2026-08-28",
  },
  NO: {
    country: "NO",
    emergency: "113",
    helplines: [
      { name: "Mental Helse Hjelpetelefonen", contact: "116 123", url: "https://mentalhelse.no" },
    ],
    verifiedOn: "2026-08-28",
  },
  NZ: {
    country: "NZ",
    emergency: "111",
    helplines: [
      { name: "1737 Need to Talk?", contact: "1737", url: "https://1737.org.nz", note: "Call or text, free, 24/7" },
    ],
    verifiedOn: "2026-08-28",
  },
  PH: {
    country: "PH",
    emergency: "911",
    helplines: [
      { name: "NCMH Crisis Hotline", contact: "1553", note: "Toll-free nationwide" },
    ],
    verifiedOn: "2026-08-28",
  },
  PL: {
    country: "PL",
    emergency: "112",
    helplines: [
      { name: "Kryzysowy Telefon Zaufania", contact: "116 123" },
      { name: "Telefon zaufania dla dzieci i młodzieży", contact: "116 111" },
    ],
    verifiedOn: "2026-08-28",
  },
  PT: {
    country: "PT",
    emergency: "112",
    helplines: [
      { name: "SNS 24", contact: "808 24 24 24" },
      { name: "Voz de Apoio", contact: "225 50 60 70" },
    ],
    verifiedOn: "2026-08-28",
  },
  SE: {
    country: "SE",
    emergency: "112",
    helplines: [
      { name: "Mind Självmordslinjen", contact: "90101", url: "https://mind.se" },
    ],
    verifiedOn: "2026-08-28",
  },
  SG: {
    country: "SG",
    emergency: "999",
    helplines: [
      { name: "Samaritans of Singapore", contact: "1767", url: "https://www.sos.org.sg", note: "24/7" },
    ],
    verifiedOn: "2026-08-28",
  },
  UA: {
    country: "UA",
    emergency: "112",
    helplines: [
      { name: "Lifeline Ukraine", contact: "7333", url: "https://lifelineukraine.com", note: "Цілодобово" },
    ],
    verifiedOn: "2026-08-28",
  },
  US: {
    country: "US",
    emergency: "911",
    helplines: [
      { name: "988 Suicide & Crisis Lifeline", contact: "988", url: "https://988lifeline.org", note: "Call or text, 24/7, English and Spanish" },
      { name: "Crisis Text Line", contact: "Text HOME to 741741", url: "https://www.crisistextline.org" },
    ],
    verifiedOn: "2026-08-28",
  },
  ZA: {
    country: "ZA",
    emergency: "112",
    helplines: [
      { name: "SADAG Suicide Crisis Line", contact: "0800 567 567", url: "https://www.sadag.org" },
    ],
    verifiedOn: "2026-08-28",
  },
};
