/**
 * Only the given name, not whatever else someone typed at signup.
 *
 * A seeker who was asked for "any name you like" has no reason to be shown a
 * volunteer's full one — a first name is enough to make the person on the
 * other end feel like a person, without handing over more than that.
 */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}
