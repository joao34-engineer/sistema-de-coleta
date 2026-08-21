import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/shared/config/environment";
import { mapPublicVerificationRow, verificationTokenSchema, type PublicVerificationDTO } from "./dto";

type VerificationDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      verify_collection_document: {
        Args: { p_verification_token: string };
        Returns: ReadonlyArray<{
          is_authentic: boolean;
          official_code: string;
          issued_at: string;
          collection_status: "collected" | "canceled";
          organization_name: string;
          document_version: number;
        }>;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export async function verifyCollectionDocument(token: string): Promise<PublicVerificationDTO | null> {
  const parsedToken = verificationTokenSchema.safeParse(token);
  if (!parsedToken.success) return null;

  const environment = getPublicEnvironment();
  const cookieStore = await cookies();
  const supabase = createServerClient<VerificationDatabase>(environment.supabaseUrl, environment.supabasePublishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined },
  });
  const { data, error } = await supabase.rpc("verify_collection_document", { p_verification_token: parsedToken.data });
  if (error) throw error;

  const firstRow = Array.isArray(data) ? data[0] : null;
  return mapPublicVerificationRow(firstRow);
}
