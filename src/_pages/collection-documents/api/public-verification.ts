import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPublicEnvironment } from "@/shared/config/environment";

const verificationRowSchema = z.object({ is_authentic: z.boolean(), official_code: z.string().regex(/^MJT-\d{4}-\d{6}$/), issued_at: z.iso.datetime({ offset: true }), collection_status: z.enum(["collected", "canceled"]), organization_name: z.string().min(1).max(160), document_version: z.number().int().positive() });
const verificationSchema = z.object({ authentic: z.boolean(), officialCode: z.string().regex(/^MJT-\d{4}-\d{6}$/), issuedAt: z.iso.datetime({ offset: true }), status: z.enum(["collected", "canceled"]), organization: z.object({ name: z.string().min(1).max(160) }), documentVersion: z.number().int().positive() });
type VerificationDatabase = { public: { Tables: Record<never, never>; Views: Record<never, never>; Functions: { verify_collection_document: { Args: { p_verification_token: string }; Returns: { is_authentic: boolean; official_code: string; issued_at: string; collection_status: "collected" | "canceled"; organization_name: string; document_version: number }[] } }; Enums: Record<never, never>; CompositeTypes: Record<never, never> } };

export async function verifyCollectionDocument(token: string) {
  const environment = getPublicEnvironment();
  const cookieStore = await cookies();
  const supabase = createServerClient<VerificationDatabase>(environment.supabaseUrl, environment.supabasePublishableKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } });
  const { data, error } = await supabase.rpc("verify_collection_document", { p_verification_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? verificationRowSchema.safeParse(data[0]) : verificationRowSchema.safeParse(null);
  if (!row.success) return null;
  const parsed = verificationSchema.safeParse({ authentic: row.data.is_authentic, officialCode: row.data.official_code, issuedAt: row.data.issued_at, status: row.data.collection_status, organization: { name: row.data.organization_name }, documentVersion: row.data.document_version });
  return parsed.success ? parsed.data : null;
}
