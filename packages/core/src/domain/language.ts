import { z } from "zod";

/**
 * Languages are BCP-47 tags ("en", "pt-BR", "zh-Hans", "ar").
 *
 * Nexus never asks a seeker to pick one. It is detected from their first
 * message and from `Accept-Language`, and they can correct it afterwards.
 * That is the whole "no instructions needed" promise in one decision.
 */
export type LanguageCode = string;

export const languageCodeSchema = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/, "must be a BCP-47 language tag");

/** Scripts that read right-to-left, so the UI can mirror itself without being told. */
const RTL_LANGUAGES = new Set([
  "ar",
  "arc",
  "az",
  "dv",
  "fa",
  "he",
  "ku",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
]);

export function textDirection(language: LanguageCode): "ltr" | "rtl" {
  const primary = language.split("-")[0]?.toLowerCase() ?? "";
  return RTL_LANGUAGES.has(primary) ? "rtl" : "ltr";
}

/** "pt-BR" and "pt" are the same language for matching purposes. */
export function sameLanguage(a: LanguageCode, b: LanguageCode): boolean {
  const pa = a.split("-")[0]?.toLowerCase();
  const pb = b.split("-")[0]?.toLowerCase();
  return pa !== undefined && pa === pb;
}

/** Display name of a language in that language itself, falling back to the tag. */
export function endonym(language: LanguageCode): string {
  try {
    const dn = new Intl.DisplayNames([language], { type: "language" });
    return dn.of(language) ?? language;
  } catch {
    return language;
  }
}
