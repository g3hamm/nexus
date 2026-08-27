import type { Glossary, GlossaryEntry } from "@nexus/core";

/**
 * Christian vocabulary that general-purpose translation reliably damages.
 *
 * Each entry exists because of a specific, observed failure mode, recorded in
 * `avoid`. Two of them are not stylistic at all but load-bearing:
 *
 *   - "born again" calques into reincarnation across South and East Asian
 *     languages, which changes the claim entirely.
 *   - "Son of God" renders in Arabic and other languages of the Muslim world
 *     as biological offspring, which is not what Christians mean and is
 *     understood as blasphemy by the listener. Getting this wrong does not
 *     produce an awkward sentence; it ends the conversation.
 *
 * `senses` carries reviewed per-language renderings. It is deliberately sparse:
 * only entries a native speaker has confirmed belong here. Everything else
 * relies on `christianSense` and `avoid`, which the model applies to whatever
 * language it is working in. An empty `senses` is honest; a fabricated one is
 * worse than nothing.
 */
export const CHRISTIAN_GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: "faith",
    christianSense:
      "Trust and reliance on God, including faithfulness over time. A relationship, not a proposition held without evidence.",
    avoid: "Rendering as mere optimism, a hunch, or 'belief without evidence'.",
    senses: { es: "fe", fr: "foi", pt: "fé" },
  },
  {
    term: "grace",
    christianSense:
      "God's unearned favour and active kindness toward people who have not earned it.",
    avoid: "Rendering as elegance, gracefulness, or a grace period on a debt.",
    senses: { es: "gracia", fr: "grâce", pt: "graça" },
  },
  {
    term: "spirit",
    christianSense:
      "When capitalised or in context, the Holy Spirit — a person of the Trinity, not an impersonal force.",
    avoid: "Rendering as mood, morale, ghost, spirit of the dead, or energy.",
    senses: { es: "Espíritu", fr: "Esprit", pt: "Espírito" },
  },
  {
    term: "Word",
    christianSense:
      "Either Christ himself (the Logos of John 1) or the Scriptures. Capitalised, it is a title.",
    avoid: "Rendering as a vocabulary item or 'a message'.",
    senses: { es: "Verbo", fr: "Verbe", pt: "Verbo" },
  },
  {
    term: "born again",
    christianSense:
      "A spiritual rebirth into new life through Christ, happening once, in this life.",
    avoid:
      "Any rendering that suggests reincarnation or rebirth into another body or life. This is the single most damaging mistranslation in South and East Asian languages — prefer a phrase like 'born from above' or 'given new life by God' where the local word for rebirth carries reincarnation freight.",
    senses: {},
  },
  {
    term: "Son of God",
    christianSense:
      "A title expressing Christ's eternal relationship to the Father. It is a statement about shared divine nature, not about physical procreation.",
    avoid:
      "Any rendering implying God fathered a child biologically. In Arabic and other languages of the Muslim world this reads as blasphemy and will be heard as an insult rather than a claim. Where the natural word carries that sense, render the relationship rather than the biology, and be prepared to explain it.",
    senses: {},
  },
  {
    term: "salvation",
    christianSense:
      "Rescue and deliverance by God from sin and death into life with him.",
    avoid: "Rendering as physical safety, financial bailout, or self-improvement.",
    senses: { es: "salvación", fr: "salut", pt: "salvação" },
  },
  {
    term: "sin",
    christianSense:
      "A wrong against God that damages the relationship — a condition of the heart as much as an act.",
    avoid: "Rendering as crime, taboo, social shame, or mere mistake.",
    senses: { es: "pecado", fr: "péché", pt: "pecado" },
  },
  {
    term: "repentance",
    christianSense:
      "A turning of the whole person — mind, will, direction — back toward God. Change, not just remorse.",
    avoid: "Rendering as regret, guilt, penance, or ritual atonement.",
    senses: { es: "arrepentimiento", fr: "repentance", pt: "arrependimento" },
  },
  {
    term: "Lord",
    christianSense:
      "A divine title for God and for Jesus, expressing rightful authority.",
    avoid: "Rendering as landlord, feudal master, sir, or an aristocratic rank.",
    senses: { es: "Señor", fr: "Seigneur", pt: "Senhor" },
  },
  {
    term: "gospel",
    christianSense: "The good news of what God has done in Jesus Christ.",
    avoid: "Rendering as 'absolute truth' (as in 'gospel truth') or as a music genre.",
    senses: { es: "evangelio", fr: "évangile", pt: "evangelho" },
  },
  {
    term: "church",
    christianSense: "The people who belong to Christ, locally and worldwide.",
    avoid: "Rendering only as a building, or as a denomination's head office.",
    senses: { es: "iglesia", fr: "église", pt: "igreja" },
  },
  {
    term: "blessed",
    christianSense: "Flourishing because one stands in God's favour.",
    avoid: "Rendering as lucky, fortunate by chance, or wealthy.",
    senses: { es: "bienaventurado", fr: "bienheureux", pt: "bem-aventurado" },
  },
  {
    term: "love",
    christianSense:
      "In most Christian usage, agape: deliberate, self-giving commitment to another's good, independent of feeling.",
    avoid:
      "Collapsing into romantic or erotic love where the language distinguishes them.",
    senses: { es: "amor", fr: "amour", pt: "amor" },
  },
  {
    term: "righteousness",
    christianSense: "Being in right standing and right relationship with God.",
    avoid: "Rendering as self-righteousness, moral superiority, or legal innocence.",
    senses: { es: "justicia", fr: "justice", pt: "justiça" },
  },
  {
    term: "redemption",
    christianSense: "Being bought back and set free at cost to the one who paid.",
    avoid: "Rendering as compensation, a refund, a coupon, or reputation repair.",
    senses: { es: "redención", fr: "rédemption", pt: "redenção" },
  },
  {
    term: "flesh",
    christianSense: "Human nature turned in on itself and away from God.",
    avoid: "Rendering as meat, skin, or sexuality specifically.",
    senses: { es: "carne", fr: "chair", pt: "carne" },
  },
  {
    term: "world",
    christianSense:
      "Often the human order organised against God, rather than the planet or its people.",
    avoid: "Rendering as Earth or humanity when the sense is the fallen order.",
    senses: {},
  },
  {
    term: "glory",
    christianSense: "The weight, radiance, and manifest worth of God.",
    avoid: "Rendering as fame, celebrity, or military honour.",
    senses: { es: "gloria", fr: "gloire", pt: "glória" },
  },
  {
    term: "mercy",
    christianSense:
      "God withholding deserved judgement and acting with compassion instead.",
    avoid: "Rendering as pity, condescension, or leniency by a judge.",
    senses: { es: "misericordia", fr: "miséricorde", pt: "misericórdia" },
  },
  {
    term: "covenant",
    christianSense: "A binding, relational promise God initiates and keeps.",
    avoid: "Rendering as a commercial contract or a legal clause.",
    senses: { es: "pacto", fr: "alliance", pt: "aliança" },
  },
  {
    term: "hope",
    christianSense: "Confident expectation grounded in God's character and promises.",
    avoid: "Rendering as wishing, or as uncertainty about the outcome.",
    senses: { es: "esperanza", fr: "espérance", pt: "esperança" },
  },
  {
    term: "peace",
    christianSense:
      "Wholeness and restored relationship — the Hebrew shalom — not merely the absence of conflict.",
    avoid: "Rendering only as ceasefire, quiet, or calm.",
    senses: { es: "paz", fr: "paix", pt: "paz" },
  },
  {
    term: "disciple",
    christianSense:
      "An apprentice who learns by following and imitating a master's whole life.",
    avoid: "Rendering as a fan, a subscriber, or a sect member.",
    senses: { es: "discípulo", fr: "disciple", pt: "discípulo" },
  },
  {
    term: "testimony",
    christianSense: "A personal account of what God has done in someone's life.",
    avoid: "Rendering as courtroom evidence or a product review.",
    senses: { es: "testimonio", fr: "témoignage", pt: "testemunho" },
  },
  {
    term: "Christ",
    christianSense: "A title — the Anointed One, the Messiah. Not a surname.",
    avoid: "Treating it as Jesus's family name.",
    senses: { es: "Cristo", fr: "Christ", pt: "Cristo" },
  },
];

class ChristianGlossary implements Glossary {
  readonly entries: readonly GlossaryEntry[];
  readonly #patterns: readonly { entry: GlossaryEntry; pattern: RegExp }[];

  constructor(entries: readonly GlossaryEntry[]) {
    this.entries = entries;
    this.#patterns = entries.map((entry) => ({
      entry,
      // Word-boundary match so "sin" does not fire on "sincere".
      pattern: new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, "i"),
    }));
  }

  match(text: string): readonly GlossaryEntry[] {
    return this.#patterns.filter((p) => p.pattern.test(text)).map((p) => p.entry);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CHRISTIAN_GLOSSARY: Glossary = new ChristianGlossary(
  CHRISTIAN_GLOSSARY_ENTRIES,
);
