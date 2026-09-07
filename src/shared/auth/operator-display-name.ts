/** Canonical operator label when `profiles.full_name` is missing — same copy as the settings hub. */
export const OPERATOR_FALLBACK_NAME = "Coletor MJT";

export function operatorDisplayName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : OPERATOR_FALLBACK_NAME;
}

/** First token of the display name — dashboard greeting, not the account email. */
export function operatorGivenName(fullName: string | null | undefined): string {
  const displayName = operatorDisplayName(fullName);
  return displayName.split(/\s+/)[0] ?? displayName;
}
