import { z } from "zod";

export const verificationTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const publicVerificationSchema = z.object({
  authentic: z.boolean(),
  officialCode: z.string().regex(/^MJT-\d{4}-\d{6}$/),
  issuedAt: z.iso.datetime({ offset: true }),
  status: z.enum(["collected", "canceled"]),
  organization: z.object({ name: z.string().min(1).max(160) }),
  documentVersion: z.number().int().positive(),
});

export type PublicVerificationDTO = Readonly<z.output<typeof publicVerificationSchema>>;

