/**
 * Injected time and identity generation.
 *
 * Not ceremony: retention windows, moderation cadence, and token expiry are
 * all time-dependent, and tests for those are miserable to write against a
 * real clock.
 */
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const uuidGenerator: IdGenerator = {
  generate: () => crypto.randomUUID(),
};
