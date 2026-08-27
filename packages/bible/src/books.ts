/**
 * Book names, in the languages Nexus can currently detect.
 *
 * Keys are OSIS identifiers, which is what makes "Juan 3:16", "Jean 3:16" and
 * "John 3:16" resolve to the same reference and become lookupable in any
 * translation. Detection runs against the *original* text of a message, so a
 * reference keeps working in the language it was typed in.
 *
 * English, Spanish, Portuguese and French are covered. That is not the world,
 * and it is deliberately not pretending to be: adding a language means a
 * native speaker supplying the names and the abbreviations people actually
 * write, which is their work rather than a guess. Same discipline as the
 * translation glossary — a fabricated entry is worse than a missing one.
 */
export interface BookNames {
  /** Canonical display name in English. */
  readonly english: string;
  /** Every spelling and abbreviation that should resolve to this book. */
  readonly aliases: readonly string[];
  /** Chapters in the book, used to reject impossible references. */
  readonly chapters: number;
}

export const BOOKS: Readonly<Record<string, BookNames>> = {
  // ── Old Testament ─────────────────────────────────────────────────────
  Gen: {
    english: "Genesis",
    chapters: 50,
    aliases: ["genesis", "gen", "gn", "génesis", "genese", "gênesis", "genèse"],
  },
  Exod: {
    english: "Exodus",
    chapters: 40,
    aliases: ["exodus", "exod", "exo", "ex", "éxodo", "exodo", "êxodo", "exode"],
  },
  Lev: {
    english: "Leviticus",
    chapters: 27,
    aliases: ["leviticus", "lev", "lv", "levítico", "levitico", "lévitique"],
  },
  Num: {
    english: "Numbers",
    chapters: 36,
    aliases: ["numbers", "num", "nm", "números", "numeros", "nombres"],
  },
  Deut: {
    english: "Deuteronomy",
    chapters: 34,
    aliases: ["deuteronomy", "deut", "dt", "deuteronomio", "deuteronômio", "deutéronome"],
  },
  Josh: {
    english: "Joshua",
    chapters: 24,
    aliases: ["joshua", "josh", "jos", "josué", "josue"],
  },
  Judg: {
    english: "Judges",
    chapters: 21,
    aliases: ["judges", "judg", "jdg", "jueces", "juízes", "juizes", "juges"],
  },
  Ruth: { english: "Ruth", chapters: 4, aliases: ["ruth", "rut", "rt"] },
  "1Sam": {
    english: "1 Samuel",
    chapters: 31,
    aliases: ["1 samuel", "1samuel", "1 sam", "1sam", "1 sm", "1sm", "i samuel"],
  },
  "2Sam": {
    english: "2 Samuel",
    chapters: 24,
    aliases: ["2 samuel", "2samuel", "2 sam", "2sam", "2 sm", "2sm", "ii samuel"],
  },
  "1Kgs": {
    english: "1 Kings",
    chapters: 22,
    aliases: [
      "1 kings",
      "1kings",
      "1 kgs",
      "1kgs",
      "1 reyes",
      "1reyes",
      "1 reis",
      "1 rois",
    ],
  },
  "2Kgs": {
    english: "2 Kings",
    chapters: 25,
    aliases: [
      "2 kings",
      "2kings",
      "2 kgs",
      "2kgs",
      "2 reyes",
      "2reyes",
      "2 reis",
      "2 rois",
    ],
  },
  "1Chr": {
    english: "1 Chronicles",
    chapters: 29,
    aliases: [
      "1 chronicles",
      "1 chr",
      "1chr",
      "1 crónicas",
      "1 cronicas",
      "1 crônicas",
      "1 chroniques",
    ],
  },
  "2Chr": {
    english: "2 Chronicles",
    chapters: 36,
    aliases: [
      "2 chronicles",
      "2 chr",
      "2chr",
      "2 crónicas",
      "2 cronicas",
      "2 crônicas",
      "2 chroniques",
    ],
  },
  Ezra: { english: "Ezra", chapters: 10, aliases: ["ezra", "esdras", "esd"] },
  Neh: {
    english: "Nehemiah",
    chapters: 13,
    aliases: ["nehemiah", "neh", "nehemías", "nehemias", "néhémie"],
  },
  Esth: { english: "Esther", chapters: 10, aliases: ["esther", "esth", "ester", "est"] },
  Job: { english: "Job", chapters: 42, aliases: ["job", "jó"] },
  Ps: {
    english: "Psalms",
    chapters: 150,
    aliases: [
      "psalms",
      "psalm",
      "pss",
      "ps",
      "psa",
      "salmos",
      "salmo",
      "sal",
      "psaumes",
      "psaume",
    ],
  },
  Prov: {
    english: "Proverbs",
    chapters: 31,
    aliases: ["proverbs", "prov", "pr", "proverbios", "provérbios", "proverbes"],
  },
  Eccl: {
    english: "Ecclesiastes",
    chapters: 12,
    aliases: ["ecclesiastes", "eccl", "ec", "eclesiastés", "eclesiastes", "ecclésiaste"],
  },
  Song: {
    english: "Song of Solomon",
    chapters: 8,
    aliases: [
      "song of solomon",
      "song of songs",
      "song",
      "cantares",
      "cânticos",
      "canticos",
      "cantique des cantiques",
    ],
  },
  Isa: {
    english: "Isaiah",
    chapters: 66,
    aliases: ["isaiah", "isa", "is", "isaías", "isaias", "ésaïe", "esaie"],
  },
  Jer: {
    english: "Jeremiah",
    chapters: 52,
    aliases: ["jeremiah", "jer", "jr", "jeremías", "jeremias", "jérémie"],
  },
  Lam: {
    english: "Lamentations",
    chapters: 5,
    aliases: ["lamentations", "lam", "lamentaciones", "lamentações", "lamentacoes"],
  },
  Ezek: {
    english: "Ezekiel",
    chapters: 48,
    aliases: ["ezekiel", "ezek", "eze", "ez", "ezequiel", "ézéchiel"],
  },
  Dan: { english: "Daniel", chapters: 12, aliases: ["daniel", "dan", "dn"] },
  Hos: {
    english: "Hosea",
    chapters: 14,
    aliases: ["hosea", "hos", "oseas", "oséias", "oseias", "osée"],
  },
  Joel: { english: "Joel", chapters: 3, aliases: ["joel", "jl", "joël"] },
  Amos: { english: "Amos", chapters: 9, aliases: ["amos", "am", "amós"] },
  Obad: {
    english: "Obadiah",
    chapters: 1,
    aliases: ["obadiah", "obad", "abdías", "abdias", "abdias"],
  },
  Jonah: { english: "Jonah", chapters: 4, aliases: ["jonah", "jon", "jonás", "jonas"] },
  Mic: {
    english: "Micah",
    chapters: 7,
    aliases: ["micah", "mic", "miqueas", "miquéias", "miqueias", "michée"],
  },
  Nah: { english: "Nahum", chapters: 3, aliases: ["nahum", "nah", "naum", "naüm"] },
  Hab: {
    english: "Habakkuk",
    chapters: 3,
    aliases: ["habakkuk", "hab", "habacuc", "habacuque"],
  },
  Zeph: {
    english: "Zephaniah",
    chapters: 3,
    aliases: ["zephaniah", "zeph", "sofonías", "sofonias", "sophonie"],
  },
  Hag: {
    english: "Haggai",
    chapters: 2,
    aliases: ["haggai", "hag", "ageo", "ageu", "aggée"],
  },
  Zech: {
    english: "Zechariah",
    chapters: 14,
    aliases: ["zechariah", "zech", "zac", "zacarías", "zacarias", "zacharie"],
  },
  Mal: {
    english: "Malachi",
    chapters: 4,
    aliases: ["malachi", "mal", "malaquías", "malaquias", "malachie"],
  },

  // ── New Testament ─────────────────────────────────────────────────────
  Matt: {
    english: "Matthew",
    chapters: 28,
    aliases: ["matthew", "matt", "mat", "mt", "mateo", "mateus", "matthieu"],
  },
  Mark: {
    english: "Mark",
    chapters: 16,
    aliases: ["mark", "mk", "mr", "marcos", "marc"],
  },
  Luke: { english: "Luke", chapters: 24, aliases: ["luke", "lk", "lc", "lucas", "luc"] },
  John: {
    english: "John",
    chapters: 21,
    aliases: ["john", "jn", "juan", "joão", "joao", "jean"],
  },
  Acts: {
    english: "Acts",
    chapters: 28,
    aliases: ["acts", "act", "hechos", "atos", "actes"],
  },
  Rom: {
    english: "Romans",
    chapters: 16,
    aliases: ["romans", "rom", "rm", "romanos", "romains"],
  },
  "1Cor": {
    english: "1 Corinthians",
    chapters: 16,
    aliases: [
      "1 corinthians",
      "1corinthians",
      "1 cor",
      "1cor",
      "1 co",
      "1co",
      "i corinthians",
      "1 corintios",
      "1 coríntios",
      "1 corinthiens",
    ],
  },
  "2Cor": {
    english: "2 Corinthians",
    chapters: 13,
    aliases: [
      "2 corinthians",
      "2corinthians",
      "2 cor",
      "2cor",
      "2 co",
      "2co",
      "ii corinthians",
      "2 corintios",
      "2 coríntios",
      "2 corinthiens",
    ],
  },
  Gal: {
    english: "Galatians",
    chapters: 6,
    aliases: ["galatians", "gal", "gl", "gálatas", "galatas", "galates"],
  },
  Eph: {
    english: "Ephesians",
    chapters: 6,
    aliases: ["ephesians", "eph", "ef", "efesios", "efésios", "éphésiens"],
  },
  Phil: {
    english: "Philippians",
    chapters: 4,
    aliases: ["philippians", "phil", "php", "filipenses", "philippiens"],
  },
  Col: {
    english: "Colossians",
    chapters: 4,
    aliases: ["colossians", "col", "cl", "colosenses", "colossenses", "colossiens"],
  },
  "1Thess": {
    english: "1 Thessalonians",
    chapters: 5,
    aliases: [
      "1 thessalonians",
      "1 thess",
      "1thess",
      "1 ts",
      "1ts",
      "1 tesalonicenses",
      "1 tessalonicenses",
      "1 thessaloniciens",
    ],
  },
  "2Thess": {
    english: "2 Thessalonians",
    chapters: 3,
    aliases: [
      "2 thessalonians",
      "2 thess",
      "2thess",
      "2 ts",
      "2ts",
      "2 tesalonicenses",
      "2 tessalonicenses",
      "2 thessaloniciens",
    ],
  },
  "1Tim": {
    english: "1 Timothy",
    chapters: 6,
    aliases: [
      "1 timothy",
      "1 tim",
      "1tim",
      "1 tm",
      "1tm",
      "1 timoteo",
      "1 timóteo",
      "1 timothée",
    ],
  },
  "2Tim": {
    english: "2 Timothy",
    chapters: 4,
    aliases: [
      "2 timothy",
      "2 tim",
      "2tim",
      "2 tm",
      "2tm",
      "2 timoteo",
      "2 timóteo",
      "2 timothée",
    ],
  },
  Titus: { english: "Titus", chapters: 3, aliases: ["titus", "tit", "tito", "tite"] },
  Phlm: {
    english: "Philemon",
    chapters: 1,
    aliases: ["philemon", "phlm", "filemón", "filemon", "filemom", "philémon"],
  },
  Heb: {
    english: "Hebrews",
    chapters: 13,
    aliases: ["hebrews", "heb", "hb", "hebreos", "hebreus", "hébreux"],
  },
  Jas: {
    english: "James",
    chapters: 5,
    aliases: ["james", "jas", "jam", "santiago", "tiago", "jacques"],
  },
  "1Pet": {
    english: "1 Peter",
    chapters: 5,
    aliases: ["1 peter", "1 pet", "1pet", "1 pe", "1pe", "1 pedro", "1 pierre"],
  },
  "2Pet": {
    english: "2 Peter",
    chapters: 3,
    aliases: ["2 peter", "2 pet", "2pet", "2 pe", "2pe", "2 pedro", "2 pierre"],
  },
  "1John": {
    english: "1 John",
    chapters: 5,
    aliases: ["1 john", "1john", "1 jn", "1jn", "1 juan", "1 joão", "1 joao", "1 jean"],
  },
  "2John": {
    english: "2 John",
    chapters: 1,
    aliases: ["2 john", "2john", "2 jn", "2jn", "2 juan", "2 joão", "2 joao", "2 jean"],
  },
  "3John": {
    english: "3 John",
    chapters: 1,
    aliases: ["3 john", "3john", "3 jn", "3jn", "3 juan", "3 joão", "3 joao", "3 jean"],
  },
  Jude: { english: "Jude", chapters: 1, aliases: ["jude", "judas"] },
  Rev: {
    english: "Revelation",
    chapters: 22,
    aliases: [
      "revelation",
      "revelations",
      "rev",
      "rv",
      "apocalipsis",
      "apocalipse",
      "apocalypse",
    ],
  },
};

/** Alias (lowercased, accents intact) to OSIS id. Built once. */
const ALIAS_INDEX: ReadonlyMap<string, string> = (() => {
  const index = new Map<string, string>();
  for (const [osis, book] of Object.entries(BOOKS)) {
    index.set(osis.toLowerCase(), osis);
    for (const alias of book.aliases) index.set(alias, osis);
  }
  return index;
})();

/** Longest first, so "1 John" wins over "John" when both could match. */
export const ALIASES_BY_LENGTH: readonly string[] = [...ALIAS_INDEX.keys()].sort(
  (a, b) => b.length - a.length,
);

export function osisFor(alias: string): string | null {
  return ALIAS_INDEX.get(normalise(alias)) ?? null;
}

/** Lowercase and collapse whitespace. Accents are kept — they disambiguate. */
export function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function chaptersIn(osis: string): number | null {
  return BOOKS[osis]?.chapters ?? null;
}

export function englishName(osis: string): string {
  return BOOKS[osis]?.english ?? osis;
}
