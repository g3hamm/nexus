/**
 * @nexus/bible — scripture lookup and in-message reference detection.
 *
 * Three providers behind one port, tried widest-coverage first: API.Bible for
 * the long tail of languages, then a ministry's own loaded translations, then
 * the World English Bible shipped in this package as the floor that cannot go
 * down. See ADR 6 for the licensing constraints — only public-domain text may
 * be self-hosted, and the loader refuses anything not explicitly marked as
 * such.
 */
export { BOOKS, osisFor, englishName, chaptersIn, normalise } from "./books.js";
export { PatternReferenceDetector, referenceDetector } from "./detector.js";
export { DatabaseBibleProvider } from "./database-provider.js";
export { BundledBibleProvider } from "./bundled-provider.js";
export { ApiBibleProvider } from "./api-bible-provider.js";
export { CompositeBibleProvider } from "./composite-provider.js";
export { parseTranslationFile, type ParsedTranslation } from "./load.js";
