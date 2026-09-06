import { projectRefFromUrl } from "@/shared/config/project-ref";

export { projectRefFromUrl };

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
