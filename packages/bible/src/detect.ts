/**
 * Detection only — no database, no providers, no network.
 *
 * A separate entry point so the browser can find references in a message
 * without pulling `@nexus/db` and a Postgres driver into the client bundle.
 * Importing the package barrel from a client component would do exactly that.
 */
export { PatternReferenceDetector, referenceDetector } from "./detector.js";
export { BOOKS, osisFor, englishName, chaptersIn, normalise } from "./books.js";
