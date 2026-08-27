/**
 * How a severity looks.
 *
 * Only `critical` gets the danger colour. A queue where everything is red is a
 * queue nobody triages, and this one will mostly contain things a person will
 * read once and dismiss.
 */
export const SEVERITY_STYLE: Record<string, string> = {
  none: "text-ink-subtle",
  low: "text-ink-muted",
  medium: "text-caution",
  high: "text-caution",
  critical: "text-danger",
};

export const CATEGORY_LABEL: Record<string, string> = {
  sexual_content: "Sexual content",
  harassment_or_hate: "Harassment or hate",
  violence_or_threats: "Violence or threats",
  self_harm_risk: "Risk of self-harm",
  off_platform_contact: "Moving off-platform",
  financial_solicitation: "Money or inducements",
  spiritual_coercion: "Spiritual coercion",
  pii_disclosure: "Personal details shared",
  doctrinal_misrepresentation: "Doctrinal misrepresentation",
  off_mission: "Off-mission",
};

export const SUBJECT_LABEL: Record<string, string> = {
  seeker: "the seeker",
  volunteer: "the volunteer",
  both: "both parties",
  unclear: "unclear",
};

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
