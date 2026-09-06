/**
 * Hostname → Supabase project ref. Used only by server/scripts to consume
 * SUPABASE_CONFIRM_PROJECT_REF. Keep this module out of Client Components.
 */
export function projectRefFromUrl(value: string): string {
  const hostname = new URL(value).hostname;
  const [ref] = hostname.split(".");
  if (!ref) throw new Error("Não foi possível identificar o project ref.");
  return ref;
}
