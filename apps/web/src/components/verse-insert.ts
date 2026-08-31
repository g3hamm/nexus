/**
 * A verse chosen in the sidebar, on its way to the composer.
 *
 * The two are separate subtrees — the conversation and the panel beside it —
 * and on a phone they are separate swipe pages. Threading a callback from one
 * to the other would mean lifting composer text up through the whole
 * workspace, so instead the panel announces a reference and whoever is
 * currently composing picks it up.
 *
 * Deliberately tiny and deliberately not a context: there is exactly one
 * composer mounted at a time, the payload is a single string, and nothing
 * here needs to survive a re-render.
 */
type Listener = (reference: string) => void;

const listeners = new Set<Listener>();

/** Ask the open composer to insert this reference at its cursor. */
export function insertVerse(reference: string): void {
  for (const listener of listeners) listener(reference);
}

/** Returns an unsubscribe function, for an effect cleanup. */
export function onInsertVerse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
