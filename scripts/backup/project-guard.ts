export function projectRefFromUrl(value: string): string {
  const hostname = new URL(value).hostname;
  const [ref] = hostname.split(".");
  if (!ref) throw new Error("Não foi possível identificar o project ref.");
  return ref;
}

export type RestoreGuardInput = Readonly<{
  sourceProjectRef: string;
  targetProjectRef: string;
  targetUrl: string;
}>;

export function assertRestoreTargetIsIsolated(input: RestoreGuardInput): void {
  const urlRef = projectRefFromUrl(input.targetUrl);
  if (urlRef !== input.targetProjectRef) {
    throw new Error("RESTORE_CONFIRM_PROJECT_REF não coincide com RESTORE_SUPABASE_URL.");
  }
  if (input.targetProjectRef === input.sourceProjectRef) {
    throw new Error("Restore recusado: o alvo é o mesmo projeto do MVP. Use um throwaway.");
  }
}
