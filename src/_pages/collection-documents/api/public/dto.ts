import { issuedCollectionStatusSchema, publicVerificationSchema, verificationTokenSchema, type PublicVerificationDTO } from "../../model/public-verification";
import { z } from "zod";

export { publicVerificationSchema, verificationTokenSchema } from "../../model/public-verification";
export type { PublicVerificationDTO } from "../../model/public-verification";

export const publicVerificationRowSchema = z.object({
  is_authentic: z.boolean(),
  official_code: z.string().regex(/^MJT-\d{4}-\d{6}$/),
  issued_at: z.iso.datetime({ offset: true }),
  collection_status: issuedCollectionStatusSchema,
  organization_name: z.string().trim().min(1).max(160),
  document_version: z.number().int().positive(),
});

export type PublicVerificationRow = Readonly<z.output<typeof publicVerificationRowSchema>>;

export function mapPublicVerificationRow(value: unknown): PublicVerificationDTO | null {
  const row = publicVerificationRowSchema.safeParse(value);
  if (!row.success) return null;

  const dto = publicVerificationSchema.safeParse({
    authentic: row.data.is_authentic,
    officialCode: row.data.official_code,
    issuedAt: row.data.issued_at,
    status: row.data.collection_status,
    organization: { name: row.data.organization_name },
    documentVersion: row.data.document_version,
  });
  return dto.success ? dto.data : null;
}

export function isValidVerificationToken(value: unknown): value is string {
  return verificationTokenSchema.safeParse(value).success;
}
