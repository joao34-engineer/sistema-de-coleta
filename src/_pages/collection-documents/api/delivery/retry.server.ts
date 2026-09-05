import "server-only";

import { z } from "zod";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";

export const documentRetryResultSchema = z.object({
  jobId: z.uuid().nullable(),
  documentId: z.uuid(),
  jobType: z.enum(["render_pdf", "render_qr"]),
  status: z.enum(["queued", "succeeded"]),
  alreadyReady: z.boolean(),
}).strict();

export type DocumentRetryResult = z.output<typeof documentRetryResultSchema>;

export async function retryDocumentJob(
  collectionId: string,
  documentId: string,
  jobType: "render_pdf" | "render_qr" = "render_pdf",
): Promise<DocumentRetryResult> {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("retry_document_job", {
    p_collection_id: collectionId,
    p_document_id: documentId,
    p_job_type: jobType,
  });
  if (error) throw error;
  return documentRetryResultSchema.parse(data);
}
